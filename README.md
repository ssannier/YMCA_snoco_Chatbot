# YMCA AI Multilingual Chatbot

An intelligent document processing and multilingual chatbot system designed for YMCA organizations. This AI-powered solution processes historical documents, extracts knowledge, and provides multilingual chat support to help YMCA staff and members access information efficiently across language barriers.

---

## Visual Demo

![YMCA AI Architecture](./docs/media/arch.png)

> **Architecture Overview**: The system uses AWS serverless architecture with Step Functions orchestrating document processing, Textract for OCR, Bedrock Knowledge Base for RAG, and a Next.js frontend deployed via Amplify.

---

## Table of Contents

| Index                                               | Description                                              |
| :-------------------------------------------------- | :------------------------------------------------------- |
| [Features](#features)                               | Key features and capabilities                            |
| [High Level Architecture](#high-level-architecture) | High level overview illustrating component interactions  |
| [Deployment Guide](#deployment-guide)               | How to deploy the project                                |
| [User Guide](#user-guide)                           | End-user instructions and walkthrough                    |
| [API Documentation](#api-documentation)             | Documentation on the APIs the project uses               |
| [Directories](#directories)                         | General project directory structure                      |
| [Modification Guide](#modification-guide)           | Guide for developers extending the project               |
| [Credits](#credits)                                 | Contributors and acknowledgments                         |
| [License](#license)                                 | License information                                      |

---

## Features

### Multi-Language Support
- **12 Languages Supported**: English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian
- **Automatic Translation**: Amazon Translate provides seamless language detection and bidirectional translation
- **Language Preservation**: Conversation context maintained across language switches

### Intelligent AI Chat
- **RAG-Powered Responses**: Bedrock Knowledge Base retrieves relevant context from uploaded documents
- **Amazon Nova Pro**: Advanced AI model for generating contextual, citation-backed responses
- **Streaming Support**: Real-time token-by-token response delivery for immediate feedback
- **Source Citations**: Every response includes downloadable source documents with pre-signed URLs

### Document Processing
- **Automated Pipeline**: Step Functions orchestrates end-to-end document processing
- **OCR Extraction**: Amazon Textract extracts text, tables, and forms from PDFs 
- **Smart Indexing**: Bedrock Knowledge Base automatically indexes processed documents
- **Multi-Format Support**: PDF, PNG, JPG, JPEG, TIFF files

### Analytics & Admin Dashboard
- **Conversation Tracking**: DynamoDB stores all chat interactions and metadata
- **Usage Analytics**: Track queries, languages, popular topics, and response times
- **Document Management**: Admin interface for uploading and managing knowledge base content
- **Cognito Authentication**: Secure admin access with email/password authentication

### Performance & Scalability
- **S3 Vectors**: Cost-effective vector storage
- **Lambda Function URLs**: Native streaming support with 15-minute timeout
---

## High Level Architecture

The YMCA AI system leverages AWS serverless architecture to create a scalable, multilingual document processing and chatbot solution. The system automatically processes uploaded documents through OCR, extracts knowledge using AI, and provides intelligent chat responses in multiple languages.

![Architecture Diagram](./docs/media/ymca_updated_arch.png)

### Architecture Flow:

1. **Document Upload** → Users upload historical documents via the admin panel to S3 `input/` folder
2. **Event Trigger** → S3 event notification triggers batch processor Lambda function
3. **Document Processing** → Step Functions orchestrates OCR extraction via Amazon Textract
4. **Text Storage** → Processed text is saved to S3 `output/processed-text/` folder in structured JSON format
5. **Knowledge Base Ingestion** → Bedrock Knowledge Base automatically reads from `output/` folder and creates embeddings
6. **Vector Storage** → Embeddings stored in S3 Vectors (managed by `cdk-s3-vectors` library)
7. **Multilingual Chat** → Users interact with the chatbot through the Next.js frontend
8. **Query Translation** → Amazon Translate converts queries to English for optimal retrieval
9. **RAG Retrieval** → Bedrock Knowledge Base searches vector index for relevant context
10. **Response Generation** → Amazon Nova Pro generates contextual answers with citations
11. **Response Translation** → Amazon Translate converts responses back to user's language
12. **Streaming Delivery** → Responses delivered in real-time via Lambda Function URL

For a detailed explanation of the architecture, see the [Architecture Deep Dive](./docs/architectureDeepDive.md).

---

## Deployment Guide

Deploy the complete YMCA AI Chatbot with automated infrastructure provisioning.

### Quick Start

```bash
# Clone the repository
git clone https://github.com/ASUCICREPO/YMCA_snoco_Chatbot.git
cd YMCA_snoco_Chatbot

# Make deployment script executable
chmod +x deploy.sh

# Run automated deployment
./deploy.sh
```

### What Gets Deployed

The `deploy.sh` script automatically provisions:

1. ✅ **Backend Infrastructure** (via AWS CDK)
   - Lambda functions with Function URLs (chat, document processing)
   - Step Functions workflow
   - Bedrock Knowledge Base with S3 Vectors
   - DynamoDB tables (conversations, analytics)
   - Cognito User Pool and Identity Pool

2. ✅ **Frontend Application** (via AWS Amplify)
   - Next.js app deployed from GitHub
   - Automatic environment variable injection
   - CI/CD pipeline for future updates

3. ✅ **Admin User Setup**
   - Cognito user created with provided credentials
   - Immediate access to admin dashboard

### Prerequisites

- **AWS Account** with appropriate permissions
- **AWS CLI** configured (`aws configure`)
- **Node.js** 18+ installed
- **AWS CDK** CLI installed (`npm install -g aws-cdk`)
- **GitHub Personal Access Token** (for Amplify deployment)
- **Bedrock Model Access** (Amazon Nova Pro, Titan Embeddings V2)

### Deployment Time

- **Backend**: 10-15 minutes
- **Frontend**: 3-5 minutes (Amplify build)
- **Total**: ~15-20 minutes

### Post-Deployment

After successful deployment, you'll receive:
- Frontend URL (Amplify App)
- Streaming Function URL
- Cognito User Pool IDs
- S3 bucket names

**📚 For detailed deployment instructions, see the [Deployment Guide](./docs/deploymentGuide.md).**

---

## Cleanup

Remove all deployed resources with the cleanup script:

```bash
# Make cleanup script executable
chmod +x cleanup.sh

# Run interactive cleanup
./cleanup.sh
```

The script will:
- Prompt for confirmation before deleting resources
- Ask whether to delete S3 buckets and DynamoDB tables (RETAIN policy)
- Delete the CloudFormation stack and all associated resources
- Optionally clean up local build artifacts

**Note**: S3 buckets (documents, vectors) and DynamoDB tables have RETAIN policies and must be explicitly deleted.

---

## User Guide

### Accessing the Application

1. Navigate to the Amplify App URL (provided after deployment)
2. Select your preferred language from the globe icon
3. Start chatting or click a topic card to begin

### Using the Chat Interface

- **Ask Questions**: Type questions about YMCA history in any supported language
- **View Sources**: Click on citations to download original documents
- **Continue Conversations**: The AI maintains context across multiple messages
- **Switch Languages**: Change language mid-conversation without losing context

### Admin Features

1. **Login**: Navigate to `/admin` and use your Cognito credentials
2. **Upload Documents**: Use the admin page upload feature to add PDFs to expand the knowledge base
   - Documents are uploaded to S3 `input/` folder
   - Textract automatically processes and extracts text
   - **Verify Processing**: Check S3 bucket `output/processed-text/` folder to confirm files are populated (processing complete)
3. **Sync Knowledge Base**: After processing completes, navigate to AWS Bedrock Console → Knowledge Bases → `ymca-knowledge-base` → Data Sources → `ymca-s3-documents` → Click **"Sync"** to make documents queryable
4. **View Analytics**: Track usage, popular topics, and conversation metrics
5. **Monitor Processing**: Check document processing status in Step Functions

**📚 For detailed usage instructions with examples, see the [User Guide](./docs/userGuide.md).**

---

## API Documentation

The YMCA AI Chatbot provides RESTful APIs for conversational AI with multilingual support.

### Frontend Routes

The Next.js frontend provides the following application routes:

| Route | Description | Access |
|-------|-------------|--------|
| `/` | **Homepage** - Welcome screen with topic cards and language selector | Public |
| `/chat` | **Chat Interface** - Conversational AI experience with YMCA historical knowledge | Public |
| `/admin` | **Admin Dashboard** - Document upload, analytics, and system monitoring | Authenticated (Cognito) |

**Base Frontend URL**: `https://[AMPLIFY-APP-ID].amplifyapp.com/` (provided after deployment)

### Backend API Base URL
```
https://[API_ID].execute-api.[REGION].amazonaws.com/prod/
```

### Streaming Chat Endpoint (Recommended)

**Lambda Function URL** (Native streaming, 15-min timeout):
```
POST https://[FUNCTION_URL]/
```

**Request**:
```json
{
  "message": "What was the YMCA's role in World War II?",
  "conversationId": "conv-123",
  "language": "en"
}
```

**Response** (Server-Sent Events):
```
data: {"type":"chunk","content":"The YMCA"}

data: {"type":"chunk","content":" played a vital role..."}

data: {"type":"complete","response":{...full response with citations...}}

data: [DONE]
```

### Key Features
- **Multi-language Support**: 12 languages with auto-detection
- **Streaming Responses**: Real-time token-by-token delivery
- **Source Citations**: Every response includes downloadable documents
- **Context Preservation**: Conversation history maintained

**📚 For complete API reference with examples, see the [API Documentation](./docs/APIDoc.md).**

---

## Modification Guide

Extend and customize the YMCA AI Chatbot for your needs.

### Common Modifications

**1. Change UI Theme**
```typescript
// frontend/app/globals.css
@theme {
  --color-ymca-blue: #0089d0;  // Update to your color
}
```

**2. Add New Page**
```typescript
// frontend/app/about/page.tsx
export default function AboutPage() {
  return <div>Your content</div>;
}
```

**3. Modify AI Prompts**
```javascript
// backend/lambda/agent-proxy/index.js
function createEnhancedPrompt(context, query) {
  return `You are a friendly YMCA historian...`;
}
```

**4. Switch Bedrock Models**
```javascript
// backend/lambda/agent-proxy/index.js
modelId: 'anthropic.claude-3-sonnet-20240229-v1:0'
```

**5. Add New Lambda Function**
```typescript
// backend/lib/backend-stack.ts
const newFunction = new lambda.Function(this, 'NewFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/new-function'),
  // ...
});
```

**📚 For comprehensive modification examples, see the [Modification Guide](./docs/modificationGuide.md).**

---

## Directories

```
YMCA_Scono_chatbot/
├── backend/
│   ├── bin/
│   │   └── backend.ts              # CDK app entry point
│   ├── lambda/
│   │   ├── agent-proxy/            # RAG Lambda (chat functionality)
│   │   ├── batch-processor/        # Document ingestion trigger
│   │   ├── textract-async/         # Textract job starter
│   │   ├── check-textract-status/  # Status checker
│   │   └── textract-postprocessor/ # Result processor
│   ├── lib/
│   │   └── backend-stack.ts        # Main CDK stack
│   ├── .env                        # Environment variables
│   ├── cdk.json                    # CDK configuration
│   ├── package.json                # Backend dependencies
│   └── tsconfig.json               # TypeScript config
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Homepage
│   │   ├── layout.tsx              # Root layout
│   │   ├── globals.css             # Global styles
│   │   ├── chat/
│   │   │   └── page.tsx            # Chat interface
│   │   ├── admin/
│   │   │   └── page.tsx            # Admin dashboard
│   │   ├── hooks/
│   │   │   └── useChat.ts          # Chat hook
│   │   └── context/
│   │       └── ChatContext.tsx     # Chat context
│   ├── lib/
│   │   ├── api-service.ts          # API calls
│   │   ├── i18n.ts                 # Internationalization
│   │   └── utils.ts                # Utility functions
│   ├── components/
│   │   └── ConfigureAmplify.tsx    # Amplify configuration
│   ├── public/                     # Static assets
│   ├── .env.local                  # Frontend env vars (local dev only)
│   ├── package.json                # Frontend dependencies
│   └── next.config.js              # Next.js configuration
├── docs/
│   ├── architectureDeepDive.md     # Detailed architecture explanation
│   ├── deploymentGuide.md          # Complete deployment instructions
│   ├── userGuide.md                # End-user documentation
│   ├── APIDoc.md                   # API reference
│   ├── modificationGuide.md        # Developer customization guide
│   ├── streamingIntegration.md     # Streaming implementation details
│   └── media/
│       └── ymca_updated_arch.png   # Architecture diagram
├── deploy.sh                       # Automated deployment script
├── cleanup.sh                      # Resource cleanup script
├── CLAUDE.md                       # Development guidelines
├── LICENSE                         # MIT License
└── README.md                       # This file
```

### Directory Explanations:

**backend/** - Contains all backend infrastructure and serverless functions
- `bin/` - CDK app entry point
- `lambda/` - AWS Lambda function implementations
  - `agent-proxy/` - RAG-powered chat handler with streaming support
  - `batch-processor/` - Initiates document processing workflows on S3 upload
  - `textract-async/` - Starts asynchronous OCR jobs
  - `check-textract-status/` - Polls Textract job status
  - `textract-postprocessor/` - Processes OCR results for knowledge base
- `lib/` - CDK stack definitions (infrastructure as code)

**frontend/** - Next.js 16 frontend application
- `app/` - Next.js App Router pages and layouts
- `lib/` - API services, internationalization, utilities
- `components/` - Reusable React components
- `public/` - Static assets (images, icons)

**docs/** - Project documentation
- Comprehensive guides for deployment, usage, API reference, and modification
- `media/` - Architecture diagrams and screenshots

**Root** - Deployment and configuration scripts
- `deploy.sh` - Automated deployment orchestration
- `cleanup.sh` - Resource cleanup with confirmation prompts
- `CLAUDE.md` - Development best practices and coding guidelines

---

## Additional Documentation

- **[Architecture Deep Dive](./docs/architectureDeepDive.md)** - Detailed system architecture, cloud services, security, and scalability
- **[Deployment Guide](./docs/deploymentGuide.md)** - Step-by-step deployment instructions, prerequisites, and troubleshooting
- **[User Guide](./docs/userGuide.md)** - End-user instructions, admin features, and FAQs
- **[API Documentation](./docs/APIDoc.md)** - Complete API reference with request/response examples
- **[Modification Guide](./docs/modificationGuide.md)** - Developer guide for extending and customizing the system
- **[Streaming Integration](./docs/streamingIntegration.md)** - Technical details on streaming implementation

---

## Technology Stack

### Frontend
- **Next.js 16.0.1** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **AWS Amplify** - Hosting and CI/CD

### Backend
- **AWS CDK** - Infrastructure as Code
- **AWS Lambda** - Serverless compute with Function URLs (Node.js 20.x)
- **Amazon Bedrock** - AI/ML platform
  - Amazon Nova Pro (chat model)
  - Titan Text Embeddings V2 (embeddings)
- **Amazon Textract** - Document OCR
- **Amazon Translate** - Multi-language support
- **AWS Step Functions** - Workflow orchestration
- **Amazon S3** - Object storage
  - S3 Vectors (vector embeddings)
- **Amazon DynamoDB** - NoSQL database
- **Amazon Cognito** - Authentication

---

## Credits

This application was developed by the Arizona State University Cloud Innovation Center (ASU CIC) team.

**Contributors:**
- Aarav Matalia: https://www.linkedin.com/in/aarav-matalia/
- Ashik Mathew Tharakan: https://www.linkedin.com/in/ashik-tharakan/

**Special Thanks:**
- YMCA of Snohomish County for project collaboration
- AWS for cloud infrastructure and AI services

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Support

For questions:
- **Documentation**: See the `docs/` folder for comprehensive guides

---

**Built with ❤️ by the ASU CIC team**
