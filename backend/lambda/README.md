# YMCA AI Lambda Functions

This directory contains the Lambda functions for the YMCA AI document processing pipeline.

## Functions Overview

### 1. Batch Processor (`batch-processor/`)
**Purpose**: Initiates the document processing workflow when files are uploaded to S3.

**Trigger**: S3 event notification when files are uploaded to `input/` prefix
**Runtime**: Node.js 20.x
**Key Features**:
- Validates file types (PDF, PNG, JPG, JPEG, TIFF)
- Starts Step Functions workflow execution
- Generates unique processing IDs
- Error handling and logging

**Environment Variables**:
- `STEP_FUNCTION_ARN`: ARN of the document processing Step Functions workflow

### 2. Textract Async (`textract-async/`)
**Purpose**: Starts asynchronous Textract jobs for document text extraction.

**Trigger**: Step Functions workflow
**Runtime**: Node.js 20.x
**Key Features**:
- Supports both text detection and document analysis
- Handles PDFs with advanced analysis (tables, forms)
- Handles images with text detection
- Configurable output location in S3

**Environment Variables**:
- `DOCUMENTS_BUCKET`: Source S3 bucket name

### 3. Textract Postprocessor (`textract-postprocessor/`)
**Purpose**: Retrieves and processes Textract results for knowledge base ingestion.

**Trigger**: Step Functions workflow
**Runtime**: Node.js 20.x
**Key Features**:
- Retrieves completed Textract job results
- Processes both text detection and document analysis results
- Extracts structured data (tables, forms) from PDFs
- Saves processed content as JSON to vector store bucket
- Calculates metadata (word count, confidence scores, etc.)

**Environment Variables**:
- `DOCUMENTS_BUCKET`: Source S3 bucket name
- `VECTOR_STORE_BUCKET`: Destination S3 bucket for processed content

### 4. Check Textract Status (`check-textract-status/`)
**Purpose**: Monitors the status of asynchronous Textract jobs.

**Trigger**: Step Functions workflow
**Runtime**: Node.js 20.x
**Key Features**:
- Checks job status for both text detection and document analysis
- Returns detailed status information including error messages
- Handles job completion, failure, and in-progress states
- Provides status updates for Step Functions workflow decisions

**Environment Variables**: None required
- `DOCUMENTS_BUCKET`: Source S3 bucket name
- `VECTOR_STORE_BUCKET`: Destination S3 bucket for processed content

## Document Processing Flow

```
1. Document Upload → S3 (input/ prefix)
2. S3 Event → Batch Processor Lambda
3. Batch Processor → Starts Step Functions Workflow
4. Step Functions → Textract Async Lambda
5. Textract Async → Starts AWS Textract Job
6. Step Functions → Waits for Textract Completion
7. Step Functions → Check Textract Status Lambda
8. Check Status → Returns job status to Step Functions
9. Step Functions → Textract Postprocessor Lambda (if successful)
10. Textract Postprocessor → Retrieves & Processes Results
11. Processed Content → S3 (vector store bucket)
```

## Supported File Types

- **PDF**: Uses document analysis for tables and forms
- **Images**: PNG, JPG, JPEG, TIFF, TIF - Uses text detection

## Output Format

Processed documents are saved as JSON files with the following structure:

```json
{
  "sourceDocument": "input/document.pdf",
  "processingId": "doc-1234567890-abc123",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "operationType": "ANALYSIS",
  "textContent": "Extracted text content...",
  "metadata": {
    "pageCount": 5,
    "wordCount": 1250,
    "hasStructuredData": true,
    "confidence": 95.5
  },
  "structuredData": {
    "tables": [...],
    "forms": [...]
  }
}
```

## Development

Each function has its own `package.json` with specific dependencies:

- `@aws-sdk/client-sfn`: Step Functions client
- `@aws-sdk/client-textract`: Textract client  
- `@aws-sdk/client-s3`: S3 client

## Deployment

Functions are deployed automatically via CDK using `lambda.Code.fromAsset()` which packages the function code and dependencies.

## Error Handling

All functions include comprehensive error handling:
- Input validation
- AWS service error handling
- Structured error responses
- CloudWatch logging

## Next Steps

After document processing, the processed content in the vector store bucket will be:
1. Ingested into Amazon Bedrock Knowledge Base
2. Used by the RAG Lambda function for chat responses
3. Indexed for semantic search capabilities