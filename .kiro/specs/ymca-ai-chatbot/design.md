# Design Document: YMCA.ai Multilingual Chatbot

## Overview

YMCA.ai is a serverless, multilingual, multimodal chatbot system that transforms over 150 years of YMCA historical archives into an accessible, AI-powered learning companion. The system leverages Amazon Bedrock's Nova Multi-Modal Embeddings model to create a unified semantic space for text, images, and documents, enabling natural language exploration of historical content across 25+ languages.

The architecture follows a serverless RAG (Retrieval-Augmented Generation) pattern with two primary workflows:
1. **Document Processing Pipeline**: Automated ingestion, OCR, chunking, and embedding of historical documents
2. **Query Processing Pipeline**: Real-time retrieval and generation of contextual, multilingual responses

## Architecture

The YMCA.ai system follows a serverless RAG (Retrieval-Augmented Generation) architecture as depicted in the architecture diagram located at `docs/media/ymca_architecture.png`. The system is composed of several key layers and workflows:

### Architecture Overview

The system architecture consists of the following main components:

**Frontend Layer:**
- Next.js Chat Interface hosted on AWS Amplify with global CDN distribution
- Responsive, multilingual user interface supporting 25+ languages
- Real-time chat functionality with rich media display capabilities

**API Layer:**
- Amazon API Gateway serving as the main entry point for all client requests
- RAG Lambda function handling query processing and response generation
- Analytics Lambda function managing usage tracking and metrics collection

**Document Processing Pipeline:**
- S3 Raw Documents bucket (`ymca-bucket/raw/`) for initial document storage
- AWS Step Functions orchestrating the complete document processing workflow
- Textract Lambda function managing OCR job lifecycle
- Processing Lambda function handling text chunking and embedding generation
- AWS Textract service providing OCR capabilities for historical documents

**AI/ML Services:**
- Amazon Bedrock Knowledge Base for vector storage and semantic search
- Nova Multi-Modal Embeddings model for generating unified embeddings
- Nova Multi Modal Embeddings model for multilingual response generation

**Storage Layer:**
- S3 Vector Store for embedding storage and retrieval
- S3 Processed Documents bucket for storing processed content
- DynamoDB for feeding chat logs to admin dashboard

### Data Flow Architecture

**Document Ingestion Flow:**
1. Historical documents uploaded to S3 Raw Documents bucket
2. S3 event triggers Step Functions workflow
3. Textract Lambda initiates async OCR processing
4. Processing Lambda chunks text and generates embeddings via Nova MME
5. Embeddings stored in Bedrock Knowledge Base and metadata in Vector Store

**Query Processing Flow:**
1. User submits multilingual query through Next.js interface
2. API Gateway routes request to RAG Lambda
3. RAG Lambda performs vector search against Knowledge Base
4. Retrieved context sent to Bedrock Claude for response generation
5. Multilingual response with citations returned to user interface

**Analytics Flow:**
1. All user interactions captured by Analytics Lambda
2. Usage metrics and patterns stored in DynamoDB
3. Admin dashboard provides insights on trending topics and system performance

This architecture ensures scalability, multilingual support, and seamless integration of historical YMCA archives with modern AI capabilities.

## Components and Interfaces

### Frontend Components

#### Chat Interface (Next.js)
- **Language Selector**: Dropdown supporting 25+ languages with persistent user preference
- **Message Display**: Rich text rendering with image support and citation links
- **Input Component**: Multi-language text input with suggested prompts
- **Citation Panel**: Expandable source information with document previews
- **Conversation History**: Persistent chat sessions with search capability

#### Responsive Design
- **Mobile-First**: Optimized for mobile devices with touch-friendly interactions
- **Accessibility**: WCAG 2.1 AA compliance with screen reader support
- **Progressive Web App**: Offline capability for conversation history

### Backend Components

#### Lambda Function Architecture

The system uses four main Lambda functions organized in the following directory structure:

```
lambda/
├── agent-proxy/              # (1) RAG Lambda
│   ├── index.js
│   └── package.json
├── batch-processor/          # (2) Ingestion Starter
│   ├── index.js
│   └── package.json
├── textract-async/           # (3) Textract Job Starter
│   ├── index.js
│   └── package.json
└── textract-postprocessor/   # (4) OCR → Chunks → KB
    ├── index.js
    └── package.json
```

**Implementation Requirements:**
- All Lambda functions must be implemented in JavaScript (Node.js)
- CDK constructs must follow AWS CDK TypeScript format and best practices
- Developers must review AWS CDK TypeScript constructs documentation before implementation
- Each Lambda function should include proper error handling and logging
- Functions must use AWS SDK v3 for optimal performance

#### Lambda Function Specifications

**1. Agent Proxy (RAG Lambda)**
```javascript
// Primary interface for chat queries and response generation
const handler = async (event) => {
  const { query, language, conversationId, userId } = JSON.parse(event.body);
  
  // Process multilingual query
  // Perform vector search against Knowledge Base
  // Generate response using Bedrock Claude
  // Add citations and metadata
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      response: string,
      language: string,
      citations: Citation[],
      suggestedPrompts: string[],
      confidence: number
    })
  };
};
```

**2. Batch Processor (Ingestion Starter)**
```javascript
// Triggered by S3 events to initiate document processing
const handler = async (event) => {
  const s3Records = event.Records;
  
  // Process S3 event notifications
  // Validate document format and size
  // Trigger Step Functions workflow
  // Update processing status
  
  return { statusCode: 200, message: 'Processing initiated' };
};
```

**3. Textract Async (Textract Job Starter)**
```javascript
// Initiates and manages Textract OCR jobs
const handler = async (event) => {
  const { bucketName, objectKey, documentType } = event;
  
  // Start Textract async job
  // Configure SNS notifications
  // Return job ID for tracking
  
  return {
    jobId: string,
    status: 'STARTED',
    documentId: string
  };
};
```

**4. Textract Postprocessor (OCR → Chunks → KB)**
```javascript
// Processes Textract results and stores in Knowledge Base
const handler = async (event) => {
  const { jobId, documentId } = event;
  
  // Retrieve Textract results
  // Extract text and images
  // Chunk text (500-1000 tokens)
  // Generate embeddings using Nova MME
  // Store in Bedrock Knowledge Base
  // Update metadata in Vector Store
  
  return {
    documentId: string,
    chunksProcessed: number,
    embeddingsGenerated: number,
    status: 'COMPLETED'
  };
};
```

### AI/ML Integration

#### CDK Infrastructure Requirements

**CRITICAL**: All AWS infrastructure must be implemented using AWS CDK in TypeScript format. Developers must:

1. **Use AWS CDK MCP Server**: Leverage the AWS CDK MCP server for developing all CDK infrastructure code
2. **Review AWS CDK TypeScript Documentation**: Before implementation, thoroughly review AWS CDK TypeScript constructs and best practices
3. **Use CDK TypeScript Syntax**: All infrastructure code must use TypeScript CDK constructs with proper type safety
4. **Follow CDK Patterns**: Implement proper CDK patterns for Lambda functions, Step Functions, S3 buckets, and Bedrock integrations
5. **Resource Naming**: Use consistent naming conventions for all AWS resources
6. **Environment Configuration**: Support multiple deployment environments (dev, staging, prod)

**MCP Server Integration:**
- Utilize AWS CDK MCP server capabilities for construct recommendations
- Leverage MCP server for CDK best practices and optimization suggestions
- Use MCP server for CDK code generation and validation

**CDK Stack Structure:**
```typescript
// lib/ymca-ai-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class YmcaAiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    // S3 Buckets
    // Lambda Functions
    // Step Functions
    // Bedrock Knowledge Base
    // API Gateway
    // DynamoDB Tables
  }
}
```

#### Nova Multi-Modal Embeddings Configuration
- **Model**: `amazon.nova-embed-multimodal-v1`
- **Embedding Dimensions**: 1024 (balanced performance/storage)
- **Context Length**: Up to 8,192 tokens
- **Supported Modalities**: Text, images, documents
- **Language Support**: 200+ languages including all YMCA target languages

#### Bedrock Knowledge Base Setup
- **Vector Database**: Amazon OpenSearch Serverless
- **Chunking Strategy**: Semantic chunking with 500-1000 token overlap
- **Metadata Fields**: title, author, date, document_type, language, page_number
- **Retrieval Configuration**: Hybrid search (semantic + keyword)

#### Claude Model Configuration
- **Model**: `anthropic.claude-3-5-sonnet-20241022-v2:0`
- **Max Tokens**: 4096 for responses
- **Temperature**: 0.3 for consistent historical accuracy
- **System Prompt**: Specialized for YMCA historical context and multilingual responses

## Data Models

### Document Schema
```typescript
interface Document {
  documentId: string;
  title: string;
  author?: string;
  date?: Date;
  documentType: 'yearbook' | 'directory' | 'proceedings' | 'newsletter' | 'photo';
  language: string;
  originalFormat: 'pdf' | 'image' | 'scan';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  s3Location: {
    bucket: string;
    key: string;
  };
  textChunks: TextChunk[];
  images: ImageMetadata[];
  metadata: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentMetadata {
  totalPages: number;
  fileSize: number;
  ocrConfidence: number;
  topics: string[];
  timeperiod: string;
  geographicScope: string[];
  keywords: string[];
}
```

### Conversation Schema
```typescript
interface Conversation {
  conversationId: string;
  userId?: string;
  sessionId: string;
  language: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    userAgent: string;
    ipAddress?: string;
    referrer?: string;
  };
}

interface Message {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  language: string;
  timestamp: Date;
  citations?: Citation[];
  suggestedPrompts?: string[];
  processingTime?: number;
}
```

### Analytics Schema
```typescript
interface QueryAnalytics {
  queryId: string;
  query: string;
  language: string;
  userId?: string;
  sessionId: string;
  responseTime: number;
  documentsRetrieved: number;
  userRating?: number;
  topicCategories: string[];
  timestamp: Date;
}

interface UsagePattern {
  date: string;
  totalQueries: number;
  uniqueUsers: number;
  languageBreakdown: Record<string, number>;
  topQueries: string[];
  averageSessionDuration: number;
  bounceRate: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all properties identified in the prework analysis, I've identified several areas where properties can be consolidated to eliminate redundancy:

**Consolidation Areas:**
- Document processing properties (1.1-1.7) can be combined into comprehensive workflow properties
- Language handling properties (2.2-2.7) share common multilingual consistency themes
- Citation properties (4.1-4.7) all relate to source attribution and can be streamlined
- Security properties (8.2-8.7) follow similar data protection patterns

**Unique Properties Retained:**
- Each property provides distinct validation value for different system aspects
- Core functional properties (retrieval, generation, analytics) remain separate
- Infrastructure and extensibility properties address different architectural concerns

### Correctness Properties

Property 1: Document Processing Workflow Integrity
*For any* PDF document uploaded to the S3 raw bucket, the complete processing workflow (S3 trigger → Step Functions → Textract → chunking → embedding → Knowledge Base storage) should execute successfully and store all required metadata
**Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.7**

Property 2: Text Chunking Consistency
*For any* extracted text from document processing, all generated chunks should be within the 500-1000 token range and maintain semantic coherence
**Validates: Requirements 1.4**

Property 3: Error Resilience and Logging
*For any* processing failure at any step in the document workflow, the system should log detailed error information and continue processing other documents without interruption
**Validates: Requirements 1.6**

Property 4: Multilingual Query Consistency
*For any* natural language query submitted in a supported language, the system should process the query and return responses in the same language while maintaining semantic accuracy
**Validates: Requirements 2.2, 2.3, 2.4**

Property 5: Language Context Preservation
*For any* conversation where a user switches languages mid-session, the conversation context and history should remain accessible and coherent in the new language
**Validates: Requirements 2.7**

Property 6: Translation Semantic Preservation
*For any* historical information that requires translation, the meaning and context should be preserved across all supported languages
**Validates: Requirements 2.6**

Property 7: Multimodal Retrieval Completeness
*For any* user query, the RAG pipeline should retrieve all relevant text passages, images, and document metadata from the Knowledge Base that match the query intent
**Validates: Requirements 3.1**

Property 8: Response Synthesis Quality
*For any* query with multiple relevant sources, the system should synthesize information from all sources into a coherent narrative response
**Validates: Requirements 3.2**

Property 9: Contextual Image Inclusion
*For any* query where relevant images exist in the Knowledge Base, the system should include appropriate images with proper contextual descriptions
**Validates: Requirements 3.3**

Property 10: Quote Attribution Accuracy
*For any* response containing direct quotes, the quotes should be exact excerpts from the original source documents
**Validates: Requirements 3.4**

Property 11: Balanced Perspective Presentation
*For any* topic with multiple documented perspectives, the system should present all viewpoints with proper source attribution
**Validates: Requirements 3.5**

Property 12: Fallback Suggestion Generation
*For any* query that returns no relevant results, the system should provide helpful alternative query suggestions
**Validates: Requirements 3.7**

Property 13: Complete Citation Tracking
*For any* generated response, all source documents used should be identified and tracked with complete metadata (title, date, author, page number)
**Validates: Requirements 4.1, 4.2**

Property 14: Citation Link Functionality
*For any* displayed citation, clicking should provide access to the original document or relevant excerpt
**Validates: Requirements 4.3**

Property 15: Granular Source Attribution
*For any* response using multiple sources, each piece of information should be clearly attributed to its specific source
**Validates: Requirements 4.4**

Property 16: Confidence Indicator Provision
*For any* historical claim made in responses, the system should provide confidence indicators based on source reliability and corroboration
**Validates: Requirements 4.5**

Property 17: Conflict Acknowledgment
*For any* topic where source documents contain conflicting information, the system should acknowledge discrepancies and present multiple viewpoints
**Validates: Requirements 4.6**

Property 18: Content Type Distinction
*For any* response containing both direct quotes and AI-generated interpretations, the system should clearly distinguish between the two types of content
**Validates: Requirements 4.7**

Property 19: Follow-up Suggestion Relevance
*For any* completed user query, the system should suggest 3-5 related follow-up questions that are topically relevant and non-repetitive within the conversation
**Validates: Requirements 5.2, 5.3**

Property 20: Thematic Suggestion Categorization
*For any* set of suggested prompts, they should be properly categorized by themes such as "Social Impact," "Innovation," "Leadership," and "Community Building"
**Validates: Requirements 5.4**

Property 21: Temporal Suggestion Relevance
*For any* query about a specific time period, suggested follow-ups should include related events, people, and programs from that same era
**Validates: Requirements 5.5**

Property 22: Proactive Engagement
*For any* conversation that shows signs of stagnation (repeated similar queries or long pauses), the system should offer new directions for exploration
**Validates: Requirements 5.6**

Property 23: Adaptive Suggestion Prioritization
*For any* suggestion generation, topics that are frequently queried by users should be prioritized in future suggestions
**Validates: Requirements 5.7**

Property 24: Comprehensive Analytics Tracking
*For any* user interaction with the system, all required metrics (query frequency, response times, user satisfaction) should be tracked and stored
**Validates: Requirements 6.1**

Property 25: Trend Analysis Accuracy
*For any* period of system usage, trending topics and frequently asked questions should be correctly identified from the aggregated usage data
**Validates: Requirements 6.2**

Property 26: Analytics Report Completeness
*For any* generated analytics report, it should include insights on language preferences, geographic usage patterns, and performance metrics
**Validates: Requirements 6.3, 6.4**

Property 27: Feedback Aggregation
*For any* user feedback provided to the system, ratings and comments should be properly collected and aggregated for analysis
**Validates: Requirements 6.5**

Property 28: Content Gap Identification
*For any* analysis period, the system should identify topics with high query volume but low-quality responses as content gaps
**Validates: Requirements 6.6**

Property 29: Data Anonymization
*For any* analytics processing, user data should be properly anonymized while maintaining analytical value
**Validates: Requirements 6.7**

Property 30: Auto-scaling Responsiveness
*For any* increase in system demand, compute resources should automatically adjust to maintain performance levels
**Validates: Requirements 7.7**

Property 31: Zero-downtime Deployment
*For any* system update deployment, the blue-green deployment process should complete without service interruption
**Validates: Requirements 7.8**

Property 32: Data Encryption in Transit
*For any* data transmission between system components, TLS 1.2 or higher encryption should be used
**Validates: Requirements 8.2**

Property 33: Data Encryption at Rest
*For any* data stored in the system, AWS KMS encryption should be applied
**Validates: Requirements 8.3**

Property 34: Least-privilege IAM Access
*For any* AWS service access, IAM roles should follow least-privilege principles with only necessary permissions granted
**Validates: Requirements 8.4**

Property 35: Document Access Control
*For any* sensitive historical document, access controls should be implemented based on document classification levels
**Validates: Requirements 8.5**

Property 36: Audit Trail Maintenance
*For any* system activity, audit trails should be maintained without exposing sensitive information
**Validates: Requirements 8.6**

Property 37: Data Deletion Compliance
*For any* user request for data deletion, personal information should be completely removed in compliance with privacy requirements
**Validates: Requirements 8.7**

Property 38: Processing Pipeline Extensibility
*For any* new document type introduced, the processing pipeline should support it without requiring system architecture changes
**Validates: Requirements 9.1**

Property 39: Metadata Schema Consistency
*For any* additional archive integration, metadata schemas and search capabilities should remain consistent across all archives
**Validates: Requirements 9.2**

Property 40: AI Model Upgrade Flexibility
*For any* new AI model that becomes available, the RAG pipeline should support integration without requiring system redesign
**Validates: Requirements 9.3**

Property 41: Language Pack Extensibility
*For any* new language addition, the system should support it through configuration changes without code modifications
**Validates: Requirements 9.4**

Property 42: Audio Processing Capability
*For any* oral history audio file, the system should support processing and transcription workflows
**Validates: Requirements 9.5**

Property 43: Mixed Media Embedding Support
*For any* new content type (text, image, audio, video), the Knowledge Base should support embedding generation and retrieval
**Validates: Requirements 9.7**

## Error Handling

### Document Processing Errors
- **Textract Failures**: Retry mechanism with exponential backoff, fallback to alternative OCR services
- **Embedding Generation Failures**: Queue failed documents for retry, maintain processing status tracking
- **S3 Access Errors**: Implement proper IAM permissions and error logging for debugging

### Query Processing Errors
- **Knowledge Base Unavailability**: Implement circuit breaker pattern with graceful degradation
- **Language Detection Failures**: Default to English with user notification for language selection
- **Bedrock Service Limits**: Implement request queuing and rate limiting with user feedback

### Frontend Error Handling
- **Network Connectivity Issues**: Offline mode with cached conversation history
- **API Timeout Errors**: Progressive retry with user notification and fallback responses
- **Authentication Failures**: Clear error messages with re-authentication flow

### Data Consistency Errors
- **Embedding Sync Issues**: Implement eventual consistency checks and repair mechanisms
- **Metadata Corruption**: Validation checks during ingestion with rollback capabilities
- **Citation Link Failures**: Fallback to document metadata when original links are unavailable

## Testing Strategy

### Dual Testing Approach
The system will employ both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions including:
- Individual component functionality (Lambda functions, API endpoints)
- Integration points between services (S3 → Step Functions, API Gateway → Lambda)
- Error handling scenarios and edge cases
- Authentication and authorization flows

**Property-Based Tests**: Verify universal properties across all inputs including:
- Document processing workflows with randomly generated documents
- Multilingual query processing with various language combinations
- Citation tracking and source attribution across different document types
- Analytics data collection and aggregation accuracy

### Property-Based Testing Configuration
- **Testing Framework**: AWS CDK Testing Framework with Jest for TypeScript components
- **Test Tagging**: Each property test tagged with format: **Feature: ymca-ai-chatbot, Property {number}: {property_text}**
- **Coverage Requirements**: Each correctness property must be implemented by exactly one property-based test

### Testing Infrastructure
- **Test Environment**: Dedicated AWS account with isolated resources
- **Data Generation**: Synthetic YMCA historical documents for testing without exposing sensitive archives
- **Performance Testing**: Load testing with simulated user traffic across multiple languages
- **Security Testing**: Penetration testing for authentication, authorization, and data protection

### Continuous Integration
- **Automated Testing**: All tests run on every commit with mandatory passing requirements
- **Deployment Gates**: Property-based tests must pass before production deployment
- **Monitoring Integration**: Test results integrated with CloudWatch for ongoing system health monitoring