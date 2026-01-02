const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
const { TranslateClient, TranslateTextCommand, DetectDominantLanguageCommand } = require('@aws-sdk/client-translate');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { Writable } = require('stream');

// Initialize AWS clients
const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: process.env.REGION || 'us-west-2' });
const bedrockRuntimeClient = new BedrockRuntimeClient({ region: process.env.REGION || 'us-west-2' });
const translateClient = new TranslateClient({ region: process.env.REGION || 'us-west-2' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION || 'us-west-2' }));

// Configuration
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const CONVERSATION_TABLE = process.env.CONVERSATION_TABLE_NAME;
const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE_NAME;

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

    // Step 1: Detect language if auto-detection is enabled
    let detectedLanguage = 'en';
    let originalLanguage = 'en';
    
    if (language === 'auto') {
      try {
        const detectCommand = new DetectDominantLanguageCommand({
          Text: message
        });
        const detectResult = await translateClient.send(detectCommand);
        
        if (detectResult.Languages && detectResult.Languages.length > 0) {
          detectedLanguage = detectResult.Languages[0].LanguageCode;
          originalLanguage = detectedLanguage;
        }
      } catch (error) {
        console.warn('Language detection failed, defaulting to English:', error);
      }
    } else {
      detectedLanguage = language;
      originalLanguage = language;
    }

    console.log(`Detected language: ${detectedLanguage} (${SUPPORTED_LANGUAGES[detectedLanguage] || 'Unknown'})`);

    // Step 2: Translate query to English if needed (for better RAG performance)
    let queryInEnglish = message;
    if (detectedLanguage !== 'en') {
      try {
        const translateCommand = new TranslateTextCommand({
          Text: message,
          SourceLanguageCode: detectedLanguage,
          TargetLanguageCode: 'en'
        });
        const translateResult = await translateClient.send(translateCommand);
        queryInEnglish = translateResult.TranslatedText;
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
        // Extract citations with proper metadata
        citations = retrieveResult.retrievalResults.map((result, index) => ({
          id: `source-${index + 1}`,
          title: `YMCA Historical Document ${index + 1}`,
          source: result.location?.s3Location?.uri || 'YMCA Archives',
          confidence: result.score || 0.8,
          excerpt: result.content?.text?.substring(0, 300) + '...' || '',
          fullText: result.content?.text || ''
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
  "suggestedFollowUps": [
    "Thoughtful follow-up question based on the historical content",
    "Another question that would help explore related historical themes"
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
            suggestedFollowUps: [
              "What other historical periods would you like to explore?",
              "How did the YMCA adapt to other major challenges?"
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
          suggestedFollowUps: [
            "Try asking your question again",
            "Contact your local YMCA for historical information"
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
        // For structured responses, translate the narrative parts
        if (ragResponse.type === 'structured' || ragResponse.type === 'narrative') {
          const textToTranslate = ragResponse.content.story.narrative;
          const translateResponseCommand = new TranslateTextCommand({
            Text: textToTranslate,
            SourceLanguageCode: 'en',
            TargetLanguageCode: originalLanguage
          });
          const translateResponseResult = await translateClient.send(translateResponseCommand);
          
          // Create translated version while preserving structure
          finalResponse = {
            ...ragResponse,
            content: {
              ...ragResponse.content,
              story: {
                ...ragResponse.content.story,
                narrative: translateResponseResult.TranslatedText
              }
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
        suggestedFollowUps: [
          "Try rephrasing your question",
          "Contact your local YMCA directly"
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

// Standard handler (non-streaming) - for REST API
exports.handler = async (event) => {
  return await handleRequest(event, null);
};

// Streaming handler - for API Gateway with response streaming
exports.streamingHandler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    // Write status code and padding as required by API Gateway
    responseStream.write('{"statusCode": 200}');
    responseStream.write("\x00".repeat(8));

    await handleRequest(event, responseStream);
  }
);

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