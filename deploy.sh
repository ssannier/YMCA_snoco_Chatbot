#!/bin/bash
# YMCA Chatbot - Complete End-to-End Deployment
# Deploys backend infrastructure and connects frontend via Amplify

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ymca-chatbot"
STACK_NAME="YmcaAiStack"
REPOSITORY_URL="https://github.com/ASUCICREPO/YMCA_snoco_Chatbot.git"

# Global variables
AWS_REGION=""
AWS_ACCOUNT_ID=""
GITHUB_TOKEN=""
GITHUB_OWNER=""
GITHUB_REPO=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
STREAMING_URL=""
USER_POOL_ID=""
USER_POOL_CLIENT_ID=""
AMPLIFY_URL=""
DOCUMENTS_BUCKET=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
    echo ""
}

# --- Phase 0: Environment Setup and Validation ---
print_header "Phase 0: Environment Setup"

# Change to script directory
cd "$(dirname "$0")"

# Detect AWS Region
print_status "Detecting AWS configuration..."
AWS_REGION=${AWS_REGION:-$(aws configure get region 2>/dev/null || echo "")}

if [ -z "$AWS_REGION" ]; then
    print_warning "AWS region not configured"
    read -p "Enter AWS region (default: us-west-2): " input_region
    AWS_REGION=${input_region:-us-west-2}
fi

print_success "AWS Region: $AWS_REGION"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

if [ -z "$AWS_ACCOUNT_ID" ]; then
    print_error "Unable to get AWS Account ID. Please configure AWS CLI with 'aws configure'"
fi

print_success "AWS Account ID: $AWS_ACCOUNT_ID"

# Check for existing .env file in backend directory
ENV_FILE="backend/.env"
if [ -f "$ENV_FILE" ]; then
    print_status "Found existing .env file. Loading configuration..."
    
    # Load existing values
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs 2>/dev/null || true)
    
    GITHUB_TOKEN=${GITHUB_TOKEN:-}
    GITHUB_OWNER=${GITHUB_OWNER:-}
    GITHUB_REPO=${GITHUB_REPO:-}
    ADMIN_EMAIL=${ADMIN_EMAIL:-}
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
else
    print_status "No .env file found. Will prompt for configuration..."
fi

# --- GitHub Configuration ---
print_header "GitHub Configuration for Amplify"

echo "Amplify needs a GitHub Personal Access Token to deploy your frontend."
echo "The token should have 'repo' and 'admin:repo_hook' scopes."
echo "Create one at: https://github.com/settings/tokens/new"
echo ""

# GitHub Token
if [ -z "$GITHUB_TOKEN" ]; then
    read -p "GitHub Personal Access Token: " GITHUB_TOKEN
    if [ -z "$GITHUB_TOKEN" ]; then
        print_error "GitHub token is required for Amplify deployment"
    fi
else
    print_success "Using GitHub token from .env"
fi

# GitHub Owner
if [ -z "$GITHUB_OWNER" ]; then
    read -p "GitHub Owner/Organization (default: ASUCICREPO): " input_owner
    GITHUB_OWNER=${input_owner:-ASUCICREPO}
else
    print_success "Using GitHub owner from .env: $GITHUB_OWNER"
fi

# GitHub Repo
if [ -z "$GITHUB_REPO" ]; then
    read -p "GitHub Repository name (default: YMCA_snoco_Chatbot): " input_repo
    GITHUB_REPO=${input_repo:-YMCA_snoco_Chatbot}
else
    print_success "Using GitHub repo from .env: $GITHUB_REPO"
fi

print_success "GitHub configuration complete"

# --- Admin User Configuration ---
print_header "Cognito Admin User Setup"

echo "An admin user will be created in Cognito for accessing the admin panel."
echo ""

# Admin Email
if [ -z "$ADMIN_EMAIL" ]; then
    while true; do
        read -p "Admin email address: " ADMIN_EMAIL
        if [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            break
        else
            print_warning "Invalid email format. Please try again."
        fi
    done
else
    print_success "Using admin email from .env: $ADMIN_EMAIL"
fi

# Admin Password
if [ -z "$ADMIN_PASSWORD" ]; then
    while true; do
        read -s -p "Admin password (min 8 chars, needs uppercase, lowercase, number, special char): " ADMIN_PASSWORD
        echo ""
        read -s -p "Confirm password: " ADMIN_PASSWORD_CONFIRM
        echo ""
        
        if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
            print_warning "Passwords don't match. Please try again."
            continue
        fi
        
        # Basic password validation
        if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
            print_warning "Password must be at least 8 characters"
            continue
        fi
        
        break
    done
else
    print_success "Using admin password from .env"
fi

print_success "Admin user configuration complete"

# Save configuration to .env
print_status "Saving configuration to backend/.env..."

cat > "$ENV_FILE" << ENVFILE
# YMCA AI Chatbot Environment Variables
# Auto-generated by deploy.sh on $(date)

# AWS Configuration
AWS_REGION=$AWS_REGION
ACCOUNT_ID=$AWS_ACCOUNT_ID

# GitHub Configuration for Amplify
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_OWNER=$GITHUB_OWNER
GITHUB_REPO=$GITHUB_REPO

# Admin User Configuration
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Stack Configuration
STACK_NAME=$STACK_NAME
API_STAGE=prod

# DynamoDB Tables
CONVERSATION_TABLE=ymca-conversations
ANALYTICS_TABLE=ymca-analytics

# Lambda Configuration
LAMBDA_TIMEOUT=900
LAMBDA_MEMORY=1024
ENVFILE

print_success "Configuration saved to $ENV_FILE"

# --- Phase 1: Install Dependencies ---
print_header "Phase 1: Installing Dependencies"

print_status "Installing backend dependencies..."
cd backend
npm ci

print_status "Building TypeScript..."
npm run build

print_success "Dependencies installed and built"

# --- Phase 2: Bootstrap CDK ---
print_header "Phase 2: Bootstrapping CDK"

print_status "Checking CDK version..."
if ! command -v cdk &> /dev/null; then
    print_status "Installing AWS CDK CLI..."
    npm install -g aws-cdk@latest
fi

cdk --version

print_status "Bootstrapping CDK environment..."
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION --force

print_success "CDK bootstrapped"

# --- Phase 3: Deploy CDK Stack ---
print_header "Phase 3: Deploying CDK Stack"

print_status "Deploying stack: $STACK_NAME"
print_status "This may take 10-15 minutes..."
print_status "Components being deployed:"
echo "  - S3 Vectors & Bedrock Knowledge Base"
echo "  - Lambda functions with Function URLs (streaming chat)"
echo "  - DynamoDB tables"
echo "  - Cognito User Pool"
echo "  - Amplify App (connected to GitHub)"
echo "  - Step Functions for document processing"
echo ""

cdk deploy $STACK_NAME --require-approval never --outputs-file outputs.json

if [ $? -ne 0 ]; then
    print_error "CDK deployment failed"
fi

print_success "CDK stack deployed successfully!"

# --- Phase 4: Extract Outputs ---
print_header "Phase 4: Extracting Deployment Outputs"

if [ ! -f outputs.json ]; then
    print_warning "outputs.json not found. Fetching from CloudFormation..."
fi

print_status "Retrieving stack outputs..."

STREAMING_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`StreamingFunctionUrl`].OutputValue' --output text --region $AWS_REGION)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text --region $AWS_REGION)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text --region $AWS_REGION)
AMPLIFY_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' --output text --region $AWS_REGION)
DOCUMENTS_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`DocumentsBucketName`].OutputValue' --output text --region $AWS_REGION)

print_success "Outputs extracted successfully"

# --- Phase 5: Create Cognito Admin User ---
print_header "Phase 5: Creating Cognito Admin User"

if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "None" ]; then
    print_status "Creating admin user: $ADMIN_EMAIL"

    # Check if user already exists
    EXISTING_USER=$(aws cognito-idp list-users \
        --user-pool-id "$USER_POOL_ID" \
        --filter "email = \"$ADMIN_EMAIL\"" \
        --region $AWS_REGION \
        --query 'Users[0].Username' \
        --output text 2>/dev/null || echo "None")

    if [ "$EXISTING_USER" != "None" ] && [ -n "$EXISTING_USER" ]; then
        print_warning "User $ADMIN_EMAIL already exists (Username: $EXISTING_USER)"
        print_status "Updating password for existing user..."

        # Set permanent password for existing user
        aws cognito-idp admin-set-user-password \
            --user-pool-id "$USER_POOL_ID" \
            --username "$ADMIN_EMAIL" \
            --password "$ADMIN_PASSWORD" \
            --permanent \
            --region $AWS_REGION > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            print_success "Password updated successfully"
        else
            print_warning "Could not update password. Please reset it manually in AWS Console."
        fi
    else
        # Create new user with permanent password (simpler approach)
        print_status "Creating new admin user..."

        # Create user with a temporary password first
        TEMP_PASSWORD="TempPass@$(date +%s)"

        aws cognito-idp admin-create-user \
            --user-pool-id "$USER_POOL_ID" \
            --username "$ADMIN_EMAIL" \
            --user-attributes Name=email,Value="$ADMIN_EMAIL" Name=email_verified,Value=true \
            --temporary-password "$TEMP_PASSWORD" \
            --message-action SUPPRESS \
            --region $AWS_REGION > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            print_success "Admin user created"

            # Wait for user creation to propagate
            print_status "Setting permanent password..."
            sleep 3

            # Set permanent password directly (more reliable than auth flow)
            aws cognito-idp admin-set-user-password \
                --user-pool-id "$USER_POOL_ID" \
                --username "$ADMIN_EMAIL" \
                --password "$ADMIN_PASSWORD" \
                --permanent \
                --region $AWS_REGION > /dev/null 2>&1

            if [ $? -eq 0 ]; then
                print_success "Permanent password set successfully"

                # Verify user status
                USER_STATUS=$(aws cognito-idp admin-get-user \
                    --user-pool-id "$USER_POOL_ID" \
                    --username "$ADMIN_EMAIL" \
                    --region $AWS_REGION \
                    --query 'UserStatus' \
                    --output text 2>/dev/null)

                if [ "$USER_STATUS" = "CONFIRMED" ]; then
                    print_success "User status: CONFIRMED - Ready to login!"
                else
                    print_warning "User status: $USER_STATUS"
                fi
            else
                print_warning "Could not set permanent password automatically"
                print_status "You can set it manually with:"
                echo "  aws cognito-idp admin-set-user-password \\"
                echo "    --user-pool-id $USER_POOL_ID \\"
                echo "    --username $ADMIN_EMAIL \\"
                echo "    --password YOUR_PASSWORD \\"
                echo "    --permanent \\"
                echo "    --region $AWS_REGION"
            fi
        else
            print_warning "Failed to create admin user"
            print_status "You can create it manually in the AWS Cognito Console"
        fi
    fi
else
    print_warning "User Pool ID not found. Skipping admin user creation."
fi

# --- Phase 6: Amplify Build Status ---
print_header "Phase 6: Frontend Deployment Status"

print_status "CDK automatically triggered an Amplify build"
print_status "The frontend is being built and deployed from your GitHub repository"
echo ""
print_status "You can monitor the build progress at:"
print_status "https://console.aws.amazon.com/amplify/"
echo ""
print_warning "Note: The Amplify build may take 3-5 minutes to complete"
print_status "The frontend will be available at $AMPLIFY_URL once the build finishes"

# --- Final Summary ---
print_header "DEPLOYMENT SUMMARY"

cat << SUMMARY

${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}

${PURPLE}═══════════════════════════════════════════════════════════════${NC}
${PURPLE}Deployment Information${NC}
${PURPLE}═══════════════════════════════════════════════════════════════${NC}

${BLUE}Stack Details:${NC}
  Stack Name:           $STACK_NAME
  AWS Region:           $AWS_REGION
  AWS Account:          $AWS_ACCOUNT_ID

${BLUE}API Endpoint:${NC}
  Streaming Function URL: $STREAMING_URL

${BLUE}Frontend:${NC}
  Frontend URL:         $AMPLIFY_URL
  Status:               Build in progress (check Amplify console)

${BLUE}Authentication:${NC}
  User Pool ID:         $USER_POOL_ID
  User Pool Client ID:  $USER_POOL_CLIENT_ID
  Admin Email:          $ADMIN_EMAIL
  Admin Password:       (saved in backend/.env)

${BLUE}Storage:${NC}
  Documents Bucket:     $DOCUMENTS_BUCKET
  Upload to:            s3://$DOCUMENTS_BUCKET/input/
  Processed from:       s3://$DOCUMENTS_BUCKET/output/processed-text/

${PURPLE}═══════════════════════════════════════════════════════════════${NC}
${PURPLE}What Was Deployed${NC}
${PURPLE}═══════════════════════════════════════════════════════════════${NC}

  ✅ S3 Vectors infrastructure for embeddings
  ✅ Bedrock Knowledge Base with S3 data source
  ✅ Lambda functions with Function URLs (streaming chat, document processing)
  ✅ DynamoDB tables (conversations, analytics)
  ✅ Cognito User Pool with admin user
  ✅ Step Functions for document processing pipeline
  ✅ Amplify App connected to GitHub
  ✅ Automated Amplify build triggered

${PURPLE}═══════════════════════════════════════════════════════════════${NC}
${PURPLE}Next Steps${NC}
${PURPLE}═══════════════════════════════════════════════════════════════${NC}

${GREEN}1. Wait for Frontend Build to Complete${NC}
   - Check build status: https://console.aws.amazon.com/amplify/
   - Build typically takes 3-5 minutes
   - Frontend will be live at: $AMPLIFY_URL

${GREEN}2. Access the Application${NC}
   - Open: $AMPLIFY_URL
   - Login with: $ADMIN_EMAIL
   - Use password from backend/.env file

${GREEN}3. Populate the Knowledge Base${NC}
   Upload documents to trigger automatic processing:
   
   ${BLUE}aws s3 cp your-document.pdf s3://$DOCUMENTS_BUCKET/input/${NC}
   
   The system will automatically:
   - Process the document with Textract
   - Extract text and structure
   - Store in the knowledge base
   - Make it available for chat queries

${GREEN}4. Test the Chat Interface${NC}
   - Visit the frontend URL
   - Try asking questions about YMCA history
   - Test multiple languages (English, Spanish, etc.)

${GREEN}5. Monitor the System${NC}
   - CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/
   - Bedrock Knowledge Base: https://console.aws.amazon.com/bedrock/
   - S3 Bucket: https://s3.console.aws.amazon.com/s3/buckets/$DOCUMENTS_BUCKET

${PURPLE}═══════════════════════════════════════════════════════════════${NC}
${PURPLE}Important Notes${NC}
${PURPLE}═══════════════════════════════════════════════════════════════${NC}

  📝 Configuration saved to: backend/.env
  📝 CDK outputs saved to: backend/outputs.json
  🔄 Future updates: Just push to GitHub (Amplify auto-builds)
  🗑️  To remove everything: Run ./cleanup.sh

${PURPLE}═══════════════════════════════════════════════════════════════${NC}

${GREEN}Deployment complete! 🚀${NC}

SUMMARY

print_success "All done! Your YMCA AI Chatbot is deployed and ready to use."
