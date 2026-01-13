# YMCA AI Backend Infrastructure

This directory contains the AWS CDK infrastructure code for the YMCA AI multilingual chatbot system.

## Architecture Overview

The YMCA AI system is built using a serverless architecture on AWS with the following key components:

- **S3 Buckets**: Storage for raw documents, processed documents, and vector embeddings
- **Lambda Functions**: Serverless compute with Function URLs for document processing and chat functionality
- **DynamoDB**: NoSQL database for conversation history and analytics
- **KMS**: Encryption key management for data security
- **IAM**: Least-privilege access control

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+ installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Deploy the infrastructure**:
   ```bash
   npm run deploy
   ```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and recompile
- `npm run test` - Run unit tests
- `npm run deploy` - Deploy the CDK stack to AWS
- `npm run destroy` - Destroy the CDK stack (use with caution)
- `npm run diff` - Show differences between local and deployed stack
- `npm run synth` - Synthesize CloudFormation template
- `npm run bootstrap` - Bootstrap CDK in your AWS account/region

## Stack Components

### S3 Buckets

- **Documents Bucket**: Single bucket with `input/` prefix for raw documents and `output/` prefix for processed documents
- **Vector Store Bucket**: Stores document embeddings and metadata

### Lambda Functions

- **Agent Proxy**: Main RAG function for handling chat queries
- **Batch Processor**: Initiates document processing workflows
- **Textract Async**: Manages OCR job lifecycle
- **Textract Postprocessor**: Processes OCR results and generates embeddings

### DynamoDB Tables

- **Conversation Table**: Stores chat conversations and user interactions
- **Analytics Table**: Stores usage metrics and analytics data

### Security Features

- **KMS Encryption**: All data encrypted at rest using customer-managed keys
- **IAM Roles**: Least-privilege access for all services
- **VPC**: Optional VPC deployment for enhanced security
- **SSL/TLS**: All data encrypted in transit

## Environment Configuration

The stack supports multiple environments through environment variables:

- `NODE_ENV`: Environment name (development, staging, production)
- `CDK_DEFAULT_ACCOUNT`: AWS account ID
- `CDK_DEFAULT_REGION`: AWS region (defaults to us-east-1)

## Monitoring and Logging

- CloudWatch Logs for all Lambda functions
- Lambda Function URL access logging
- DynamoDB point-in-time recovery enabled
- CloudWatch metrics and alarms (to be configured)

## Cost Optimization

- Pay-per-request billing for DynamoDB
- Serverless Lambda functions with appropriate memory allocation
- S3 lifecycle policies for cost-effective storage
- Lambda concurrency limits to prevent unexpected costs

## Security Best Practices

- All S3 buckets block public access
- Encryption at rest for all data stores
- IAM roles follow least-privilege principle
- SSL enforcement for all data in transit
- KMS key rotation enabled

## Deployment Environments

The infrastructure supports multiple deployment environments:

- **Development**: Single stack with minimal resources
- **Staging**: Production-like environment for testing
- **Production**: Full-scale deployment with enhanced monitoring

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**: Run `npm run bootstrap` if you haven't used CDK in this region
2. **Permission Denied**: Ensure your AWS credentials have sufficient permissions
3. **Resource Limits**: Check AWS service limits if deployment fails

### Useful Commands

- View stack outputs: `cdk deploy --outputs-file outputs.json`
- List all stacks: `cdk list`
- View synthesized template: `cdk synth > template.yaml`

## Next Steps

After deploying the infrastructure:

1. Implement Lambda function code (Tasks 2-4)
2. Configure Bedrock Knowledge Base (Task 6)
3. Set up Step Functions workflow (Task 4)
4. Deploy frontend application (Task 11)

## Support

For issues or questions about the infrastructure, please refer to:

- AWS CDK Documentation: https://docs.aws.amazon.com/cdk/
- YMCA AI Project Documentation: `../docs/`
- AWS Well-Architected Framework: https://aws.amazon.com/architecture/well-architected/