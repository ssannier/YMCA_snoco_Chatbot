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
https://[FUNCTION_ID].lambda-url.[REGION].on.aws/
```

> **Note**: Replace with your actual Lambda Function URL after deployment. Find this in CDK outputs as `StreamingFunctionUrl`.

**Example**:
```
https://xyz789abc123.lambda-url.us-west-2.on.aws/
```

---

## Authentication

**Current**: The chat endpoint is currently public (no authentication required for chat).

**Admin Features**: Document uploads require Cognito authentication:
- Users authenticate via Cognito User Pool to get temporary AWS credentials
- Credentials used for direct S3 uploads via AWS SDK

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

## 1) Chat Endpoint

The chat endpoint provides conversational AI capabilities with RAG-powered responses and real-time streaming.

---

### POST / — Streaming Chat (Lambda Function URL)

- **Purpose**: Send a chat message and receive a streaming response with native Lambda streaming support

- **Endpoint**: `POST /` (Lambda Function URL root)

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
  - `chunk`: Partial text content from AI (streamed token-by-token)
  - `complete`: Final structured response with all metadata and sources
  - `error`: Error event if processing fails
  - `[DONE]`: End of stream marker

- **Complete Response Structure** (sent with `type: "complete"`):
```json
{
  "type": "complete",
  "response": {
    "response": {
      "story": {
        "title": "YMCA's Service During World War II",
        "narrative": "During World War II, the YMCA played a vital role...",
        "timeline": "1941-1945",
        "locations": "Military bases worldwide, USO centers",
        "keyPeople": "YMCA volunteers, military chaplains",
        "whyItMatters": "The YMCA's wartime service established its role..."
      },
      "lessonsAndThemes": ["Community resilience", "Supporting military families"],
      "modernReflection": "Today, the YMCA continues to support veterans...",
      "exploreFurther": ["What programs did the YMCA offer at USO centers?"],
      "citedSources": [{"id": 1, "title": "YMCA_WWII_History.pdf", "excerpt": "..."}]
    },
    "responseType": "structured",
    "sources": [
      {
        "id": 1,
        "title": "YMCA_WWII_History.pdf",
        "source": "YMCA Historical Archives",
        "sourceUrl": "https://ymca-documents-123.s3.amazonaws.com/...",
        "confidence": 0.92,
        "excerpt": "The YMCA operated hundreds of centers..."
      }
    ],
    "conversationId": "conv-abc123",
    "sessionId": "sess-xyz789",
    "language": "en",
    "processingTime": 3450,
    "translationUsed": false,
    "timestamp": "2025-01-13T12:34:56.789Z",
    "metadata": {
      "knowledgeBaseUsed": true,
      "citationsFound": 3,
      "responseStructured": true,
      "fallbackUsed": false
    }
  }
}
```

- **Advantages of Lambda Function URL**:
  - ✅ **15-minute timeout** (no 30-second limit)
  - ✅ **Native Lambda streaming** (RESPONSE_STREAM invoke mode)
  - ✅ **Better performance** - No API Gateway overhead
  - ✅ **Direct invocation** - Lower latency
  - ✅ **Cost-effective** - No API Gateway charges

- **Status codes**:
  - `200 OK` - Successful streaming response
  - `400 Bad Request` - Missing required fields (message)
  - `500 Internal Server Error` - Server error

---

## 2) Document Upload (Direct S3)

### Direct S3 Upload — Upload Document for Processing

- **Purpose**: Upload documents (PDF, images) to the knowledge base for processing

- **Method**: Direct S3 upload using AWS SDK with Cognito credentials

- **Authentication**:
  - Users authenticate via Cognito User Pool
  - Cognito Identity Pool provides temporary AWS credentials
  - Credentials scoped to allow `s3:PutObject` on `input/` prefix only

- **Frontend Implementation** (using AWS SDK v3):
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fetchAuthSession } from 'aws-amplify/auth';

// Get Cognito credentials
const session = await fetchAuthSession();
const credentials = session.credentials;

// Create S3 client
const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: credentials,
});

// Upload file
const command = new PutObjectCommand({
  Bucket: process.env.NEXT_PUBLIC_DOCUMENTS_BUCKET,
  Key: `input/${fileName}`,
  Body: fileBuffer,
  ContentType: 'application/pdf',
});

await s3Client.send(command);
```

- **Processing Flow**:
  1. File uploaded directly to S3 `input/` prefix
  2. S3 event triggers batch processor Lambda
  3. Step Functions workflow starts
  4. Textract extracts text from document
  5. Processed text saved to `output/processed-text/` prefix
  6. Bedrock Knowledge Base automatically ingests new documents

- **Supported File Types**:
  - **PDF**: `.pdf` (uses Textract document analysis)
  - **Images**: `.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif` (uses Textract text detection)

- **Advantages**:
  - ✅ **Direct upload** - No Lambda/API Gateway intermediary
  - ✅ **Large file support** - No size limits beyond S3 (5TB max)
  - ✅ **Secure** - Scoped IAM permissions via Cognito
  - ✅ **Cost-effective** - No API Gateway/Lambda charges for uploads

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
- Configure Lambda reserved concurrency to limit concurrent executions
- Implement application-level rate limiting (e.g., by session ID or IP)
- Monitor Lambda concurrent executions (default: 1000 per region)
- Use AWS WAF for IP-based rate limiting if needed

---

## SDK / Client Examples

### JavaScript/TypeScript (Frontend)

#### Streaming Chat
```typescript
const response = await fetch('https://[LAMBDA_FUNCTION_URL]/', {
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

#### Streaming Chat
```python
import requests
import json

response = requests.post(
    'https://[LAMBDA_FUNCTION_URL]/',
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

#### Streaming Chat
```bash
curl -X POST 'https://[LAMBDA_FUNCTION_URL]/' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Tell me about YMCA history",
    "language": "en"
  }' \
  --no-buffer
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
