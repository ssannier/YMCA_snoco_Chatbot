# YMCA AI Chatbot APIs

This document provides comprehensive API documentation for the YMCA AI Chatbot.

---

## Overview

The YMCA AI Chatbot provides RESTful APIs for conversational AI with multilingual support and RAG (Retrieval-Augmented Generation) capabilities. The API leverages Amazon Bedrock for AI inference, Knowledge Base for context retrieval, and Amazon Translate for multi-language support.

**Key Features**:
- Multi-language support (12 languages)
- Streaming and non-streaming responses
- Context-aware conversation with citation sources
- Automatic language detection and translation
- Analytics and conversation tracking

---

## Base URL

```
https://[API_ID].execute-api.[REGION].amazonaws.com/prod/
```

> **Note**: Replace with your actual API Gateway endpoint after deployment. Find this in CDK outputs as `ApiEndpoint`.

**Example**:
```
https://abc123def456.execute-api.us-west-2.amazonaws.com/prod/
```

---

## Authentication

**Current**: The chat endpoints are currently public (no authentication required).

**Optional**: You can add authentication by:
- Enabling API Keys in API Gateway
- Adding Cognito Authorizer for the chat endpoint
- Implementing custom Lambda authorizer

### Headers Required

| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | Must be `application/json` | Yes |

**Optional Headers**:
| Header | Description | Required |
|--------|-------------|----------|
| `X-User-ID` | Custom user identifier for analytics | No |
| `X-Session-ID` | Custom session identifier | No |

---

## 1) Chat Endpoints

The chat endpoints provide conversational AI capabilities with RAG-powered responses.

---

### POST /chat — Non-Streaming Chat

- **Purpose**: Send a chat message and receive a complete response

- **Endpoint**: `POST /chat`

- **Request body**:
```json
{
  "message": "string - The user's message/question (required)",
  "conversationId": "string - Conversation ID for threading (optional)",
  "language": "string - Target language code (optional, default: 'auto')",
  "sessionId": "string - Session identifier (optional)",
  "userId": "string - User identifier (optional, default: 'anonymous')"
}
```

- **Example request**:
```json
{
  "message": "What was the YMCA's role in World War II?",
  "conversationId": "conv-abc123",
  "language": "en"
}
```

- **Response**:
```json
{
  "response": {
    "story": {
      "title": "string - Response title",
      "narrative": "string - Main response content",
      "timeline": "string - Historical timeline information",
      "locations": "string - Relevant locations",
      "keyPeople": "string - Important people mentioned",
      "whyItMatters": "string - Significance of the information"
    },
    "lessonsAndThemes": ["string - Array of key themes"],
    "modernReflection": "string - Modern context and relevance",
    "exploreFurther": ["string - Array of suggested follow-up questions"],
    "citedSources": [
      {
        "id": "number - Source ID",
        "title": "string - Source document title",
        "excerpt": "string - Brief excerpt from source"
      }
    ]
  },
  "responseType": "string - 'structured' or 'narrative' or 'error'",
  "rawResponse": "string - Original AI response text",
  "sources": [
    {
      "id": "number - Source ID",
      "title": "string - Document title",
      "source": "string - Source type (e.g., 'YMCA Historical Archives')",
      "sourceUrl": "string - Pre-signed S3 URL for document (5-min expiration)",
      "confidence": "number - Relevance score (0-1)",
      "fullText": "string - Full text content from source",
      "excerpt": "string - Short excerpt (first 300 chars)"
    }
  ],
  "conversationId": "string - Conversation ID (returned or generated)",
  "sessionId": "string - Session ID (returned or generated)",
  "language": "string - Detected/used language code",
  "processingTime": "number - Processing time in milliseconds",
  "translationUsed": "boolean - Whether translation was used",
  "timestamp": "string - ISO 8601 timestamp",
  "metadata": {
    "knowledgeBaseUsed": "boolean - Whether knowledge base was queried",
    "citationsFound": "number - Number of citations found",
    "responseStructured": "boolean - Whether response is structured JSON",
    "fallbackUsed": "boolean - Whether fallback response was used"
  }
}
```

- **Example response**:
```json
{
  "response": {
    "story": {
      "title": "YMCA's Service During World War II",
      "narrative": "During World War II, the YMCA played a vital role in supporting both military personnel and their families...",
      "timeline": "1941-1945",
      "locations": "Military bases worldwide, USO centers, training camps",
      "keyPeople": "YMCA volunteers, military chaplains, community organizers",
      "whyItMatters": "The YMCA's wartime service established its role as a community anchor during national crises."
    },
    "lessonsAndThemes": [
      "Community resilience during wartime",
      "Supporting military families",
      "Global humanitarian outreach"
    ],
    "modernReflection": "Today, the YMCA continues to support military families and veterans through specialized programs.",
    "exploreFurther": [
      "What programs did the YMCA offer at USO centers?",
      "How did the YMCA support families on the home front?",
      "Tell me about YMCA programs for veterans today"
    ],
    "citedSources": [
      {
        "id": 1,
        "title": "YMCA_WWII_History.pdf",
        "excerpt": "The YMCA operated hundreds of centers near military bases..."
      }
    ]
  },
  "responseType": "structured",
  "sources": [
    {
      "id": 1,
      "title": "YMCA_WWII_History.pdf",
      "source": "YMCA Historical Archives",
      "sourceUrl": "https://ymca-documents-123456-us-west-2.s3.us-west-2.amazonaws.com/input/YMCA_WWII_History.pdf?X-Amz-...",
      "confidence": 0.92,
      "excerpt": "The YMCA operated hundreds of centers near military bases providing recreation..."
    }
  ],
  "conversationId": "conv-abc123",
  "sessionId": "sess-xyz789",
  "language": "en",
  "processingTime": 3450,
  "translationUsed": false,
  "timestamp": "2025-01-07T12:34:56.789Z",
  "metadata": {
    "knowledgeBaseUsed": true,
    "citationsFound": 3,
    "responseStructured": true,
    "fallbackUsed": false
  }
}
```

- **Status codes**:
  - `200 OK` - Successful response with AI-generated content
  - `400 Bad Request` - Missing required fields (message)
  - `500 Internal Server Error` - Server error, returns error response structure

---

### POST /chat-stream — Streaming Chat (API Gateway)

- **Purpose**: Send a chat message and receive a streaming response

- **Endpoint**: `POST /chat-stream`

- **Request body**: Same as `/chat` endpoint

- **Response**: Server-Sent Events (SSE) stream

- **Stream Format**:
```
data: {"type":"chunk","content":"The YMCA"}

data: {"type":"chunk","content":" played"}

data: {"type":"chunk","content":" a vital role..."}

data: {"type":"complete","response":{...full response object...}}

data: [DONE]
```

- **Event Types**:
  - `chunk`: Partial text content from AI
  - `complete`: Final structured response with all metadata
  - `[DONE]`: End of stream marker

- **Limitations**:
  - API Gateway has 30-second timeout
  - For long responses, use Lambda Function URL instead

---

### Lambda Function URL — Streaming Chat (Recommended)

- **Purpose**: Streaming chat with native Lambda response streaming (no timeout limits)

- **Endpoint**: Available in CDK output as `StreamingFunctionUrl`

- **Example**: `https://xyz789.lambda-url.us-west-2.on.aws/`

- **Request**: Same as `/chat` endpoint (POST with JSON body)

- **Response**: Same SSE format as `/chat-stream`

- **Advantages**:
  - 15-minute timeout (vs 30 seconds for API Gateway)
  - Native Lambda streaming support
  - Better performance for long responses
  - No intermediary (direct Lambda invocation)

---

## 2) Document Upload Endpoint

### PUT /upload/{key} — Upload Document for Processing

- **Purpose**: Upload documents (PDF, images) to the knowledge base for processing

- **Endpoint**: `PUT /upload/{key}`

- **Path parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Filename for the uploaded document |

- **Headers**:
| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | MIME type of the file (e.g., `application/pdf`, `image/png`) | Yes |

- **Request body**: Binary file content

- **Example request**:
```bash
curl -X PUT "https://[API_ID].execute-api.[REGION].amazonaws.com/prod/upload/ymca_history.pdf" \
  -H "Content-Type: application/pdf" \
  --data-binary "@ymca_history.pdf"
```

- **Response**:
```json
{
  "message": "File uploaded successfully",
  "key": "ymca_history.pdf",
  "bucket": "ymca-documents-{account}-{region}",
  "location": "s3://ymca-documents-{account}-{region}/input/ymca_history.pdf"
}
```

- **Processing Flow**:
  1. File uploaded to S3 `input/` prefix
  2. S3 event triggers batch processor Lambda
  3. Step Functions workflow starts
  4. Textract extracts text from document
  5. Processed text saved to `output/processed-text/` prefix
  6. Bedrock Knowledge Base automatically ingests new documents

- **Supported File Types**:
  - **PDF**: `.pdf` (uses Textract document analysis)
  - **Images**: `.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif` (uses Textract text detection)

- **Status codes**:
  - `200 OK` - File uploaded successfully
  - `400 Bad Request` - Invalid file type or missing content
  - `403 Forbidden` - Access denied
  - `500 Internal Server Error` - Upload failed

---

## Response Format

All API responses follow this general structure:

### Success Response (Chat Endpoints)
```json
{
  "response": {
    "story": {...},
    "lessonsAndThemes": [...],
    "modernReflection": "...",
    "exploreFurther": [...],
    "citedSources": [...]
  },
  "responseType": "structured" | "narrative" | "error",
  "sources": [...],
  "metadata": {...}
}
```

### Error Response
```json
{
  "response": {
    "story": {
      "title": "Technical Difficulties",
      "narrative": "Error message explaining what went wrong",
      "whyItMatters": "Explanation of impact"
    },
    "exploreFurther": ["Suggested actions or alternative questions"]
  },
  "responseType": "error",
  "error": "Error message string",
  "timestamp": "ISO 8601 timestamp"
}
```

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| `400` | Bad Request | Missing required parameters (e.g., `message` field) |
| `403` | Forbidden | Access denied (e.g., invalid API key if enabled) |
| `500` | Internal Server Error | Server-side error (knowledge base unavailable, Bedrock error, etc.) |
| `502` | Bad Gateway | Lambda function error or timeout |
| `504` | Gateway Timeout | Request timeout (use streaming endpoint for long requests) |

---

## Supported Languages

The API supports automatic translation for the following languages:

| Code | Language |
|------|----------|
| `en` | English |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `it` | Italian |
| `pt` | Portuguese |
| `zh` | Chinese |
| `ja` | Japanese |
| `ko` | Korean |
| `ar` | Arabic |
| `hi` | Hindi |
| `ru` | Russian |
| `auto` | Auto-detect (default) |

**Language Flow**:
1. User sends message in any supported language
2. API auto-detects language (if `language: "auto"`)
3. Message translated to English for knowledge base retrieval
4. AI generates response in English
5. Response translated back to user's original language

---

## Rate Limiting

**Current**: No rate limiting enforced

**Recommended for Production**:
- Enable API Gateway throttling:
  - **Requests per second**: 1000 (default)
  - **Burst limit**: 2000 (default)
- Configure per-user or per-IP limits using API keys
- Monitor Lambda concurrent executions (default: 1000 per region)

---

## SDK / Client Examples

### JavaScript/TypeScript (Frontend)

#### Non-Streaming Chat
```typescript
const response = await fetch('https://[API_URL]/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'What was the YMCA\'s role in World War II?',
    conversationId: 'conv-123',
    language: 'en'
  })
});

const data = await response.json();
console.log(data.response.story.narrative);
console.log('Sources:', data.sources);
```

#### Streaming Chat
```typescript
const response = await fetch('https://[STREAMING_URL]/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Tell me about YMCA history',
    language: 'en'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        console.log('Stream complete');
        break;
      }

      try {
        const event = JSON.parse(data);
        if (event.type === 'chunk') {
          process.stdout.write(event.content);
        } else if (event.type === 'complete') {
          console.log('\nFull response:', event.response);
        }
      } catch (e) {
        // Ignore parse errors for incomplete chunks
      }
    }
  }
}
```

### Python

#### Non-Streaming Chat
```python
import requests
import json

response = requests.post(
    'https://[API_URL]/chat',
    headers={'Content-Type': 'application/json'},
    json={
        'message': 'What was the YMCA\'s role in World War II?',
        'conversationId': 'conv-123',
        'language': 'en'
    }
)

data = response.json()
print(data['response']['story']['narrative'])
print('Sources:', data['sources'])
```

#### Streaming Chat
```python
import requests
import json

response = requests.post(
    'https://[STREAMING_URL]/',
    headers={'Content-Type': 'application/json'},
    json={
        'message': 'Tell me about YMCA history',
        'language': 'en'
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data == '[DONE]':
                print('\nStream complete')
                break

            try:
                event = json.loads(data)
                if event['type'] == 'chunk':
                    print(event['content'], end='', flush=True)
                elif event['type'] == 'complete':
                    print('\nFull response:', event['response'])
            except json.JSONDecodeError:
                pass
```

### cURL

#### Non-Streaming Chat
```bash
curl -X POST 'https://[API_URL]/chat' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What was the YMCA'\''s role in World War II?",
    "conversationId": "conv-123",
    "language": "en"
  }'
```

#### Streaming Chat
```bash
curl -X POST 'https://[STREAMING_URL]/' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Tell me about YMCA history",
    "language": "en"
  }' \
  --no-buffer
```

#### Upload Document
```bash
curl -X PUT 'https://[API_URL]/upload/ymca_history.pdf' \
  -H 'Content-Type: application/pdf' \
  --data-binary '@ymca_history.pdf'
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-07 | Initial API release with streaming and non-streaming chat, document upload, multi-language support |

---

## Support

For API-related issues or questions:
- Check the [Deployment Guide](./deploymentGuide.md) for setup instructions
- Review the [Architecture Deep Dive](./architectureDeepDive.md) for system details
- See the [Streaming Integration Guide](./streamingIntegration.md) for streaming configuration
- Open an issue on GitHub: https://github.com/ASUCICREPO/YMCA_snoco_Chatbot/issues
