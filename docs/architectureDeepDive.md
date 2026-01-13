# Architecture Deep Dive

This document provides a detailed explanation of the YMCA AI Chatbot architecture.

---

## Architecture Diagram

![Architecture Diagram](./media/ymca_updated_arch.png)

---

## Architecture Flow

The following describes the step-by-step flow of how the system processes requests:

### 1. User Interaction
Users access the YMCA chatbot through a Next.js web application hosted on AWS Amplify. The interface provides:
- A conversational chat interface with streaming responses
- Multi-language support (English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian)
- Admin dashboard for uploading documents and viewing analytics

### 2. Authentication & Authorization
- **Cognito User Pool**: Manages user authentication for the admin panel
- **Cognito Identity Pool**: Provides temporary AWS credentials for authenticated users
- Users authenticate via email/password to access admin features
- Authenticated users can access analytics and conversation history via DynamoDB

### 3. Chat Request Processing
When a user sends a message:
1. Frontend sends POST request to Lambda Function URL with streaming enabled
2. Request includes: user message, conversation ID, and target language
3. Lambda Function URL directly invokes the streaming Lambda function

### 4. RAG (Retrieval-Augmented Generation) Pipeline
The RAG Lambda function processes the request:
1. **Language Detection & Translation**: If the query is not in English, Amazon Translate converts it to English for better retrieval accuracy
2. **Knowledge Base Retrieval**: Bedrock Knowledge Base searches S3 Vectors index for relevant documents
   - Uses Titan Text Embeddings V2 (1024 dimensions)
   - Retrieves top 50 results with diversity enforcement (max 10 chunks per document)
   - Groups results by source document
3. **Context Assembly**: Combines retrieved chunks with source citations and pre-signed S3 URLs for document access
4. **Response Generation**: Amazon Bedrock Nova Pro generates response based on:
   - Retrieved context from knowledge base
   - User's original question
   - Conversation history
5. **Response Translation**: If needed, response is translated back to the user's requested language
6. **Response Delivery**:
   - **Streaming**: Uses Server-Sent Events for real-time token-by-token delivery
   - **Non-streaming**: Returns complete response in JSON format

### 5. Document Processing Pipeline
When documents are uploaded to the admin panel:
1. **Upload**: Files uploaded directly from frontend to S3 using AWS SDK with Cognito credentials, stored in S3 bucket (`input/` prefix)
2. **Ingestion Lambda**: S3 event notification triggers batch processor Lambda
3. **Step Functions Workflow** orchestrates the processing:
   - **Textract Async**: Starts asynchronous Textract job (text detection for images, document analysis for PDFs)
   - **Wait**: 2-minute wait between status checks
   - **Check Status**: Polls Textract job status
   - **Postprocessor**: Once complete, retrieves results, extracts text and structured data, saves to S3 (`output/processed-text/` prefix)
4. **Knowledge Base Sync**: Bedrock Knowledge Base automatically ingests new documents from the output folder
5. **Embedding & Indexing**: Documents are chunked (525 tokens, 15% overlap), embedded using Titan Embeddings V2, and stored in S3 Vectors

### 6. Analytics & Conversation Storage
- **DynamoDB Conversations Table**: Stores conversation history (conversationId, timestamp, messages)
- **DynamoDB Analytics Table**: Tracks query metrics (queryId, timestamp, language, sources used, confidence scores)
- Admin dashboard queries these tables to display usage statistics

---

## Cloud Services / Technology Stack

### Frontend
- **Next.js 16.0.1**: React framework with App Router for server-side rendering and static export
  - Server Components by default for optimal performance
  - Client Components for interactive features (chat interface, file upload)
  - TypeScript for type safety
  - Tailwind CSS v4 for styling
- **AWS Amplify**: Hosts the frontend application
  - Automatic builds on GitHub push
  - Environment variables injected during build
  - Connected to GitHub repository for CI/CD

### Backend Infrastructure
- **AWS CDK**: Infrastructure as Code framework for deploying AWS resources
  - Defines all cloud infrastructure in TypeScript
  - Enables reproducible deployments across environments
  - Single command deployment (`cdk deploy`)

- **AWS Lambda with Function URLs**: Serverless compute for backend logic with direct HTTPS endpoints
  - **RAG Streaming Lambda (`ymca-agent-proxy-streaming`)**: Handles streaming chat with response streaming enabled (15-min timeout, 1024MB memory)
    - Lambda Function URL with native streaming support (RESPONSE_STREAM invoke mode)
    - CORS configured for frontend access
    - No API Gateway overhead - direct invocation
  - **Batch Processor (`ymca-batch-processor`)**: Triggers document processing workflow on S3 upload (5-min timeout, 512MB memory)
  - **Textract Async (`ymca-textract-async`)**: Starts asynchronous Textract jobs (5-min timeout, 512MB memory)
  - **Check Textract Status (`ymca-check-textract-status`)**: Polls Textract job status (5-min timeout, 256MB memory)
  - **Textract Postprocessor (`ymca-textract-postprocessor`)**: Processes completed Textract results (15-min timeout, 2048MB memory)

### AI/ML Services
- **Amazon Bedrock**: Foundation model service for AI capabilities
  - **Model**: Amazon Nova Pro (US East 1 region)
  - **Use**: Conversational AI with streaming support
  - **Capabilities**: Multi-turn conversations, context-aware responses, citation generation

- **Bedrock Knowledge Base**: Vector database for RAG
  - **Embeddings**: Amazon Titan Text Embeddings V2 (1024 dimensions)
  - **Storage**: S3 Vectors with cosine similarity
  - **Chunking**: Fixed-size chunks (525 tokens, 15% overlap)
  - **Retrieval**: Top-K search with diversity enforcement

- **Amazon Textract**: Document text extraction service
  - **Text Detection**: Extracts text from images (PNG, JPG, JPEG, TIFF)
  - **Document Analysis**: Extracts text, tables, and forms from PDFs
  - **Asynchronous Processing**: Handles large documents efficiently

- **Amazon Translate**: Multi-language translation service
  - **Auto-detection**: Automatically detects source language
  - **12 Supported Languages**: English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian
  - **Bidirectional**: Translates queries to English for retrieval, translates responses back to target language

### Data Storage
- **Amazon S3**: Object storage for documents and vectors
  - **Documents Bucket** (`ymca-documents-{account}-{region}`):
    - `input/` prefix: Original uploaded files (PDF, images)
    - `output/processed-text/` prefix: Processed text for knowledge base ingestion
  - **Vectors Bucket** (`ymca-vectors-{account}-{region}`):
    - Stores vector embeddings and metadata
    - S3 Vectors index for fast similarity search
  - **Retention Policy**: `RETAIN` - buckets are preserved on stack deletion

- **Amazon DynamoDB**: NoSQL database for conversations and analytics
  - **Conversations Table** (`ymca-conversations`):
    - Partition Key: `conversationId` (STRING)
    - Sort Key: `timestamp` (NUMBER)
    - Stores message history, user queries, AI responses
  - **Analytics Table** (`ymca-analytics`):
    - Partition Key: `queryId` (STRING)
    - Sort Key: `timestamp` (NUMBER)
    - Tracks metrics: language, sources used, confidence scores, response times
  - **Billing Mode**: Pay-per-request
  - **Retention Policy**: `RETAIN` - tables are preserved on stack deletion

### Orchestration
- **AWS Step Functions**: Workflow orchestration for document processing
  - **State Machine**: `ymca-document-processing`
  - **Timeout**: 2 hours for large documents
  - **States**:
    1. Start Textract Job
    2. Wait (2 minutes)
    3. Check Job Status
    4. Loop until complete or failed
    5. Process Results on success
  - **Error Handling**: Graceful failure states with detailed error messages

### Authentication & Authorization
- **Amazon Cognito User Pool**: User authentication for admin panel
  - **Sign-in**: Email and password
  - **Password Policy**: Min 8 chars, requires uppercase, lowercase, digit, special char
  - **Auto-verify**: Email verification enabled
  - **Recovery**: Email-only account recovery

- **Amazon Cognito Identity Pool**: AWS credential provider for authenticated users
  - Provides temporary AWS credentials
  - Grants DynamoDB read access to analytics and conversation tables
  - Scoped permissions via IAM role

---

## Infrastructure as Code

This project uses **AWS CDK (Cloud Development Kit)** to define and deploy infrastructure.

### CDK Stack Structure

```
backend/
├── bin/
│   └── backend.ts          # CDK app entry point
├── lib/
│   └── backend-stack.ts    # Main stack definition (YmcaAiStack)
└── lambda/
    ├── agent-proxy/        # RAG Lambda function
    ├── batch-processor/    # Document ingestion trigger
    ├── textract-async/     # Textract job starter
    ├── check-textract-status/  # Status checker
    └── textract-postprocessor/ # Result processor
```

### Key CDK Constructs

1. **S3 Buckets**: `s3.Bucket` with encryption, block public access, and retention policies
2. **S3 Vectors**: Custom construct from `cdk-s3-vectors` library for vector storage and indexing
3. **Lambda Functions**: `lambda.Function` with Function URLs, environment variables, IAM roles, and timeouts
4. **Lambda Function URLs**: Direct HTTPS endpoints with CORS, streaming support (RESPONSE_STREAM invoke mode)
5. **DynamoDB Tables**: `dynamodb.Table` with on-demand billing and global secondary indexes
6. **Step Functions**: `stepfunctions.StateMachine` with Lambda task integrations and choice states
7. **Cognito**: `cognito.UserPool`, `cognito.CfnIdentityPool` for authentication and S3 direct access
8. **Bedrock**: `CfnKnowledgeBase`, `CfnDataSource` for RAG capabilities
9. **Amplify**: `amplifyAlpha.App` for frontend hosting with GitHub integration
10. **IAM Roles & Policies**: Fine-grained permissions for each Lambda function and service

### Deployment Automation

The `deploy.sh` script automates the entire deployment process:
1. **Environment Setup**: Collects AWS region, GitHub credentials, admin user details
2. **Dependency Installation**: Installs npm packages and builds TypeScript
3. **CDK Bootstrap**: Prepares AWS account for CDK deployments
4. **Stack Deployment**: Deploys all resources via `cdk deploy`
5. **Output Extraction**: Captures API endpoints, Cognito IDs, S3 bucket names
6. **Admin User Creation**: Creates Cognito user with permanent password
7. **Amplify Build Trigger**: Automatically builds and deploys frontend

---

## Security Considerations

### Authentication
- **Cognito User Pool**: Email/password authentication for admin users
- **MFA**: Optional multi-factor authentication (can be enabled)
- **Password Policy**: Enforces strong passwords with complexity requirements

### Authorization
- **IAM Roles**: Least-privilege access for Lambda functions and services
- **Cognito Identity Pool**: Temporary AWS credentials with scoped permissions for direct S3 uploads
- **Lambda Function URLs**: Public HTTPS endpoints with CORS for chat functionality

### Data Encryption
- **At Rest**:
  - S3 buckets use SSE-S3 managed encryption
  - DynamoDB uses AWS-managed encryption
- **In Transit**:
  - Enforce SSL/TLS for all S3 operations (`enforceSSL: true`)
  - Lambda Function URLs use HTTPS endpoints
  - All API communication over TLS 1.2+

### Network Security
- **S3 Bucket Policies**: Block all public access
- **CORS Configuration**: Allows specific origins, methods, and headers
- **Pre-signed URLs**: Time-limited access to documents (5-minute expiration)
- **VPC**: Lambda functions run in AWS-managed VPC (can be configured for custom VPC)

### Secrets Management
- **GitHub Token**: Stored in AWS Secrets Manager
- **Environment Variables**: Passed securely to Lambda and Amplify
- **Cognito Credentials**: Never exposed in client-side code

---

## Scalability

### Auto-scaling
- **Lambda Functions**: Automatically scale to handle concurrent requests (default: 1000 concurrent executions per region)
- **Lambda Function URLs**: No additional scaling limits beyond Lambda concurrency
- **DynamoDB**: On-demand billing mode automatically scales throughput
- **S3**: Infinitely scalable for storage and requests

### Load Balancing
- **Lambda Function URLs**: Direct invocation with AWS-managed load distribution
- **Bedrock**: Managed service with automatic scaling for inference
- **S3 Vectors**: Distributed index for fast vector search at scale

### Caching
- **S3 Pre-signed URLs**: 5-minute cache for document access
- **Frontend**: Next.js static export with edge caching via Amplify CDN
- **Bedrock Knowledge Base**: Caches embeddings in S3 Vectors index
- **Lambda Warm-up**: Reduced cold starts with provisioned concurrency (optional)

### Performance Optimizations
- **Diversity Enforcement**: Limits chunks per document to reduce token usage
- **Streaming Responses**: Improves perceived latency with token-by-token delivery
- **S3 Event Notifications**: Immediate triggering of processing workflows
- **Step Functions**: Efficient orchestration with parallel execution where possible
- **Lambda Memory Allocation**: Right-sized for each function's workload
