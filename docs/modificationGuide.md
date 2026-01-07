# Project Modification Guide

This guide is for developers who want to extend, customize, or modify the YMCA AI Chatbot.

---

## Introduction

This document provides guidance on how to modify and extend the YMCA AI Chatbot. Whether you want to add new features, change existing behavior, or customize the application for your needs, this guide will help you understand the codebase and make changes effectively.

---

## Table of Contents

- [Project Structure Overview](#project-structure-overview)
- [Frontend Modifications](#frontend-modifications)
- [Backend Modifications](#backend-modifications)
- [Adding New Features](#adding-new-features)
- [Changing AI/ML Models](#changing-aiml-models)
- [Database Modifications](#database-modifications)
- [Best Practices](#best-practices)

---

## Project Structure Overview

```
YMCA_Scono_chatbot/
├── backend/
│   ├── bin/
│   │   └── backend.ts                     # CDK app entry point
│   ├── lib/
│   │   └── backend-stack.ts               # Main CDK stack (infrastructure)
│   ├── lambda/
│   │   ├── agent-proxy/                   # RAG Lambda (chat functionality)
│   │   │   ├── index.js                   # Main handler
│   │   │   └── package.json
│   │   ├── batch-processor/               # Document ingestion trigger
│   │   ├── textract-async/                # Textract job starter
│   │   ├── check-textract-status/         # Status checker
│   │   └── textract-postprocessor/        # Result processor
│   ├── .env                               # Environment variables
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── page.tsx                       # Homepage
│   │   ├── layout.tsx                     # Root layout
│   │   ├── globals.css                    # Global styles
│   │   ├── chat/
│   │   │   └── page.tsx                   # Chat page
│   │   ├── admin/
│   │   │   └── page.tsx                   # Admin dashboard
│   │   ├── hooks/
│   │   │   └── useChat.ts                 # Chat hook
│   │   └── context/
│   │       └── ChatContext.tsx            # Chat context
│   ├── lib/
│   │   ├── api-service.ts                 # API calls
│   │   ├── i18n.ts                        # Internationalization
│   │   └── utils.ts                       # Utility functions
│   ├── components/
│   │   └── ConfigureAmplify.tsx           # Amplify configuration
│   └── package.json
├── docs/                                  # Documentation
└── CLAUDE.md                              # Development guidelines
```

---

## Frontend Modifications

### Changing the UI Theme

**Location**: `frontend/app/globals.css`

The application uses Tailwind CSS v4 with custom colors defined in the globals.css file.

**Example: Change Primary Colors**
```css
@import "tailwindcss";

/* Add custom colors */
@theme {
  --color-ymca-blue: #0089d0;     /* Change this to your color */
  --color-ymca-teal: #01a490;
  --color-ymca-orange: #f47920;
  --color-ymca-purple: #92278f;
}
```

**Usage in components**:
```tsx
<div className="bg-[--color-ymca-blue] text-white">
  Your content
</div>
```

### Adding New Pages

**Location**: `frontend/app/`

Next.js uses file-based routing with the App Router.

**Steps**:
1. Create a new directory in `frontend/app/` (e.g., `about/`)
2. Add a `page.tsx` file
3. Export a default React component

**Example** (`frontend/app/about/page.tsx`):
```tsx
export default function AboutPage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">About YMCA</h1>
      <p>Your content here</p>
    </div>
  );
}
```

The page will be accessible at `/about`.

### Modifying the Chat Interface

**Location**: `frontend/app/chat/page.tsx`

The chat page is a Client Component that uses the `useChat` hook.

**Key modifications**:

**Change message display format**:
```tsx
// Find the message rendering section
{messages.map((msg) => (
  <div key={msg.id} className={msg.role === 'user' ? 'user-message' : 'ai-message'}>
    {msg.content}
  </div>
))}
```

**Add custom message actions** (e.g., copy, share):
```tsx
<button
  onClick={() => navigator.clipboard.writeText(msg.content)}
  className="text-sm text-gray-500 hover:text-gray-700"
>
  Copy
</button>
```

### Customizing Language Support

**Location**: `frontend/lib/i18n.ts`

Add or modify language translations:

```typescript
export const languages = {
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' },
  // Add new language
  de: { name: 'German', nativeName: 'Deutsch' }
};

export const translations = {
  en: {
    welcome: 'Welcome to YMCA',
    startChat: 'Start Chat'
  },
  es: {
    welcome: 'Bienvenido a YMCA',
    startChat: 'Iniciar Chat'
  },
  de: {
    welcome: 'Willkommen bei YMCA',
    startChat: 'Chat starten'
  }
};
```

---

## Backend Modifications

### Adding New Lambda Functions

**Location**: `backend/lambda/`

**Steps**:
1. Create a new directory in `backend/lambda/` (e.g., `sentiment-analyzer/`)
2. Add `index.js` (or `.ts` for TypeScript) with your handler
3. Add `package.json` with dependencies
4. Update CDK stack to deploy the function

**Example** (`backend/lambda/sentiment-analyzer/index.js`):
```javascript
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { text } = body;

  // Your logic here
  const sentiment = analyzeSentiment(text);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ sentiment })
  };
};

function analyzeSentiment(text) {
  // Implement sentiment analysis
  return 'positive';
}
```

**Update CDK Stack** (`backend/lib/backend-stack.ts`):
```typescript
// Add new Lambda function
const sentimentFunction = new lambda.Function(this, 'SentimentAnalyzer', {
  functionName: 'ymca-sentiment-analyzer',
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/sentiment-analyzer'),
  role: lambdaExecutionRole,
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
  environment: {
    REGION: this.region
  }
});

// Add API endpoint
const sentimentResource = api.root.addResource('sentiment');
sentimentResource.addMethod('POST', new apigateway.LambdaIntegration(sentimentFunction));
```

### Modifying the CDK Stack

**Location**: `backend/lib/backend-stack.ts`

Common modifications:

**Change Lambda timeout**:
```typescript
const agentProxyFunction = new lambda.Function(this, 'YmcaAgentProxyFunction', {
  // ...existing config
  timeout: cdk.Duration.minutes(10), // Changed from 15
});
```

**Add environment variables**:
```typescript
environment: {
  CONVERSATION_TABLE_NAME: conversationTable.tableName,
  ANALYTICS_TABLE_NAME: analyticsTable.tableName,
  // Add custom variable
  CUSTOM_SETTING: 'your-value',
  DEBUG_MODE: process.env.DEBUG_MODE || 'false'
}
```

**Change DynamoDB table structure**:
```typescript
const conversationTable = new dynamodb.Table(this, 'YmcaConversationTable', {
  tableName: 'ymca-conversations',
  partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  // Add Global Secondary Index
  globalSecondaryIndexes: [{
    indexName: 'UserIdIndex',
    partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    projectionType: dynamodb.ProjectionType.ALL
  }],
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

### Adding New API Endpoints

**Location**: `backend/lib/backend-stack.ts`

Add a new REST API endpoint:

```typescript
// Create resource
const customResource = api.root.addResource('custom-endpoint');

// Create Lambda integration
const customIntegration = new apigateway.LambdaIntegration(customLambdaFunction);

// Add method
customResource.addMethod('POST', customIntegration);

// Add CORS (already configured globally, but can override)
customResource.addMethod('OPTIONS', new apigateway.MockIntegration({
  integrationResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
      'method.response.header.Access-Control-Allow-Origin': "'*'"
    }
  }],
  passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
  requestTemplates: {
    'application/json': '{"statusCode": 200}'
  }
}));
```

---

## Adding New Features

### Feature: User Feedback Collection

**Goal**: Allow users to rate chatbot responses

**Files to modify**:
- `frontend/app/chat/page.tsx` - Add feedback UI
- `backend/lambda/agent-proxy/index.js` - Store feedback
- `backend/lib/backend-stack.ts` - Add feedback table

**Implementation**:

1. **Add DynamoDB table for feedback** (`backend/lib/backend-stack.ts`):
```typescript
const feedbackTable = new dynamodb.Table(this, 'YmcaFeedbackTable', {
  tableName: 'ymca-feedback',
  partitionKey: { name: 'feedbackId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// Grant Lambda permissions
feedbackTable.grantReadWriteData(lambdaExecutionRole);
```

2. **Add feedback Lambda handler** (`backend/lambda/feedback/index.js`):
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { conversationId, rating, comment } = body;

  await dynamoClient.send(new PutCommand({
    TableName: 'ymca-feedback',
    Item: {
      feedbackId: `feedback-${Date.now()}`,
      timestamp: Date.now(),
      conversationId,
      rating,
      comment
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
```

3. **Add feedback UI** (`frontend/app/chat/page.tsx`):
```tsx
const handleFeedback = async (messageId: string, rating: number) => {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, rating })
  });
};

// In message display
<div className="flex gap-2 mt-2">
  <button onClick={() => handleFeedback(msg.id, 1)}>👍</button>
  <button onClick={() => handleFeedback(msg.id, -1)}>👎</button>
</div>
```

---

## Changing AI/ML Models

### Switching Bedrock Models

**Location**: `backend/lambda/agent-proxy/index.js`

**Current model**: Amazon Nova Pro (`us.amazon.nova-pro-v1:0`)

**Change to a different model**:
```javascript
const streamCommand = new InvokeModelWithResponseStreamCommand({
  modelId: 'anthropic.claude-3-sonnet-20240229-v1:0', // Changed model
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
```

**Available Bedrock models** (request access in AWS Console → Bedrock):
- `us.amazon.nova-pro-v1:0` - Amazon Nova Pro
- `us.amazon.nova-lite-v1:0` - Amazon Nova Lite (faster, cheaper)
- `anthropic.claude-3-sonnet-20240229-v1:0` - Claude 3 Sonnet
- `anthropic.claude-3-opus-20240229-v1:0` - Claude 3 Opus
- `meta.llama3-70b-instruct-v1:0` - Llama 3 70B

### Modifying Prompts

**Location**: `backend/lambda/agent-proxy/index.js`

Find the `createEnhancedPrompt` function (around line 400):

```javascript
function createEnhancedPrompt(retrievedContext, queryInEnglish, citationCount) {
  return `You are a knowledgeable YMCA historian. Your task is to answer questions...

CONTEXT:
${retrievedContext}

QUERY: ${queryInEnglish}

Instructions:
- Provide accurate historical information
- Cite sources using [Source N] notation
- Structure response with title, narrative, timeline, etc.

Response format (JSON):
{
  "story": {
    "title": "...",
    "narrative": "...",
    // ... rest of structure
  }
}`;
}
```

**Customization examples**:
- Change tone: "You are a friendly, conversational YMCA historian..."
- Add constraints: "Limit responses to 200 words..."
- Modify structure: Add new fields to the JSON response format
- Add instructions: "Always mention modern YMCA programs when relevant..."

### Changing Embedding Model

**Location**: `backend/lib/backend-stack.ts`

**Current**: Amazon Titan Text Embeddings V2 (1024 dimensions)

```typescript
const knowledgeBase = new CfnKnowledgeBase(this, 'YmcaKnowledgeBase', {
  // ...
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: {
      // Change embedding model
      embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/cohere.embed-multilingual-v3`,
    },
  },
  // ...
});

// Update vector index dimension to match model
const vectorIndex = new Index(this, 'YmcaVectorIndex', {
  vectorBucketName: vectorsBucket.vectorBucketName,
  indexName: 'ymca-vector-index',
  dimension: 1024, // Change based on model (Cohere: 1024, Titan V2: 1024, Titan V1: 1536)
  distanceMetric: 'cosine',
  dataType: 'float32',
  // ...
});
```

---

## Database Modifications

### Adding New Tables

**Location**: `backend/lib/backend-stack.ts`

```typescript
const newTable = new dynamodb.Table(this, 'YmcaNewTable', {
  tableName: 'ymca-new-table',
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  // Add Time-To-Live for automatic expiration
  timeToLiveAttribute: 'expiresAt',
  // Add stream for change data capture
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
});

// Grant permissions
newTable.grantReadWriteData(lambdaExecutionRole);
```

### Modifying Schema

**Adding attributes** (DynamoDB is schemaless, just add fields in your Lambda):
```javascript
await dynamoClient.send(new PutCommand({
  TableName: CONVERSATION_TABLE,
  Item: {
    conversationId: conversationId,
    timestamp: timestamp,
    // Existing fields
    userMessage: message,
    aiResponse: response,
    // New fields
    sentiment: 'positive',
    categories: ['history', 'community'],
    metadata: {
      source: 'web',
      deviceType: 'desktop'
    }
  }
}));
```

**Adding indexes**:
```typescript
globalSecondaryIndexes: [{
  indexName: 'CategoryIndex',
  partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  projectionType: dynamodb.ProjectionType.ALL
}]
```

---

## Best Practices

1. **Test locally before deploying**
   ```bash
   # Frontend
   cd frontend
   npm run dev

   # Backend (synthesize CDK)
   cd backend
   cdk synth
   cdk diff  # See what will change
   ```

2. **Use environment variables** - Don't hardcode values
   ```typescript
   environment: {
     API_URL: process.env.API_URL || 'https://default-url.com'
   }
   ```

3. **Follow existing patterns** - Maintain consistency
   - Use the same naming conventions
   - Follow the established project structure
   - Match existing code style (Prettier/ESLint)

4. **Update documentation** - Keep docs in sync with code changes
   - Update API documentation when endpoints change
   - Update architecture diagrams for major changes
   - Add comments for complex logic

5. **Version control** - Make small, focused commits
   ```bash
   git add .
   git commit -m "feat: add user feedback collection"
   git push
   ```

6. **Monitor CloudWatch Logs** - Debug issues in production
   ```bash
   aws logs tail /aws/lambda/ymca-agent-proxy --follow
   ```

7. **Use CDK hotswap for faster iteration** (development only)
   ```bash
   cdk deploy --hotswap  # Fast updates for Lambda code changes
   ```

8. **Backup before major changes**
   ```bash
   # Export DynamoDB tables
   aws dynamodb export-table-to-point-in-time \
     --table-name ymca-conversations \
     --s3-bucket my-backup-bucket \
     --export-format DYNAMODB_JSON
   ```

---

## Testing Your Changes

### Local Frontend Testing

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### Local Backend Testing

```bash
cd backend

# Synthesize CloudFormation template
cdk synth

# Check differences before deployment
cdk diff

# Deploy changes
cdk deploy

# Hotswap for Lambda changes (faster)
cdk deploy --hotswap
```

### Testing Lambda Functions Locally

Use AWS SAM or Lambda invoke:

```bash
# Install SAM CLI
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

# Test Lambda function
sam local invoke YmcaAgentProxyFunction \
  --event test-event.json
```

### Integration Testing

Test API endpoints with curl or Postman:

```bash
curl -X POST https://[API_URL]/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test question",
    "language": "en"
  }'
```

---

## Conclusion

This project is designed to be extensible and customizable. We encourage developers to modify and improve the system to better serve their needs.

**Common Customization Scenarios**:
- **Branding**: Update colors, logos, and text in `frontend/app/globals.css` and components
- **Language Support**: Add new languages in `frontend/lib/i18n.ts` and update backend supported languages
- **AI Behavior**: Modify prompts in `backend/lambda/agent-proxy/index.js`
- **Data Collection**: Add new DynamoDB tables and Lambda functions for additional features
- **UI/UX**: Customize Next.js pages in `frontend/app/`
- **Analytics**: Extend analytics table schema and add visualization components

**Getting Help**:
- Check the [Architecture Deep Dive](./architectureDeepDive.md) for system understanding
- Review the [API Documentation](./APIDoc.md) for endpoint details
- See the [Deployment Guide](./deploymentGuide.md) for deployment procedures
- Open an issue on GitHub: https://github.com/ASUCICREPO/YMCA_snoco_Chatbot/issues

**Contributing**:
If you create useful extensions or improvements, consider contributing back to the project via pull requests.
