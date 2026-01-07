# YMCA AI Multilingual Chatbot

An intelligent document processing and multilingual chatbot system designed for YMCA organizations. This AI-powered solution processes historical documents, extracts knowledge, and provides multilingual chat support to help YMCA staff and members access information efficiently across language barriers.

---

## Visual Demo

![YMCA AI Architecture](./docs/media/arch.png)

> **Architecture Overview**: The system uses AWS serverless architecture with Step Functions orchestrating document processing, Textract for OCR, Bedrock for AI capabilities, and a React frontend for user interaction.

---

## Table of Contents

| Index                                               | Description                                              |
| :-------------------------------------------------- | :------------------------------------------------------- |
| [High Level Architecture](#high-level-architecture) | High level overview illustrating component interactions  |
| [Deployment Guide](#deployment-guide)               | How to deploy the project                                |
| [User Guide](#user-guide)                           | End-user instructions and walkthrough                    |
| [API Documentation](#api-documentation)             | Documentation on the APIs the project uses               |
| [Directories](#directories)                         | General project directory structure                      |
| [Modification Guide](#modification-guide)           | Guide for developers extending the project               |
| [Credits](#credits)                                 | Contributors and acknowledgments                         |
| [License](#license)                                 | License information                                      |

---

## High Level Architecture

The YMCA AI system leverages AWS serverless architecture to create a scalable, multilingual document processing and chatbot solution. The system automatically processes uploaded documents through OCR, extracts knowledge using AI, and provides intelligent chat responses in multiple languages.

Key components include document ingestion via S3, automated processing through Step Functions and Textract, knowledge storage in Bedrock Knowledge Base, and a React-based frontend for user interaction.

![Architecture Diagram](./docs/media/ymca_updated_arch.png)

**Architecture Flow:**
1. **Document Upload** → Users upload historical documents via the web interface to S3 `input/` folder
2. **Document Processing** → Step Functions orchestrates OCR extraction via Textract
3. **Text Storage** → Processed text is saved to S3 `output/` folder in structured JSON format
4. **Knowledge Base** → Bedrock Knowledge Base reads from `output/` folder and creates embeddings using managed S3 Vectors
5. **Multilingual Chat** → Users interact with the AI agent through Amazon Translate
6. **Response Generation** → RAG system provides contextual answers from processed documents

For a detailed explanation of the architecture, see the [Architecture Deep Dive](./docs/architectureDeepDive.md).

---

## Deployment Guide

For complete deployment instructions, see the [Deployment Guide](./docs/deploymentGuide.md).

**🚀 One-Command Automated Deployment:**
```bash
# Clone and deploy everything automatically
git clone <repository-url>
cd YMCA_AI_Chatbot/backend
./scripts/deploy.sh --auto --admin-email your-admin@email.com
```

**What the automated deployment does:**
1. ✅ **CDK Infrastructure**: Deploys Step Functions, Lambda, S3, DynamoDB, API Gateway, Cognito
2. ✅ **Document Processing**: Complete Textract pipeline with S3 integration
3. ✅ **Bedrock Knowledge Base**: Automatically creates and configures with S3 data source
4. ✅ **Admin User Setup**: Creates Cognito admin user with provided email
5. ✅ **Lambda Configuration**: Updates environment variables with Knowledge Base ID
6. ✅ **Cost Optimization**: Uses Bedrock's managed S3 Vectors (90% cost savings)

**Deployment Options:**
```bash
# Fully automated deployment (recommended)
./scripts/deploy.sh --auto --admin-email admin@ymca.org

# Interactive deployment with prompts
./scripts/deploy.sh

# Skip specific components
./scripts/deploy.sh --skip-kb --skip-cognito

# Get help
./scripts/deploy.sh --help
```

**Prerequisites:**
- AWS CLI configured (`aws configure`)
- Node.js 18+ installed
- CDK CLI installed (`npm install -g aws-cdk`)

**CloudShell Ready:** The script works perfectly in AWS CloudShell with no additional setup required!

**🧹 Cleanup:**
```bash
# Remove all resources (with confirmation prompts)
./scripts/cleanup.sh

# Force cleanup without prompts
./scripts/cleanup.sh --force

# Keep S3 data during cleanup
./scripts/cleanup.sh --keep-data
```

**🔍 Validation:**
```bash
# Validate deployed infrastructure
./scripts/validate.sh
```

---

## ✨ What's New - Fully Automated Deployment

The YMCA AI system now features **100% automated deployment** with zero manual steps required! 

**🎯 One Command Does Everything:**
- ✅ Deploys complete AWS infrastructure via CDK
- ✅ **Automatically creates Bedrock Knowledge Base** with S3 data source
- ✅ **Automatically sets up Cognito admin user** with your email
- ✅ **Automatically configures Lambda environment variables**
- ✅ Provides cleanup scripts for easy resource removal

**Before vs After:**
- **Before**: 2 manual steps (Knowledge Base + Cognito setup)
- **After**: 0 manual steps - everything automated!

```bash
# Deploy everything with one command
./scripts/deploy.sh --auto --admin-email admin@ymca.org
```

---

## User Guide

For detailed usage instructions with screenshots, see the [User Guide](./docs/userGuide.md).

---

## API Documentation

For complete API reference, see the [API Documentation](./docs/APIDoc.md).

---

## Modification Guide

For developers looking to extend or modify this project, see the [Modification Guide](./docs/modificationGuide.md).

---

## Directories

```
├── backend/
│   ├── bin/
│   │   └── backend.ts
│   ├── lambda/
│   │   ├── batch-processor/
│   │   ├── textract-async/
│   │   └── textract-postprocessor/
│   ├── lib/
│   │   └── backend-stack.ts
│   ├── scripts/
│   │   ├── deploy.sh
│   │   └── destroy.sh
│   ├── test/
│   │   └── backend.test.ts
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── public/
│   │   └── [static assets]
│   ├── package.json
│   └── next.config.ts
├── docs/
│   ├── architectureDeepDive.md
│   ├── deploymentGuide.md
│   ├── userGuide.md
│   ├── APIDoc.md
│   ├── modificationGuide.md
│   └── media/
│       └── ymca_architecture.png
├── LICENSE
├── package-lock.json
└── README.md
```

### Directory Explanations:

1. **backend/** - Contains all backend infrastructure and serverless functions
   - `bin/` - CDK app entry point and configuration
   - `lambda/` - AWS Lambda function implementations for document processing
     - `batch-processor/` - Initiates document processing workflows
     - `textract-async/` - Starts OCR jobs for document text extraction
     - `textract-postprocessor/` - Processes OCR results for knowledge base
   - `lib/` - CDK stack definitions and infrastructure as code
   - `scripts/` - Deployment and management scripts
   - `test/` - Unit tests for backend components

2. **frontend/** - Next.js frontend application
   - `app/` - Next.js App Router pages and layouts
   - `public/` - Static assets (images, icons, etc.)

3. **docs/** - Project documentation and architecture diagrams
   - `media/` - Images, diagrams, and visual documentation

---

## Credits

This application was developed by:

- <a href="[INSERT_LINKEDIN_URL]" target="_blank">[INSERT_CONTRIBUTOR_NAME_1]</a>
- <a href="[INSERT_LINKEDIN_URL]" target="_blank">[INSERT_CONTRIBUTOR_NAME_2]</a>
- <a href="[INSERT_LINKEDIN_URL]" target="_blank">[INSERT_CONTRIBUTOR_NAME_3]</a>

[INSERT_ADDITIONAL_ACKNOWLEDGMENTS - Teams, supporters, or organizations to acknowledge]

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

