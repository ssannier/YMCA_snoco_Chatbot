# Deployment Guide

This guide provides step-by-step instructions for deploying the YMCA AI Chatbot.

---

## Table of Contents

- [Deployment Guide](#deployment-guide)
  - [Requirements](#requirements)
  - [Pre-Deployment](#pre-deployment)
    - [AWS Account Setup](#aws-account-setup)
    - [CLI Tools Installation](#cli-tools-installation)
    - [GitHub Configuration](#github-configuration)
    - [Environment Configuration](#environment-configuration)
  - [Deployment](#deployment)
    - [Automated Deployment (Recommended)](#automated-deployment-recommended)
    - [Manual Deployment](#manual-deployment)
  - [Post-Deployment Verification](#post-deployment-verification)
  - [Troubleshooting](#troubleshooting)
  - [Cleanup](#cleanup)

---

## Requirements

Before you deploy, you must have the following:

### Accounts
- [ ] **AWS Account** - [Create an AWS Account](https://aws.amazon.com/)
- [ ] **GitHub Account** - [Create a GitHub Account](https://github.com/)
  - Required for Amplify frontend deployment
  - Personal Access Token with `repo` and `admin:repo_hook` scopes

### CLI Tools
- [ ] **AWS CLI** (v2.x) - [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [ ] **Node.js** (v18.x or later) - [Install Node.js](https://nodejs.org/)
- [ ] **npm** (v9.x or later) - Included with Node.js
- [ ] **AWS CDK** (v2.x) - Install via `npm install -g aws-cdk`
- [ ] **Git** - [Install Git](https://git-scm.com/downloads)
- [ ] **jq** (for JSON parsing in deployment script) - [Install jq](https://stedolan.github.io/jq/)

### Access Permissions
- [ ] AWS IAM user/role with permissions for:
  - CloudFormation
  - Lambda (including Function URLs)
  - S3
  - DynamoDB
  - Cognito
  - Bedrock
  - Textract
  - Translate
  - Step Functions
  - Amplify
  - IAM (for creating roles and policies)
  - Secrets Manager
- [ ] Administrator or Power User access recommended for initial deployment

### Software Dependencies
- [ ] **Bedrock Model Access**: Request access to Amazon Bedrock models in AWS Console
  - Amazon Nova Pro
  - Amazon Titan Text Embeddings V2
  - You can check this using the invoke-model command
     ```bash
   aws bedrock invoke-model --model-id <model-id> --input-text <input-text>
   ```

---

## Pre-Deployment

### AWS Account Setup

1. **Configure AWS CLI**
   ```bash
   aws configure
   ```
   Enter your:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region: `us-west-2` (recommended, or choose your preferred region)
   - Default output format: `json`

2. **Verify AWS CLI configuration**
   ```bash
   aws sts get-caller-identity
   ```
   This should return your AWS account ID and user/role information.

3. **Bootstrap CDK** (first-time CDK users only)
   ```bash
   # Get your AWS account ID
   export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   export AWS_REGION=$(aws configure get region)

   # Bootstrap CDK
   cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
   ```

### CLI Tools Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ASUCICREPO/YMCA_snoco_Chatbot.git
   cd YMCA_snoco_Chatbot
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Install frontend dependencies** (optional, for local testing)
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Install AWS CDK globally** (if not already installed)
   ```bash
   npm install -g aws-cdk
   ```

### GitHub Configuration

For Amplify to deploy the frontend, you need:

1. **Create a GitHub Personal Access Token**
   - Go to: https://github.com/settings/tokens/new
   - **Note**: "YMCA Amplify Deployment"
   - **Scopes**: Select `repo` and `admin:repo_hook`
   - Click **Generate token**
   - **Save the token** - you'll need it during deployment

2. **Fork or use the repository**
   - If using a private fork, ensure the GitHub token has access
   - Default repository: `ASUCICREPO/YMCA_snoco_Chatbot`
   - You can use your own fork by updating the owner/repo during deployment

### Environment Configuration

#### Backend Configuration

The deployment script will prompt you for configuration and create a .env file automatically in the backend/ dir containing the following format

```bash
# backend/.env

# AWS Configuration
AWS_REGION=us-west-2
ACCOUNT_ID=123456789012

# GitHub Configuration for Amplify
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=ASUCICREPO
GITHUB_REPO=YMCA_snoco_Chatbot

# Admin User Configuration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourSecurePassword123!

# Stack Configuration
STACK_NAME=YmcaAiStack
API_STAGE=prod

# DynamoDB Tables
CONVERSATION_TABLE=ymca-conversations
ANALYTICS_TABLE=ymca-analytics

# Lambda Configuration
LAMBDA_TIMEOUT=900
LAMBDA_MEMORY=1024
```

#### Frontend Configuration (Optional - Local Development Only)

> **Important**: You do **NOT** need to configure `frontend/.env.local` before deployment. The CDK stack automatically injects all required environment variables into Amplify during the build process.

The `frontend/.env.local` file is **only needed if you want to run the frontend locally** for development:

```bash
# frontend/.env.local (ONLY for local development)

# Backend API Configuration
NEXT_PUBLIC_API_ENDPOINT=https://your-api-id.execute-api.region.amazonaws.com/prod/
NEXT_PUBLIC_STREAMING_ENDPOINT=https://your-function-url.lambda-url.region.on.aws/

# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-west-2
NEXT_PUBLIC_USER_POOL_ID=us-west-2_XXXXXXXXX
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-client-id
NEXT_PUBLIC_IDENTITY_POOL_ID=us-west-2:xxxx-xxxx-xxxx-xxxx
NEXT_PUBLIC_ANALYTICS_TABLE_NAME=ymca-analytics
NEXT_PUBLIC_CONVERSATION_TABLE_NAME=ymca-conversations
```

**To populate after deployment** (optional, for local development):
1. Get values from CDK outputs: `cat backend/outputs.json`
2. Update `frontend/.env.local` with the actual values
3. Run `cd frontend && npm run dev` to test locally

---

## Deployment

### Automated Deployment (Recommended)

The `deploy.sh` script automates the entire deployment process. 

> **Important**: You need to navigate to the root directory where the deploy.sh file is located. 

1. **Make the script executable**
   ```bash
   chmod +x deploy.sh
   ```

2. **Run the deployment script**
   ```bash
   ./deploy.sh
   ```

3. **Follow the prompts**

   The script will ask for:
   - **AWS Region** (default: us-west-2)
   - **GitHub Personal Access Token**
   - **GitHub Owner** (default: ASUCICREPO)
   - **GitHub Repository** (default: YMCA_snoco_Chatbot)
   - **Admin Email** (for Cognito user)
   - **Admin Password** (minimum 8 chars, must include uppercase, lowercase, number, special char)

4. **Wait for deployment to complete**

   The script will:
   - Install dependencies
   - Build TypeScript code
   - Bootstrap CDK (if needed)
   - Deploy all AWS resources (10-15 minutes)
   - Create admin user in Cognito
   - Trigger Amplify frontend build (3-5 minutes)

5. **Save the outputs**

   When deployment completes, the script displays:
   - Streaming Function URL (Lambda Function URL)
   - Amplify App URL
   - Cognito User Pool IDs
   - S3 Bucket names
   - DynamoDB Table names

   All configuration is saved to `backend/.env` and `backend/outputs.json`

### Manual Deployment

If you prefer to deploy manually:

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   ```

3. **Set environment variables** (create `backend/.env` as shown above)

4. **Synthesize the CloudFormation template** (optional, for review)
   ```bash
   cdk synth
   ```

5. **Deploy the backend stack**
   ```bash
   cdk deploy --require-approval never --outputs-file outputs.json
   ```

   This will deploy:
   - S3 buckets (documents, vectors)
   - Lambda functions with Function URLs (RAG streaming, document processing)
   - DynamoDB tables
   - Cognito User Pool and Identity Pool
   - Step Functions workflow
   - Bedrock Knowledge Base
   - Amplify App

6. **Create admin user in Cognito**
   ```bash
   # Extract User Pool ID from outputs
   USER_POOL_ID=$(jq -r '.YmcaAiStack.UserPoolId' outputs.json)
   USER_POOL_CLIENT_ID=$(jq -r '.YmcaAiStack.UserPoolClientId' outputs.json)

   # Create user
   aws cognito-idp admin-create-user \
     --user-pool-id "$USER_POOL_ID" \
     --username "admin@example.com" \
     --user-attributes Name=email,Value="admin@example.com" Name=email_verified,Value=true \
     --message-action SUPPRESS \
     --region $AWS_REGION

   # Set permanent password
   aws cognito-idp admin-set-user-password \
     --user-pool-id "$USER_POOL_ID" \
     --username "admin@example.com" \
     --password "YourSecurePassword123!" \
     --permanent \
     --region $AWS_REGION
   ```

7. **Wait for Amplify build**

   The Amplify app will automatically build the frontend from GitHub. Monitor the build:
   - Go to: AWS Console → Amplify → Apps → YmcaAmplifyAppV2
   - Check the build status under the `main` branch
   - Build typically takes 3-5 minutes

---

## Post-Deployment Verification

### Verify Backend Deployment

1. **Check CloudFormation stack status**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name YmcaAiStack \
     --query 'Stacks[0].StackStatus' \
     --output text
   ```

   Expected status: `CREATE_COMPLETE` or `UPDATE_COMPLETE`

2. **Test Lambda Function URL endpoint**
   ```bash
   # Get Lambda Function URL from outputs
   STREAMING_URL=$(aws cloudformation describe-stacks \
     --stack-name YmcaAiStack \
     --query 'Stacks[0].Outputs[?OutputKey==`StreamingFunctionUrl`].OutputValue' \
     --output text)

   # Test the streaming chat endpoint (requires uploading documents first for meaningful responses)
   curl -X POST "${STREAMING_URL}" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Hello, what can you tell me about the YMCA?",
       "conversationId": "test-123",
       "language": "en"
     }' \
     --no-buffer
   ```

   Expected response: Server-Sent Events (SSE) stream with streaming text chunks

3. **Check Lambda functions**
   ```bash
   aws lambda list-functions \
     --query "Functions[?contains(FunctionName, 'ymca')].FunctionName" \
     --output table
   ```

   Expected functions:
   - ymca-agent-proxy
   - ymca-agent-proxy-streaming
   - ymca-batch-processor
   - ymca-textract-async
   - ymca-check-textract-status
   - ymca-textract-postprocessor

4. **Check DynamoDB tables**
   ```bash
   aws dynamodb list-tables \
     --query "TableNames[?contains(@, 'ymca')]" \
     --output table
   ```

   Expected tables:
   - ymca-conversations
   - ymca-analytics

5. **Check S3 buckets**
   ```bash
   aws s3 ls | grep ymca
   ```

   Expected buckets:
   - ymca-documents-{account}-{region}
   - ymca-vectors-{account}-{region}

### Verify Frontend Deployment

1. **Get Amplify App URL**
   ```bash
   AMPLIFY_URL=$(aws cloudformation describe-stacks \
     --stack-name YmcaAiStack \
     --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' \
     --output text)

   echo "Frontend URL: $AMPLIFY_URL"
   ```

2. **Access the application**

   Navigate to the Amplify URL in your browser

3. **Test basic functionality**
   - [ ] Homepage loads with topic cards
   - [ ] Can navigate to chat page
   - [ ] Chat interface is responsive
   - [ ] Can access admin page (requires login)
   - [ ] Admin login works with created credentials
   - [ ] Can upload documents in admin panel
   - [ ] Can view analytics (after chat interactions)

---

## Troubleshooting

### Common Issues

#### Issue: CDK Bootstrap Error
**Symptoms**: Error message about CDK not being bootstrapped

**Solution**:
```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=$(aws configure get region)
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION --force
```

#### Issue: Permission Denied
**Symptoms**: Access denied errors during deployment

**Solution**:
- Verify your AWS credentials are configured correctly: `aws sts get-caller-identity`
- Ensure your IAM user/role has the required permissions
- Check if you're deploying to the correct region
- Try using Administrator access for initial deployment

#### Issue: Bedrock Model Access
**Symptoms**: Error invoking Bedrock models

**Solution**:
- Go to AWS Console → Bedrock → Model access
- Request access to Amazon Nova Pro and Titan Text Embeddings V2
- Wait for approval (usually instant for standard models)
- Retry deployment after approval

#### Issue: GitHub Token Invalid
**Symptoms**: Amplify deployment fails with authentication error

**Solution**:
- Verify the GitHub token has correct scopes (`repo`, `admin:repo_hook`)
- Check if the token has expired
- Ensure the token has access to the specified repository
- Generate a new token if needed and update `backend/.env`

#### Issue: Amplify Build Failing
**Symptoms**: Amplify build fails in AWS Console

**Solution**:
- Check build logs in Amplify Console
- Verify environment variables are set correctly
- Ensure frontend code builds locally: `cd frontend && npm run build`
- Check that API endpoints are correctly injected
- Trigger a manual rebuild in Amplify Console

#### Issue: Lambda Function Timeout
**Symptoms**: API requests timeout or return 502/504 errors

**Solution**:
- Check CloudWatch Logs for the Lambda function
- Verify Knowledge Base has indexed documents
- Increase Lambda timeout in CDK stack if needed
- Use streaming endpoint for better performance

#### Issue: No Documents in Knowledge Base
**Symptoms**: Chat responses say "I don't have information about that"

**Solution**:
- Upload documents to S3 bucket: `aws s3 cp document.pdf s3://ymca-documents-{account}-{region}/input/`
- Check Step Functions execution status in AWS Console
- Verify Textract job completed successfully
- Check that processed documents are in `output/processed-text/` prefix
- Manually sync Knowledge Base if needed

---

## Cleanup

To remove all deployed resources:

1. **Using the cleanup script** (Recommended)
   ```bash
   # Make the script executable
   chmod +x cleanup.sh

   # Run the cleanup script
   ./cleanup.sh
   ```

   The script will:
   - Prompt for confirmation before deleting resources
   - Ask whether to delete S3 buckets and DynamoDB tables (RETAIN policy)
   - Delete the CloudFormation stack and all associated resources
   - Optionally clean up local build artifacts

2. **Manual cleanup**
   ```bash
   cd backend
   cdk destroy
   ```

   This will delete:
   - Lambda functions and Function URLs
   - Step Functions
   - Cognito User Pool and Identity Pool
   - Amplify App

   **Note**: S3 buckets and DynamoDB tables are retained by default. To delete them:

   ```bash
   # List buckets
   aws s3 ls | grep ymca

   # Empty and delete documents bucket
   aws s3 rm s3://ymca-documents-{account}-{region} --recursive
   aws s3 rb s3://ymca-documents-{account}-{region}

   # Empty and delete vectors bucket
   aws s3 rm s3://ymca-vectors-{account}-{region} --recursive
   aws s3 rb s3://ymca-vectors-{account}-{region}

   # Delete DynamoDB tables
   aws dynamodb delete-table --table-name ymca-conversations
   aws dynamodb delete-table --table-name ymca-analytics
   ```

> **Warning**: This will delete all resources created by this stack. Make sure to backup any important data (documents, conversation history, analytics) before proceeding.

---

## Next Steps

After successful deployment:
1. **Upload Documents**: Upload YMCA historical documents to the S3 bucket for the knowledge base
   ```bash
   aws s3 cp your-document.pdf s3://ymca-documents-{account}-{region}/input/
   ```
2. Review the [User Guide](./userGuide.md) to learn how to use the application
3. Check the [API Documentation](./APIDoc.md) for integration details
4. See the [Modification Guide](./modificationGuide.md) for customization options
5. Review the [Streaming Integration Guide](./streamingIntegration.md) for streaming configuration
