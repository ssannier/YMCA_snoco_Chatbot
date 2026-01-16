const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize AWS clients
const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: process.env.REGION || 'us-west-2' });
const bedrockRuntimeClient = new BedrockRuntimeClient({ region: process.env.REGION || 'us-west-2' });
const translateClient = new TranslateClient({ region: process.env.REGION || 'us-west-2' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION || 'us-west-2' }));
const s3Client = new S3Client({ region: process.env.REGION || 'us-west-2' });

// Configuration
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const CONVERSATION_TABLE = process.env.CONVERSATION_TABLE_NAME;
const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE_NAME;
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET;

// Topic Categories for categorization
const TOPIC_CATEGORIES = [
  'Early History & Founding',
  'Community Programs & Services',
  'Youth & Education Programs',
  'Global Impact & International Work',
  'Modern YMCA & Current Services',
  'War Efforts & Historical Events',
  'Sports & Recreation',
  'Health & Wellness',
  'Social Justice & Equity',
  'General/Other Questions'
];

// Request deduplication cache (in-memory, Lambda-scoped)
// Prevents duplicate requests within the same Lambda execution context
const processedRequests = new Map();
const DEDUP_WINDOW_MS = 10000; // 10 second deduplication window

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedRequests.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedRequests.delete(key);
    }
  }
}, 30000); // Clean up every 30 seconds

// Supported languages for YMCA multilingual support
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'ru': 'Russian'
};

// ============================================================================
// CORE PROCESSING FUNCTIONS (Shared Logic)
// ============================================================================

/**
 * Translate text to English for better RAG performance
 */
async function translateToEnglish(message, language) {
  let detectedLanguage = language === 'auto' ? 'en' : language;
  let originalLanguage = language === 'auto' ? 'en' : language;
  let queryInEnglish = message;

  if (language === 'auto' || detectedLanguage !== 'en') {
    try {
      const translateCommand = new TranslateTextCommand({
        Text: message,
        SourceLanguageCode: language === 'auto' ? 'auto' : detectedLanguage,
        TargetLanguageCode: 'en'
      });
      const translateResult = await translateClient.send(translateCommand);
      queryInEnglish = translateResult.TranslatedText;

      if (language === 'auto' && translateResult.SourceLanguageCode) {
        detectedLanguage = translateResult.SourceLanguageCode;
        originalLanguage = translateResult.SourceLanguageCode;
        console.log(`Auto-detected language: ${detectedLanguage}`);
      }

      console.log(`Translated query to English: ${queryInEnglish}`);
    } catch (error) {
      console.warn('Translation to English failed, using original query:', error);
    }
  }

  return { queryInEnglish, detectedLanguage, originalLanguage };
}

/**
 * Retrieve and process context from Knowledge Base with diversity enforcement
 */
async function retrieveKnowledgeBaseContext(queryInEnglish) {
  const retrieveCommand = new RetrieveCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: queryInEnglish },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: 50 // Request more to ensure diversity
      }
    }
  });

  const retrieveResult = await bedrockAgentClient.send(retrieveCommand);

  if (!retrieveResult.retrievalResults || retrieveResult.retrievalResults.length === 0) {
    return { citations: [], retrievedContext: '' };
  }

  // Group results by document with chunk details
  const documentGroups = {};

  for (const result of retrieveResult.retrievalResults) {
    const s3Uri = result.location?.s3Location?.uri || '';
    let pdfFilename = 'Document';

    if (s3Uri) {
      const match = s3Uri.match(/\/([^/]+)\.pdf\.json$/);
      if (match) {
        pdfFilename = match[1] + '.pdf';
      }
    }

    if (!documentGroups[pdfFilename]) {
      documentGroups[pdfFilename] = {
        title: pdfFilename,
        s3Uri: s3Uri,
        chunks: [],
        scores: [],
        maxScore: 0
      };
    }

    documentGroups[pdfFilename].chunks.push({
      text: result.content?.text || '',
      score: result.score || 0
    });
    documentGroups[pdfFilename].scores.push(result.score || 0);
    if ((result.score || 0) > documentGroups[pdfFilename].maxScore) {
      documentGroups[pdfFilename].maxScore = result.score || 0;
    }
  }

  // DIVERSITY ENFORCEMENT: Limit chunks per document to encourage multi-source synthesis
  const MAX_CHUNKS_PER_DOC = 10; // Max chunks from any single document
  const uniqueDocuments = {};

  for (const [filename, doc] of Object.entries(documentGroups)) {
    // Sort chunks by score and take top N
    const sortedChunks = doc.chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CHUNKS_PER_DOC);

    uniqueDocuments[filename] = {
      title: doc.title,
      s3Uri: doc.s3Uri,
      chunks: sortedChunks.map(c => c.text),
      maxScore: doc.maxScore,
      avgScore: doc.scores.reduce((a, b) => a + b, 0) / doc.scores.length,
      chunkCount: sortedChunks.length
    };
  }

  console.log(`Retrieved from ${Object.keys(documentGroups).length} documents:`,
    Object.entries(uniqueDocuments).map(([name, doc]) => `${name}(${doc.chunkCount})`).join(', '));

  // Generate citations with pre-signed URLs
  const docKeys = Object.keys(uniqueDocuments);
  const citations = await Promise.all(docKeys.map(async (filename, index) => {
    const doc = uniqueDocuments[filename];
    let pdfUrl = null;
    let displayFilename = filename;

    if (doc.s3Uri) {
      try {
        const key = `input/${filename}`;

        // Try to retrieve original filename from metadata
        try {
          const headCommand = new HeadObjectCommand({ Bucket: DOCUMENTS_BUCKET, Key: key });
          const metadata = await s3Client.send(headCommand);
          if (metadata.Metadata && (metadata.Metadata['original-name'] || metadata.Metadata['x-amz-meta-original-name'])) {
            displayFilename = metadata.Metadata['original-name'] || metadata.Metadata['x-amz-meta-original-name'];
          }
        } catch (headError) {
          // Ignore metadata errors
        }

        const command = new GetObjectCommand({
          Bucket: DOCUMENTS_BUCKET,
          Key: key,
          ResponseContentDisposition: `inline; filename="${displayFilename}"`
        });

        pdfUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
      } catch (error) {
        console.warn(`Failed to generate pre-signed URL for ${filename}:`, error);
      }
    }

    return {
      id: index + 1,
      title: displayFilename,
      source: 'YMCA Historical Archives',
      sourceUrl: pdfUrl,
      confidence: doc.maxScore,
      fullText: doc.chunks.join('\n\n...\n\n'),
      excerpt: doc.chunks[0].substring(0, 300) + '...'
    };
  }));

  // Build rich context from grouped sources
  const retrievedContext = citations.map(source => {
    return `[Source ${source.id}]: ${source.title}\nCONTENT:\n${source.fullText}`;
  }).join('\n\n=====================\n\n');

  console.log(`Retrieved ${retrieveResult.retrievalResults.length} chunks, grouped into ${citations.length} unique documents`);

  return { citations, retrievedContext };
}

/**
 * Generate AI response using Bedrock with streaming
 */
async function generateAIResponse(retrievedContext, queryInEnglish, citations, streamWriter = null) {
  const enhancedPrompt = createEnhancedPrompt(retrievedContext, queryInEnglish, citations.length);

  const streamCommand = new InvokeModelWithResponseStreamCommand({
    modelId: 'us.amazon.nova-pro-v1:0',
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: [{ text: enhancedPrompt }]
      }],
      inferenceConfig: {
        maxTokens: 4000,
        temperature: 0.7
      }
    })
  });

  const streamResult = await bedrockRuntimeClient.send(streamCommand);
  let generatedText = '';

  // Process stream chunks
  for await (const chunk of streamResult.body) {
    if (chunk.chunk?.bytes) {
      const chunkText = new TextDecoder().decode(chunk.chunk.bytes);
      try {
        const chunkJson = JSON.parse(chunkText);

        if (chunkJson.contentBlockDelta?.delta?.text) {
          const textChunk = chunkJson.contentBlockDelta.delta.text;
          generatedText += textChunk;

          // Stream to client if writer provided
          if (streamWriter) {
            streamWriter(textChunk);
          }
        } else if (chunkJson.messageStart) {
          console.log('Message started');
        } else if (chunkJson.messageStop) {
          console.log('Message stopped, stop reason:', chunkJson.messageStop.stopReason);
        }
      } catch (parseError) {
        console.warn('Failed to parse chunk:', chunkText, parseError);
      }
    }
  }

  // Parse response
  try {
    const jsonResponse = JSON.parse(generatedText);
    return {
      type: 'structured',
      content: jsonResponse,
      rawText: generatedText
    };
  } catch (parseError) {
    console.warn('Response not in JSON format, structuring as narrative');
    return {
      type: 'narrative',
      content: {
        story: {
          title: "YMCA Historical Insights",
          narrative: generatedText,
          timeline: "Historical period covered in sources",
          locations: "Various YMCA locations",
          keyPeople: "YMCA leaders and community members",
          whyItMatters: "Understanding our heritage helps guide our future mission"
        },
        lessonsAndThemes: ["Historical continuity in YMCA's mission", "Community resilience and adaptation"],
        modernReflection: "These historical insights remind us of the YMCA's enduring commitment to community service.",
        exploreFurther: [
          "What other historical periods would you like to explore?",
          "How did the YMCA adapt to other major challenges?",
          "Tell me about YMCA community programs today"
        ]
      },
      rawText: generatedText
    };
  }
}

/**
 * Translate response back to original language
 */
async function translateResponse(ragResponse, originalLanguage) {
  if (originalLanguage === 'en' || !SUPPORTED_LANGUAGES[originalLanguage]) {
    return ragResponse;
  }

  try {
    if (ragResponse.type === 'structured' || ragResponse.type === 'narrative') {
      const content = ragResponse.content;

      // Collect all text to translate
      const textsToTranslate = [
        content.story?.title || '',
        content.story?.narrative || '',
        content.story?.timeline || '',
        content.story?.locations || '',
        content.story?.keyPeople || '',
        content.story?.whyItMatters || '',
        ...(content.lessonsAndThemes || []),
        content.modernReflection || '',
        ...(content.exploreFurther || [])
      ].filter(text => text && text.length > 0);

      // Translate all texts
      const translatedTexts = await Promise.all(
        textsToTranslate.map(async (text) => {
          const translateCmd = new TranslateTextCommand({
            Text: text,
            SourceLanguageCode: 'en',
            TargetLanguageCode: originalLanguage
          });
          const result = await translateClient.send(translateCmd);
          return result.TranslatedText;
        })
      );

      // Reconstruct response with translated texts
      let textIndex = 0;
      return {
        ...ragResponse,
        content: {
          ...content,
          story: {
            title: translatedTexts[textIndex++],
            narrative: translatedTexts[textIndex++],
            timeline: translatedTexts[textIndex++],
            locations: translatedTexts[textIndex++],
            keyPeople: translatedTexts[textIndex++],
            whyItMatters: translatedTexts[textIndex++]
          },
          lessonsAndThemes: (content.lessonsAndThemes || []).map(() => translatedTexts[textIndex++]),
          modernReflection: translatedTexts[textIndex++],
          exploreFurther: (content.exploreFurther || []).map(() => translatedTexts[textIndex++]),
          citedSources: content.citedSources || []
        }
      };
    }

    console.log(`Translated response to ${originalLanguage}`);
  } catch (error) {
    console.warn('Translation of response failed, returning English response:', error);
  }

  return ragResponse;
}

/**
 * Categorize query using Bedrock (async, non-blocking) - SUPPORTS MULTIPLE CATEGORIES
 */
async function categorizeQuery(queryInEnglish) {
  try {
    const categorizationPrompt = `You are a topic categorization assistant for a YMCA historical chatbot.

Your task is to categorize the following user query into ONE OR MORE of these predefined categories:

${TOPIC_CATEGORIES.map((cat, idx) => `${idx + 1}. ${cat}`).join('\n')}

User Query: "${queryInEnglish}"

INSTRUCTIONS:
- Analyze the query and select ALL categories that apply (minimum 1, maximum 3)
- If the query touches multiple topics, list all relevant categories
- Format: Return ONLY the category names separated by " | " (pipe symbol with spaces)
- Example: "War Efforts & Historical Events | Social Justice & Equity"
- If only one category applies, return just that category name

Categories:`;

    const categorizeCommand = new InvokeModelWithResponseStreamCommand({
      modelId: 'us.amazon.nova-pro-v1:0',
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: [{ text: categorizationPrompt }]
        }],
        inferenceConfig: {
          maxTokens: 150,
          temperature: 0.2 // Slightly higher for multi-category flexibility
        }
      })
    });

    const streamResult = await bedrockRuntimeClient.send(categorizeCommand);
    let categoryText = '';

    // Process stream chunks
    for await (const chunk of streamResult.body) {
      if (chunk.chunk?.bytes) {
        const chunkText = new TextDecoder().decode(chunk.chunk.bytes);
        try {
          const chunkJson = JSON.parse(chunkText);
          if (chunkJson.contentBlockDelta?.delta?.text) {
            categoryText += chunkJson.contentBlockDelta.delta.text;
          }
        } catch (parseError) {
          // Ignore parsing errors for categorization
        }
      }
    }

    // Parse multiple categories separated by " | "
    const cleanedResponse = categoryText.trim();
    const potentialCategories = cleanedResponse.split('|').map(cat => cat.trim());

    // Validate and match each category
    const validCategories = [];
    for (const potentialCat of potentialCategories) {
      const matchedCategory = TOPIC_CATEGORIES.find(cat =>
        potentialCat.includes(cat) || cat.includes(potentialCat) ||
        potentialCat.toLowerCase() === cat.toLowerCase()
      );
      if (matchedCategory && !validCategories.includes(matchedCategory)) {
        validCategories.push(matchedCategory);
      }
    }

    // Default to General/Other if no valid categories found
    const finalCategories = validCategories.length > 0
      ? validCategories
      : ['General/Other Questions'];

    const categoriesString = finalCategories.join(' | ');
    console.log(`Query categorized as: ${categoriesString}`);

    return categoriesString; // Returns pipe-separated string for storage
  } catch (error) {
    console.warn('Query categorization failed:', error);
    return 'General/Other Questions'; // Default category on error
  }
}

/**
 * Store conversation and analytics in DynamoDB
 */
async function storeConversationData(conversationId, sessionId, userId, message, originalLanguage,
                                     queryInEnglish, finalResponse, ragResponse, citations,
                                     timestamp, processingTime, category) {
  // Store conversation
  try {
    await dynamoClient.send(new PutCommand({
      TableName: CONVERSATION_TABLE,
      Item: {
        conversationId: conversationId || sessionId,
        timestamp: timestamp,
        userId: userId,
        sessionId: sessionId,
        userMessage: message,
        userLanguage: originalLanguage,
        translatedQuery: queryInEnglish,
        aiResponse: finalResponse.content,
        aiResponseType: finalResponse.type,
        originalResponse: ragResponse.rawText,
        responseLanguage: originalLanguage,
        processingTimeMs: processingTime,
        citationsCount: citations.length,
        sources: citations
      }
    }));
  } catch (error) {
    console.error('Failed to store conversation:', error);
  }

  // Store analytics
  try {
    await dynamoClient.send(new PutCommand({
      TableName: ANALYTICS_TABLE,
      Item: {
        queryId: generateQueryId(),
        timestamp: timestamp,
        userId: userId,
        sessionId: sessionId,
        conversationId: conversationId || sessionId,
        language: originalLanguage,
        category: category || 'General/Other Questions', // Add category field
        queryLength: message.length,
        responseLength: JSON.stringify(finalResponse.content).length,
        processingTimeMs: processingTime,
        translationUsed: originalLanguage !== 'en',
        knowledgeBaseUsed: true,
        citationsFound: citations.length,
        responseType: finalResponse.type,
        fallbackUsed: finalResponse.fallback || false,
        success: true
      }
    }));
  } catch (error) {
    console.error('Failed to store analytics:', error);
  }
}

/**
 * Create error response
 */
function createErrorResponse() {
  return {
    type: 'error',
    content: {
      story: {
        title: "Unable to Access Archives",
        narrative: "I'm currently unable to access the YMCA historical archives. Please try again in a moment or contact your local YMCA for historical information.",
        whyItMatters: "Your questions about YMCA history deserve proper attention from our archives."
      },
      exploreFurther: [
        "Try asking your question again",
        "Tell me about YMCA programs in the 1900s",
        "What was the YMCA's role in community development?"
      ]
    },
    rawText: "Knowledge Base temporarily unavailable"
  };
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

/**
 * Main request processing logic (shared between streaming and non-streaming)
 */
async function processRequest(event, streamWriter = null) {
  console.log('Processing request:', JSON.stringify(event, null, 2));

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const {
    message,
    conversationId,
    language = 'auto',
    sessionId = generateSessionId(),
    userId = 'anonymous'
  } = body;

  if (!message) {
    throw new Error('Message is required');
  }

  // Request deduplication: Create a unique key for this request
  const dedupKey = `${userId}:${sessionId}:${message.substring(0, 100)}`;
  const now = Date.now();

  if (processedRequests.has(dedupKey)) {
    const lastProcessedTime = processedRequests.get(dedupKey);
    if (now - lastProcessedTime < DEDUP_WINDOW_MS) {
      console.log('Duplicate request detected within deduplication window, skipping:', dedupKey);
      throw new Error('Duplicate request detected. Please wait before submitting the same query again.');
    }
  }

  // Mark this request as being processed
  processedRequests.set(dedupKey, now);

  const timestamp = Date.now();
  const ragStartTime = Date.now();

  // Step 1: Translate query to English
  const { queryInEnglish, originalLanguage } = await translateToEnglish(message, language);

  // Step 2: Start categorization (async, non-blocking)
  const categorizationPromise = categorizeQuery(queryInEnglish);

  let ragResponse;
  let citations = [];

  try {
    // Step 3: Retrieve context from Knowledge Base
    const { citations: retrievedCitations, retrievedContext } = await retrieveKnowledgeBaseContext(queryInEnglish);
    citations = retrievedCitations;

    // Step 4: Generate AI response
    ragResponse = await generateAIResponse(retrievedContext, queryInEnglish, citations, streamWriter);

    console.log('RAG response generated successfully');
    console.log('Citations processed:', citations.length);
  } catch (error) {
    console.error('RAG query failed:', error);
    ragResponse = createErrorResponse();
  }

  const ragEndTime = Date.now();
  const processingTime = ragEndTime - ragStartTime;

  // Step 5: Translate response back to original language
  const finalResponse = await translateResponse(ragResponse, originalLanguage);

  // Step 6: Wait for categorization to complete
  const category = await categorizationPromise;

  // Step 7: Store conversation and analytics
  await storeConversationData(
    conversationId, sessionId, userId, message, originalLanguage,
    queryInEnglish, finalResponse, ragResponse, citations, timestamp, processingTime, category
  );

  // Return response data
  return {
    response: finalResponse.content,
    responseType: finalResponse.type,
    rawResponse: finalResponse.rawText,
    sources: citations,
    conversationId: conversationId || sessionId,
    sessionId: sessionId,
    language: originalLanguage,
    processingTime: processingTime,
    translationUsed: originalLanguage !== 'en',
    timestamp: new Date(timestamp).toISOString(),
    metadata: {
      knowledgeBaseUsed: true,
      citationsFound: citations.length,
      responseStructured: finalResponse.type === 'structured',
      fallbackUsed: finalResponse.fallback || false
    }
  };
}

// ============================================================================
// LAMBDA HANDLERS
// ============================================================================

/**
 * Non-streaming handler
 */
exports.handler = async (event, context) => {
  try {
    const responseData = await processRequest(event);
    return createResponse(200, responseData);
  } catch (error) {
    console.error('Handler error:', error);
    return createResponse(
      error.message === 'Message is required' ? 400 : 500,
      {
        response: {
          story: {
            title: "Technical Difficulties",
            narrative: "I apologize, but I encountered an error processing your request. Please try again or contact your local YMCA for assistance.",
            whyItMatters: "Your questions about YMCA history and programs are important to us."
          },
          exploreFurther: [
            "Try rephrasing your question",
            "What did the YMCA do during major historical events?",
            "Tell me about YMCA youth programs"
          ]
        },
        responseType: 'error',
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }
    );
  }
};

/**
 * Streaming handler
 */
exports.streamingHandler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    console.log('Streaming handler called');

    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      // Stream writer function
      const streamWriter = (textChunk) => {
        const sseData = `data: ${JSON.stringify({
          type: 'chunk',
          content: textChunk
        })}\n\n`;
        responseStream.write(sseData);
      };

      // Process request with streaming
      const responseData = await processRequest(event, streamWriter);

      // Send completion event
      responseStream.write(`data: ${JSON.stringify({
        type: 'complete',
        response: responseData
      })}\n\n`);

      responseStream.write('data: [DONE]\n\n');
    } catch (error) {
      console.error('Streaming handler error:', error);
      responseStream.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Internal server error'
      })}\n\n`);
    } finally {
      responseStream.end();
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateQueryId() {
  return 'query_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Create enhanced prompt that enforces multi-source synthesis
 */
function createEnhancedPrompt(retrievedContext, queryInEnglish, numSources) {
  return `You are a knowledgeable YMCA historian and storyteller with deep expertise in YMCA history, programs, and community impact. Your role is to transform archival materials into engaging, accessible narratives that inspire present-day reflection and decision-making.

RETRIEVED CONTEXT FROM YMCA ARCHIVES:
${retrievedContext}

USER QUESTION: ${queryInEnglish}

CRITICAL REQUIREMENTS FOR SOURCE SYNTHESIS:
1. **MANDATORY MULTI-SOURCE USAGE**: You have ${numSources} sources available. You MUST reference and synthesize information from AT LEAST ${Math.min(3, numSources)} different sources in your response.
2. **DISTRIBUTED CITATIONS**: Do NOT cite the same source repeatedly. Spread your citations across different sources naturally throughout the narrative.
3. **SOURCE INTEGRATION**: Compare, contrast, or show evolution across different documents. For example: "In the early 1980s [Source 1], the YMCA focused on X, while later developments in the 1990s [Source 2] showed a shift to Y, and by 2000 [Source 3] we see Z emerging."
4. **CROSS-REFERENCE**: Look for connections between sources. If Source 1 mentions a program and Source 3 discusses its impact, connect them.
5. **DIVERSITY**: Use different sources for different sections of your response (e.g., Source 1 for timeline, Source 2 for locations, Source 3 for key people).

RESPONSE STRUCTURE REQUIREMENTS:
1. **STORYTELLING APPROACH**: Create a compelling narrative that brings history to life across multiple timeframes and perspectives.
2. **RICH NARRATIVE**: Your "narrative" field should be 3-5 substantial paragraphs that weave together insights from multiple sources.
3. **SPECIFIC DETAILS**: Include dates, names, places, and events from the sources.
4. **NATURAL CITATIONS**: Integrate source references naturally in the narrative, e.g., "According to the 1981 annual report [Source 1], youth programs expanded significantly, a trend that continued through the decade [Source 2] and eventually led to [Source 3]..."
5. **ENGAGING EXPLORATION**: Generate 3 specific follow-up questions that explore different aspects or time periods.

RESPONSE FORMAT (JSON):
{
  "story": {
    "title": "Engaging title that captures the essence of the historical narrative",
    "narrative": "Rich, multi-paragraph storytelling response (3-5 paragraphs) that synthesizes information from MULTIPLE sources. Each paragraph should ideally reference different sources. Use natural citations like 'In 1981 [Source 1]...' or 'As noted in later reports [Source 2]...'",
    "timeline": "Comprehensive timeline spanning all sources: e.g., '1857, 1920s, 1960s-1970s, 1977, 1981, 1990s'",
    "locations": "All specific places mentioned across sources",
    "keyPeople": "Important individuals mentioned across all sources",
    "whyItMatters": "Modern relevance drawing on lessons from multiple time periods and sources"
  },
  "lessonsAndThemes": [
     "Key insight from Source X",
     "Related theme from Source Y",
     "Pattern observed across Sources X, Y, and Z"
  ],
  "modernReflection": "Connection to today's challenges, referencing patterns seen across multiple sources",
  "exploreFurther": [
    "Specific question about aspect from Source 1",
    "Question exploring connection between Sources 2 and 3",
    "Question about time period or theme not fully covered"
  ],
  "citedSources": [1, 2, 3, ...]
}

VALIDATION CHECKLIST (Review before responding):
- [ ] Have I cited at least 3 different sources (if available)?
- [ ] Are my citations distributed throughout the narrative, not clustered?
- [ ] Does each paragraph reference different sources?
- [ ] Have I drawn connections or contrasts between sources?
- [ ] Does my timeline span multiple sources?
- [ ] Have I avoided repeating the same source citation unnecessarily?

TONE: Engaging, authoritative, and inspiring. Write as if you're a passionate historian who has studied multiple documents and is sharing fascinating connections you've discovered.

IMPORTANT:
- The "citedSources" array must list ALL Source IDs you referenced (e.g., [1, 2, 3, 4]).
- Ground your response in the retrieved sources - do not make up information.
- Prioritize breadth and synthesis over depth in a single source.`;
}
