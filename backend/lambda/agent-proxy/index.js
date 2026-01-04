const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Writable } = require('stream');
const { randomUUID } = require('crypto');

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
const DOCUMENT_MAPPINGS_TABLE = process.env.DOCUMENT_MAPPINGS_TABLE_NAME || CONVERSATION_TABLE;

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

// Main handler logic (shared between streaming and non-streaming)
async function handleRequest(event, responseStream = null) {
  console.log('YMCA AI Agent Proxy - Event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const {
      message,
      conversationId,
      language = 'auto',
      sessionId = generateSessionId(),
      userId = 'anonymous'
    } = body;

    if (!message) {
      if (responseStream) {
        const errorResponse = createResponse(400, { error: 'Message is required' });
        responseStream.write(JSON.stringify(errorResponse));
        responseStream.end();
        return;
      }
      return createResponse(400, { error: 'Message is required' });
    }

    // Generate unique query ID for analytics
    const queryId = generateQueryId();
    const timestamp = Date.now();

    // Step 1: Initialize language variables (detection happens during translation)
    let detectedLanguage = language === 'auto' ? 'en' : language;
    let originalLanguage = language === 'auto' ? 'en' : language;

    // Step 2: Translate query to English if needed (for better RAG performance)
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

        // Extract detected language from auto-detection
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

    // Step 3: Retrieve relevant context from Knowledge Base
    const ragStartTime = Date.now();
    let ragResponse;
    let citations = [];
    let retrievedContext = '';
    
    try {
      // First, retrieve relevant chunks from Knowledge Base
      const retrieveCommand = new RetrieveCommand({
        knowledgeBaseId: KNOWLEDGE_BASE_ID,
        retrievalQuery: {
          text: queryInEnglish
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 10 // Get more context for rich storytelling
            // Using default SEMANTIC search (HYBRID not supported with S3_VECTORS)
          }
        }
      });

      const retrieveResult = await bedrockAgentClient.send(retrieveCommand);
      
      // Process retrieved chunks and build context
      if (retrieveResult.retrievalResults && retrieveResult.retrievalResults.length > 0) {
        // Extract citations with proper metadata and generate obfuscated document URLs
        citations = await Promise.all(retrieveResult.retrievalResults.map(async (result, index) => {
          const s3Uri = result.location?.s3Location?.uri || '';

          // Extract original PDF filename from the processed JSON path
          // Example: s3://bucket/output/processed-text/doc-123/1981.pdf.json -> 1981.pdf
          let pdfFilename = 'Document';
          let documentAccessUrl = null;

          if (s3Uri) {
            const match = s3Uri.match(/\/([^/]+)\.pdf\.json$/);
            if (match) {
              pdfFilename = match[1] + '.pdf';

              // Generate UUID to obfuscate S3 details
              const documentId = randomUUID();
              const bucket = process.env.DOCUMENTS_BUCKET;
              const key = `input/${pdfFilename}`;

              // Store UUID -> S3 location mapping in DynamoDB with TTL
              try {
                const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
                await dynamoClient.send(new PutCommand({
                  TableName: DOCUMENT_MAPPINGS_TABLE,
                  Item: {
                    documentId: documentId,
                    itemType: 'document-mapping',
                    bucket: bucket,
                    key: key,
                    createdAt: Date.now(),
                    expiresAt: expiresAt
                  }
                }));

                // Return obfuscated URL path (API Gateway will handle /documents/:id route)
                documentAccessUrl = `/documents/${documentId}`;
              } catch (error) {
                console.warn(`Failed to store document mapping for ${pdfFilename}:`, error);
              }
            }
          }

          // Use UUID to hide sensitive filename information
          const displayId = randomUUID();

          return {
            id: `source-${index + 1}`,
            title: `Document-${displayId}`,
            source: `YMCA Historical Archives`,
            sourceUrl: documentAccessUrl,
            confidence: result.score || 0.8,
            excerpt: result.content?.text?.substring(0, 300) + '...' || '',
            fullText: result.content?.text || ''
          };
        }));

        // Build rich context from retrieved chunks
        retrievedContext = retrieveResult.retrievalResults
          .map((result, index) => `[Source ${index + 1}]: ${result.content?.text || ''}`)
          .join('\n\n');

        console.log(`Retrieved ${retrieveResult.retrievalResults.length} relevant chunks`);
      }

      // Step 4: Generate response using retrieved context with enhanced prompting
      const enhancedPrompt = `You are a knowledgeable YMCA historian and storyteller with deep expertise in YMCA history, programs, and community impact. Your role is to transform archival materials into engaging, accessible narratives that inspire present-day reflection and decision-making.

RETRIEVED CONTEXT FROM YMCA ARCHIVES:
${retrievedContext}

USER QUESTION: ${queryInEnglish}

RESPONSE REQUIREMENTS:
1. **STORYTELLING APPROACH**: Don't just answer - tell a compelling story that brings history to life
2. **USE THE CONTEXT**: Base your response primarily on the retrieved archival materials above
3. **NARRATIVE STRUCTURE**: Create an engaging story with clear flow
4. **HISTORICAL CONTEXT**: Provide rich background and connect events to broader themes
5. **HUMAN ELEMENTS**: Include specific people, dates, locations, and personal stories from the context
6. **MODERN RELEVANCE**: Connect historical insights to present-day YMCA work and community needs
7. **CITE SOURCES**: Reference the source numbers [Source 1], [Source 2], etc. in your narrative
8. **CONVERSATION STARTERS**: Generate 3 engaging questions that help users explore related topics, compare to today, or dig deeper into specific aspects

RESPONSE FORMAT (JSON):
{
  "story": {
    "title": "Engaging title that captures the essence of the historical moment",
    "narrative": "Rich, multi-paragraph storytelling response that weaves together information from the sources. Include specific dates, names, places, and events. Reference sources like [Source 1] naturally within the narrative.",
    "timeline": "Key dates and periods mentioned in the sources",
    "locations": "Specific places mentioned in the retrieved context",
    "keyPeople": "Important individuals and their roles as mentioned in the sources",
    "whyItMatters": "Modern relevance and lessons for today's YMCA work"
  },
  "lessonsAndThemes": [
    "Key insight or lesson drawn from the historical evidence",
    "Another important theme or pattern from the sources"
  ],
  "modernReflection": "How this historical moment teaches us about today's challenges and opportunities in YMCA work",
  "exploreFurther": [
    "How does this compare to today?",
    "What other [related topic] did the YMCA respond to?",
    "Tell me about YMCA [related aspect from the story]"
  ]
}

TONE: Engaging, authoritative, and inspiring. Write as if you're a passionate historian sharing fascinating discoveries from newly uncovered archives. Use vivid language and specific details from the sources to make history come alive.

IMPORTANT: 
- If the retrieved context doesn't contain enough information, acknowledge this honestly
- Always ground your response in the actual retrieved sources
- Don't invent facts not present in the context
- If sources conflict, acknowledge different perspectives`;

      // Use streaming for real-time response
      const streamCommand = new InvokeModelWithResponseStreamCommand({
        modelId: 'us.amazon.nova-pro-v1:0',
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [{ text: enhancedPrompt }] // Nova format: just text, no type field
          }],
          inferenceConfig: {
            maxTokens: 3000,
            temperature: 0.7
          }
        })
      });

      const streamResult = await bedrockRuntimeClient.send(streamCommand);
      let generatedText = '';

      // Process stream chunks - Amazon Nova streaming format
      for await (const chunk of streamResult.body) {
        if (chunk.chunk?.bytes) {
          const chunkText = new TextDecoder().decode(chunk.chunk.bytes);
          try {
            const chunkJson = JSON.parse(chunkText);
            console.log('Stream chunk type:', Object.keys(chunkJson));

            // Handle Nova contentBlockDelta events (text chunks)
            if (chunkJson.contentBlockDelta?.delta?.text) {
              const textChunk = chunkJson.contentBlockDelta.delta.text;
              generatedText += textChunk;

              // Stream chunk to client if responseStream is available (raw text, not JSON-wrapped)
              if (responseStream) {
                responseStream.write(textChunk);
              }
            }
            // Handle other Nova event types if needed
            else if (chunkJson.messageStart) {
              console.log('Message started');
            }
            else if (chunkJson.messageStop) {
              console.log('Message stopped, stop reason:', chunkJson.messageStop.stopReason);
            }
          } catch (parseError) {
            console.warn('Failed to parse chunk:', chunkText, parseError);
          }
        }
      }

      // Try to parse as JSON first, fallback to structured text if needed
      try {
        const jsonResponse = JSON.parse(generatedText);
        ragResponse = {
          type: 'structured',
          content: jsonResponse,
          rawText: generatedText
        };
      } catch (parseError) {
        console.warn('Response not in JSON format, structuring as narrative');
        ragResponse = {
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
      
      console.log('RAG response generated successfully using Retrieve API');
      console.log('Citations processed:', citations.length);
      
    } catch (error) {
      console.error('RAG query failed:', error);
      
      // Simple error response
      ragResponse = {
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

    const ragEndTime = Date.now();

    // Step 4: Translate response back to original language if needed
    let finalResponse = ragResponse;
    if (originalLanguage !== 'en' && SUPPORTED_LANGUAGES[originalLanguage]) {
      try {
        // For structured responses, translate ALL text fields
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

          // Translate all texts in batch
          const translatedTexts = [];
          for (const text of textsToTranslate) {
            const translateCmd = new TranslateTextCommand({
              Text: text,
              SourceLanguageCode: 'en',
              TargetLanguageCode: originalLanguage
            });
            const result = await translateClient.send(translateCmd);
            translatedTexts.push(result.TranslatedText);
          }

          // Reconstruct response with translated texts
          let textIndex = 0;
          finalResponse = {
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
    }

    // Step 5: Store conversation in DynamoDB with enhanced metadata
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
          processingTimeMs: ragEndTime - ragStartTime,
          citationsCount: citations.length,
          sources: citations
        }
      }));
    } catch (error) {
      console.error('Failed to store conversation:', error);
    }

    // Step 6: Store enhanced analytics
    try {
      await dynamoClient.send(new PutCommand({
        TableName: ANALYTICS_TABLE,
        Item: {
          queryId: queryId,
          timestamp: timestamp,
          userId: userId,
          sessionId: sessionId,
          conversationId: conversationId || sessionId,
          language: originalLanguage,
          queryLength: message.length,
          responseLength: JSON.stringify(finalResponse.content).length,
          processingTimeMs: ragEndTime - ragStartTime,
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

    // Return enhanced response with storytelling format
    const responseData = {
      response: finalResponse.content,
      responseType: finalResponse.type,
      rawResponse: finalResponse.rawText,
      sources: citations,
      conversationId: conversationId || sessionId,
      sessionId: sessionId,
      language: originalLanguage,
      processingTime: ragEndTime - ragStartTime,
      translationUsed: originalLanguage !== 'en',
      timestamp: new Date(timestamp).toISOString(),
      metadata: {
        knowledgeBaseUsed: true,
        citationsFound: citations.length,
        responseStructured: finalResponse.type === 'structured',
        fallbackUsed: finalResponse.fallback || false
      }
    };

    // If streaming, send delimiter and final metadata, then close stream
    if (responseStream) {
      // Send delimiter to separate streaming content from metadata
      responseStream.write('\n\n---METADATA---\n');
      // Send final metadata as JSON
      responseStream.write(JSON.stringify(responseData));
      responseStream.end();
      return;
    }

    return createResponse(200, responseData);

  } catch (error) {
    console.error('Handler error:', error);

    // Store error analytics
    try {
      await dynamoClient.send(new PutCommand({
        TableName: ANALYTICS_TABLE,
        Item: {
          queryId: generateQueryId(),
          timestamp: Date.now(),
          userId: 'unknown',
          error: error.message,
          success: false
        }
      }));
    } catch (analyticsError) {
      console.error('Failed to store error analytics:', analyticsError);
    }

    const errorResponse = {
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
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };

    // If streaming, send error and close stream
    if (responseStream) {
      responseStream.write('\n\n---ERROR---\n');
      responseStream.write(JSON.stringify(errorResponse));
      responseStream.end();
      return;
    }

    return createResponse(500, errorResponse);
  }
}

// Main handler - non-streaming
exports.handler = async (event, context) => {
  console.log('Non-streaming handler called with event:', JSON.stringify(event, null, 2));
  return await handleRequest(event, null);
};

// Streaming handler - uses awslambda global for response streaming
// awslambda is provided by Lambda runtime, not via require
exports.streamingHandler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    console.log('Streaming handler called with event:', JSON.stringify(event, null, 2));

    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    console.log('Response stream created, starting to write data');

    try {
      await handleStreamingRequest(event, responseStream);
      console.log('handleStreamingRequest completed successfully');
    } catch (error) {
      console.error('Streaming handler error:', error);
      responseStream.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Internal server error'
      })}\n\n`);
    } finally {
      console.log('Ending response stream');
      responseStream.end();
    }
  }
);

// Handle streaming request and write to responseStream
async function handleStreamingRequest(event, responseStream) {
  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const {
      message,
      conversationId,
      language = 'auto',
      sessionId = generateSessionId(),
      userId = 'anonymous'
    } = body;

    if (!message) {
      responseStream.write('data: {"type": "error", "error": "Message is required"}\n\n');
      return;
    }

    // Generate unique query ID for analytics
    const queryId = generateQueryId();
    const timestamp = Date.now();

    // Step 1: Initialize language variables (detection happens during translation)
    let detectedLanguage = language === 'auto' ? 'en' : language;
    let originalLanguage = language === 'auto' ? 'en' : language;

    // Step 2: Translate query to English if needed (for better RAG performance)
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

        // Extract detected language from auto-detection
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

    // Step 3: Retrieve relevant context from Knowledge Base
    const ragStartTime = Date.now();
    let ragResponse;
    let citations = [];
    let retrievedContext = '';
    
    try {
      // First, retrieve relevant chunks from Knowledge Base
      const retrieveCommand = new RetrieveCommand({
        knowledgeBaseId: KNOWLEDGE_BASE_ID,
        retrievalQuery: {
          text: queryInEnglish
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 10 // Get more context for rich storytelling
          }
        }
      });

      const retrieveResult = await bedrockAgentClient.send(retrieveCommand);
      
      // Process retrieved chunks and build context
      if (retrieveResult.retrievalResults && retrieveResult.retrievalResults.length > 0) {
        // Extract citations with proper metadata and generate obfuscated document URLs
        citations = await Promise.all(retrieveResult.retrievalResults.map(async (result, index) => {
          const s3Uri = result.location?.s3Location?.uri || '';

          // Extract original PDF filename from the processed JSON path
          // Example: s3://bucket/output/processed-text/doc-123/1981.pdf.json -> 1981.pdf
          let pdfFilename = 'Document';
          let documentAccessUrl = null;

          if (s3Uri) {
            const match = s3Uri.match(/\/([^/]+)\.pdf\.json$/);
            if (match) {
              pdfFilename = match[1] + '.pdf';

              // Generate UUID to obfuscate S3 details
              const documentId = randomUUID();
              const bucket = process.env.DOCUMENTS_BUCKET;
              const key = `input/${pdfFilename}`;

              // Store UUID -> S3 location mapping in DynamoDB with TTL
              try {
                const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
                await dynamoClient.send(new PutCommand({
                  TableName: DOCUMENT_MAPPINGS_TABLE,
                  Item: {
                    documentId: documentId,
                    itemType: 'document-mapping',
                    bucket: bucket,
                    key: key,
                    createdAt: Date.now(),
                    expiresAt: expiresAt
                  }
                }));

                // Return obfuscated URL path (API Gateway will handle /documents/:id route)
                documentAccessUrl = `/documents/${documentId}`;
              } catch (error) {
                console.warn(`Failed to store document mapping for ${pdfFilename}:`, error);
              }
            }
          }

          // Use UUID to hide sensitive filename information
          const displayId = randomUUID();

          return {
            id: `source-${index + 1}`,
            title: `Document-${displayId}`,
            source: `YMCA Historical Archives`,
            sourceUrl: documentAccessUrl,
            confidence: result.score || 0.8,
            excerpt: result.content?.text?.substring(0, 300) + '...' || '',
            fullText: result.content?.text || ''
          };
        }));

        // Build rich context from retrieved chunks
        retrievedContext = retrieveResult.retrievalResults
          .map((result, index) => `[Source ${index + 1}]: ${result.content?.text || ''}`)
          .join('\n\n');

        console.log(`Retrieved ${retrieveResult.retrievalResults.length} relevant chunks`);
      }

      // Step 4: Generate response using retrieved context with enhanced prompting
      const enhancedPrompt = `You are a knowledgeable YMCA historian and storyteller with deep expertise in YMCA history, programs, and community impact. Your role is to transform archival materials into engaging, accessible narratives that inspire present-day reflection and decision-making.

RETRIEVED CONTEXT FROM YMCA ARCHIVES:
${retrievedContext}

USER QUESTION: ${queryInEnglish}

RESPONSE REQUIREMENTS:
1. **STORYTELLING APPROACH**: Don't just answer - tell a compelling story that brings history to life
2. **USE THE CONTEXT**: Base your response primarily on the retrieved archival materials above
3. **NARRATIVE STRUCTURE**: Create an engaging story with clear flow
4. **HISTORICAL CONTEXT**: Provide rich background and connect events to broader themes
5. **HUMAN ELEMENTS**: Include specific people, dates, locations, and personal stories from the context
6. **CITE SOURCES WITH PAGES**: Reference sources like [Source 1, p.15] or [Source 2, pp.23-24] in your narrative. Extract page numbers from the source metadata if available.
7. **UNIQUE INSIGHTS**: If this is a follow-up question, provide NEW information and perspectives not covered in previous responses. Avoid repeating the same historical facts.
8. **CONVERSATION STARTERS**: Generate 3 engaging, SPECIFIC questions that explore different angles, time periods, or themes NOT covered in this response

RESPONSE FORMAT (JSON):
{
  "story": {
    "title": "Engaging title that captures the essence of the historical moment",
    "narrative": "Rich, multi-paragraph storytelling response that weaves together information from the sources. Include specific dates, names, places, and events. Reference sources like [Source 1, p.15] naturally within the narrative.",
    "timeline": "Key dates and periods mentioned in the sources",
    "locations": "Specific places mentioned in the retrieved context",
    "keyPeople": "Important individuals and their roles as mentioned in the sources",
    "whyItMatters": "Modern relevance and lessons for today's YMCA work"
  },
  "lessonsAndThemes": [
    "Key insight or lesson drawn from the historical evidence",
    "Another important theme or pattern from the sources"
  ],
  "modernReflection": "How this historical moment teaches us about today's challenges and opportunities in YMCA work",
  "exploreFurther": [
    "Specific question exploring a different time period or theme",
    "Question about a different aspect not covered above",
    "Question that connects to a different YMCA program or initiative"
  ],
  "citedSources": [1, 2, 5]
}

TONE: Engaging, authoritative, and inspiring. Write as if you're a passionate historian sharing fascinating discoveries from newly uncovered archives. Use vivid language and specific details from the sources to make history come alive.

IMPORTANT:
- Include a "citedSources" array listing ONLY the source numbers you actually referenced in your narrative
- Include page numbers in citations when available from the source metadata
- If this is a follow-up question, focus on NEW aspects not previously discussed
- If the retrieved context doesn't contain enough information, acknowledge this honestly
- Always ground your response in the actual retrieved sources
- Don't invent facts not present in the context
- If sources conflict, acknowledge different perspectives`;

      // Use streaming for real-time response
      const streamCommand = new InvokeModelWithResponseStreamCommand({
        modelId: 'us.amazon.nova-pro-v1:0',
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [{ text: enhancedPrompt }]
          }],
          inferenceConfig: {
            maxTokens: 3000,
            temperature: 0.7
          }
        })
      });

      const streamResult = await bedrockRuntimeClient.send(streamCommand);
      let generatedText = '';

      // Process stream chunks and format as Server-Sent Events
      for await (const chunk of streamResult.body) {
        if (chunk.chunk?.bytes) {
          const chunkText = new TextDecoder().decode(chunk.chunk.bytes);
          try {
            const chunkJson = JSON.parse(chunkText);

            // Handle Nova contentBlockDelta events (text chunks)
            if (chunkJson.contentBlockDelta?.delta?.text) {
              const textChunk = chunkJson.contentBlockDelta.delta.text;
              generatedText += textChunk;

              // Write as Server-Sent Event to responseStream
              const sseData = `data: ${JSON.stringify({
                type: 'chunk',
                content: textChunk
              })}\n\n`;
              responseStream.write(sseData);
              console.log('Wrote chunk to stream, length:', textChunk.length);
            }
            else if (chunkJson.messageStart) {
              console.log('Message started');
            }
            else if (chunkJson.messageStop) {
              console.log('Message stopped, stop reason:', chunkJson.messageStop.stopReason);
            }
          } catch (parseError) {
            console.warn('Failed to parse chunk:', chunkText, parseError);
          }
        }
      }

      // Try to parse as JSON first, fallback to structured text if needed
      try {
        const jsonResponse = JSON.parse(generatedText);
        ragResponse = {
          type: 'structured',
          content: jsonResponse,
          rawText: generatedText
        };
      } catch (parseError) {
        console.warn('Response not in JSON format, structuring as narrative');
        ragResponse = {
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
      
      console.log('RAG response generated successfully using Retrieve API');
      console.log('Citations processed:', citations.length);
      
    } catch (error) {
      console.error('RAG query failed:', error);
      
      // Simple error response
      ragResponse = {
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

    const ragEndTime = Date.now();

    // Step 4: Translate response back to original language if needed
    let finalResponse = ragResponse;
    if (originalLanguage !== 'en' && SUPPORTED_LANGUAGES[originalLanguage]) {
      try {
        // For structured responses, translate ALL text fields
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

          // Translate all texts in batch
          const translatedTexts = [];
          for (const text of textsToTranslate) {
            const translateCmd = new TranslateTextCommand({
              Text: text,
              SourceLanguageCode: 'en',
              TargetLanguageCode: originalLanguage
            });
            const result = await translateClient.send(translateCmd);
            translatedTexts.push(result.TranslatedText);
          }

          // Reconstruct response with translated texts
          let textIndex = 0;
          finalResponse = {
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
    }

    // Step 5: Store conversation in DynamoDB with enhanced metadata
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
          processingTimeMs: ragEndTime - ragStartTime,
          citationsCount: citations.length,
          sources: citations
        }
      }));
    } catch (error) {
      console.error('Failed to store conversation:', error);
    }

    // Step 6: Store enhanced analytics
    try {
      await dynamoClient.send(new PutCommand({
        TableName: ANALYTICS_TABLE,
        Item: {
          queryId: queryId,
          timestamp: timestamp,
          userId: userId,
          sessionId: sessionId,
          conversationId: conversationId || sessionId,
          language: originalLanguage,
          queryLength: message.length,
          responseLength: JSON.stringify(finalResponse.content).length,
          processingTimeMs: ragEndTime - ragStartTime,
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

    // Filter sources to only include cited ones
    const citedSourceIndices = finalResponse.content.citedSources || [];
    const filteredCitations = citedSourceIndices.length > 0
      ? citations.filter((_, index) => citedSourceIndices.includes(index + 1))
      : citations;

    // Send final structured response
    const responseData = {
      response: finalResponse.content,
      responseType: finalResponse.type,
      rawResponse: finalResponse.rawText,
      sources: filteredCitations,
      conversationId: conversationId || sessionId,
      sessionId: sessionId,
      language: originalLanguage,
      processingTime: ragEndTime - ragStartTime,
      translationUsed: originalLanguage !== 'en',
      timestamp: new Date(timestamp).toISOString(),
      metadata: {
        knowledgeBaseUsed: true,
        citationsFound: filteredCitations.length,
        responseStructured: finalResponse.type === 'structured',
        fallbackUsed: finalResponse.fallback || false
      }
    };

    // Send completion event with final structured response
    console.log('Sending completion event with response data');
    responseStream.write(`data: ${JSON.stringify({
      type: 'complete',
      response: responseData
    })}\n\n`);

    // Send done signal
    console.log('Sending [DONE] signal');
    responseStream.write('data: [DONE]\n\n');

  } catch (error) {
    console.error('Streaming request error:', error);

    // Store error analytics
    try {
      await dynamoClient.send(new PutCommand({
        TableName: ANALYTICS_TABLE,
        Item: {
          queryId: generateQueryId(),
          timestamp: Date.now(),
          userId: 'unknown',
          error: error.message,
          success: false
        }
      }));
    } catch (analyticsError) {
      console.error('Failed to store error analytics:', analyticsError);
    }

    const errorResponse = {
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
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };

    responseStream.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message,
      response: errorResponse
    })}\n\n`);
  }
}

// Helper functions
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

// Document retrieval handler - resolves UUID to pre-signed S3 URL
exports.documentHandler = async (event, context) => {
  console.log('Document handler called with event:', JSON.stringify(event, null, 2));

  try {
    // Extract document ID from path parameters
    const documentId = event.pathParameters?.documentId || event.pathParameters?.id;

    if (!documentId) {
      return createResponse(400, { error: 'Document ID is required' });
    }

    // Look up document mapping in DynamoDB
    const getResult = await dynamoClient.send(new GetCommand({
      TableName: DOCUMENT_MAPPINGS_TABLE,
      Key: {
        documentId: documentId
      }
    }));

    if (!getResult.Item) {
      return createResponse(404, { error: 'Document not found or expired' });
    }

    const { bucket, key, expiresAt } = getResult.Item;

    // Check if mapping has expired
    if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) {
      return createResponse(410, { error: 'Document access has expired' });
    }

    // Generate pre-signed URL for the document
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Redirect to the pre-signed URL
    return {
      statusCode: 302,
      headers: {
        'Location': presignedUrl,
        'Access-Control-Allow-Origin': '*'
      },
      body: ''
    };

  } catch (error) {
    console.error('Document handler error:', error);
    return createResponse(500, { error: 'Failed to retrieve document' });
  }
};