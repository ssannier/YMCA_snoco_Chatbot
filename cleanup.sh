#!/bin/bash
# YMCA Chatbot - Complete Cleanup Script
# Removes all resources created by deploy.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="YmcaAiStack"

# Global variables
AWS_REGION=""
AWS_ACCOUNT_ID=""
DOCUMENTS_BUCKET=""
VECTORS_BUCKET=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
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

# --- Phase 0: Warning and Confirmation ---
print_header "YMCA Chatbot Cleanup"

echo -e "${RED}⚠️  WARNING: This will delete all deployed resources!${NC}"
echo ""
echo "This script will remove:"
echo "  • CloudFormation Stack (Lambda, API Gateway, Step Functions, etc.)"
echo "  • Amplify App (if deployed)"
echo "  • Cognito User Pool and Identity Pool"
echo "  • Bedrock Knowledge Base and Data Sources"
echo "  • Secrets Manager (GitHub token)"
echo ""
echo "You will be asked about (RETAIN policy):"
echo "  • S3 Buckets (documents and vectors)"
echo "  • DynamoDB Tables (conversations and analytics)"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_error "Cleanup cancelled by user"
    exit 0
fi

echo ""
read -p "Type 'DELETE' to confirm: " confirm_delete

if [ "$confirm_delete" != "DELETE" ]; then
    print_error "Cleanup cancelled - confirmation text did not match"
    exit 0
fi

print_success "Cleanup confirmed. Starting removal process..."

# --- Phase 1: Environment Detection ---
print_header "Phase 1: Detecting Environment"

# Change to script directory
cd "$(dirname "$0")"

# Load from .env if exists
ENV_FILE="backend/.env"
if [ -f "$ENV_FILE" ]; then
    print_status "Loading configuration from backend/.env..."
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs 2>/dev/null || true)
    AWS_REGION=${AWS_REGION:-$(aws configure get region 2>/dev/null || echo "us-west-2")}
else
    print_status "No .env file found. Using AWS CLI configuration..."
    AWS_REGION=$(aws configure get region 2>/dev/null || echo "")
fi

if [ -z "$AWS_REGION" ]; then
    read -p "Enter AWS region (default: us-west-2): " input_region
    AWS_REGION=${input_region:-us-west-2}
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

if [ -z "$AWS_ACCOUNT_ID" ]; then
    print_error "Unable to get AWS Account ID. Please configure AWS CLI"
    exit 1
fi

print_success "AWS Region: $AWS_REGION"
print_success "AWS Account ID: $AWS_ACCOUNT_ID"

# Detect bucket names (matching CDK stack)
# Note: deploy.sh only displays DOCUMENTS_BUCKET, but CDK also creates a vectors bucket
DOCUMENTS_BUCKET="ymca-documents-${AWS_ACCOUNT_ID}-${AWS_REGION}"
VECTORS_BUCKET="ymca-vectors-${AWS_ACCOUNT_ID}-${AWS_REGION}"  # Created by cdk-s3-vectors construct

# --- Phase 2: Check Stack Existence ---
print_header "Phase 2: Checking Stack Status"

STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].StackStatus' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
    print_warning "CloudFormation stack '$STACK_NAME' not found"
    print_status "Will attempt to clean up individual resources..."
else
    print_success "Found stack: $STACK_NAME (Status: $STACK_STATUS)"
fi

# --- Phase 3: S3 Buckets Cleanup ---
print_header "Phase 3: S3 Buckets Cleanup"

echo "S3 buckets are created by the CDK stack with RETAIN policy."
echo "The documents bucket stores uploaded files, and the vectors bucket stores embeddings."
echo ""
echo "Buckets to clean up:"
echo "  • Documents: $DOCUMENTS_BUCKET (input/ and output/ folders)"
echo "  • Vectors:   $VECTORS_BUCKET (vector embeddings for Bedrock Knowledge Base)"
echo ""
print_warning "Note: The vectors bucket is created by CDK but not shown in deploy.sh outputs"
echo ""
read -p "Do you want to delete S3 buckets? (yes/no): " delete_s3

if [ "$delete_s3" = "yes" ]; then
    # Delete documents bucket
    if aws s3 ls "s3://${DOCUMENTS_BUCKET}" --region $AWS_REGION 2>/dev/null; then
        print_status "Emptying documents bucket: $DOCUMENTS_BUCKET"
        aws s3 rm "s3://${DOCUMENTS_BUCKET}" --recursive --region $AWS_REGION || true

        print_status "Deleting documents bucket: $DOCUMENTS_BUCKET"
        aws s3 rb "s3://${DOCUMENTS_BUCKET}" --region $AWS_REGION || true

        print_success "Documents bucket deleted"
    else
        print_warning "Documents bucket not found: $DOCUMENTS_BUCKET"
    fi

    # Delete vectors bucket
    if aws s3 ls "s3://${VECTORS_BUCKET}" --region $AWS_REGION 2>/dev/null; then
        print_status "Emptying vectors bucket: $VECTORS_BUCKET"
        aws s3 rm "s3://${VECTORS_BUCKET}" --recursive --region $AWS_REGION || true

        print_status "Deleting vectors bucket: $VECTORS_BUCKET"
        aws s3 rb "s3://${VECTORS_BUCKET}" --region $AWS_REGION || true

        print_success "Vectors bucket deleted"
    else
        print_warning "Vectors bucket not found: $VECTORS_BUCKET"
    fi
else
    print_warning "Skipping S3 bucket deletion - buckets will be retained"
    print_status "To delete manually later:"
    echo "  aws s3 rm s3://${DOCUMENTS_BUCKET} --recursive --region $AWS_REGION"
    echo "  aws s3 rb s3://${DOCUMENTS_BUCKET} --region $AWS_REGION"
    echo "  aws s3 rm s3://${VECTORS_BUCKET} --recursive --region $AWS_REGION"
    echo "  aws s3 rb s3://${VECTORS_BUCKET} --region $AWS_REGION"
fi

# --- Phase 4: DynamoDB Tables Cleanup ---
print_header "Phase 4: DynamoDB Tables Cleanup"

echo "DynamoDB tables contain conversation history and analytics data."
echo "Tables:"
echo "  • Conversations: ymca-conversations"
echo "  • Analytics:     ymca-analytics"
echo ""
read -p "Do you want to delete DynamoDB tables? (yes/no): " delete_dynamodb

if [ "$delete_dynamodb" = "yes" ]; then
    # Delete conversations table
    CONVERSATION_TABLE="ymca-conversations"
    if aws dynamodb describe-table --table-name $CONVERSATION_TABLE --region $AWS_REGION 2>/dev/null; then
        print_status "Deleting table: $CONVERSATION_TABLE"
        aws dynamodb delete-table --table-name $CONVERSATION_TABLE --region $AWS_REGION || true
        print_success "Conversations table deletion initiated"
    else
        print_warning "Conversations table not found: $CONVERSATION_TABLE"
    fi

    # Delete analytics table
    ANALYTICS_TABLE="ymca-analytics"
    if aws dynamodb describe-table --table-name $ANALYTICS_TABLE --region $AWS_REGION 2>/dev/null; then
        print_status "Deleting table: $ANALYTICS_TABLE"
        aws dynamodb delete-table --table-name $ANALYTICS_TABLE --region $AWS_REGION || true
        print_success "Analytics table deletion initiated"
    else
        print_warning "Analytics table not found: $ANALYTICS_TABLE"
    fi
else
    print_warning "Skipping DynamoDB table deletion - tables will be retained"
    print_status "To delete manually later:"
    echo "  aws dynamodb delete-table --table-name ymca-conversations --region $AWS_REGION"
    echo "  aws dynamodb delete-table --table-name ymca-analytics --region $AWS_REGION"
fi

# --- Phase 5: CloudFormation Stack Deletion ---
print_header "Phase 5: CloudFormation Stack Deletion"

if [ "$STACK_STATUS" != "NOT_FOUND" ]; then
    print_status "Deleting CloudFormation stack: $STACK_NAME"
    print_status "This will delete:"
    echo "  • Lambda functions (agent-proxy, batch-processor, textract-*, etc.)"
    echo "  • API Gateway"
    echo "  • Step Functions (document processing workflow)"
    echo "  • Cognito User Pool and Identity Pool"
    echo "  • Amplify App (if deployed)"
    echo "  • Bedrock Knowledge Base and Data Sources"
    echo "  • IAM Roles and Policies"
    echo "  • Secrets Manager (GitHub token)"
    echo ""

    # Use CDK destroy if available, otherwise use CloudFormation
    if command -v cdk &> /dev/null && [ -d "backend" ]; then
        print_status "Using CDK to destroy stack..."
        cd backend
        cdk destroy --force || {
            print_warning "CDK destroy failed, falling back to CloudFormation delete"
            cd ..
            aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION
        }
        cd ..
    else
        print_status "Using CloudFormation to delete stack..."
        aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION
    fi

    print_status "Waiting for stack deletion to complete (this may take 5-10 minutes)..."
    print_status "Stack deletion in progress. You can monitor at:"
    echo "  https://console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}"
    echo ""

    # Wait for deletion with timeout
    aws cloudformation wait stack-delete-complete \
        --stack-name $STACK_NAME \
        --region $AWS_REGION 2>/dev/null && {
        print_success "CloudFormation stack deleted successfully"
    } || {
        print_warning "Stack deletion may still be in progress"
        print_status "Check AWS Console for current status"
    }
else
    print_warning "No CloudFormation stack to delete"
fi

# --- Phase 6: CDK Bootstrap (Optional) ---
print_header "Phase 6: CDK Bootstrap Stack (Optional)"

echo "The CDK bootstrap stack (CDKToolkit) contains assets for CDK deployments."
echo "This stack is shared across ALL CDK projects in your account/region."
echo ""
print_warning "Only delete this if you are NOT using CDK for other projects!"
echo ""
read -p "Do you want to delete the CDK bootstrap stack? (yes/no): " delete_cdk_bootstrap

if [ "$delete_cdk_bootstrap" = "yes" ]; then
    print_warning "This will affect ALL CDK projects in this account/region!"
    read -p "Are you absolutely sure? Type 'DELETE-CDK' to confirm: " confirm_cdk

    if [ "$confirm_cdk" = "DELETE-CDK" ]; then
        CDK_STACK="CDKToolkit"
        if aws cloudformation describe-stacks --stack-name $CDK_STACK --region $AWS_REGION 2>/dev/null; then
            print_status "Deleting CDK bootstrap stack..."

            # Empty the CDK staging bucket first
            CDK_BUCKET=$(aws cloudformation describe-stack-resources \
                --stack-name $CDK_STACK \
                --region $AWS_REGION \
                --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" \
                --output text 2>/dev/null || echo "")

            if [ -n "$CDK_BUCKET" ] && [ "$CDK_BUCKET" != "None" ]; then
                print_status "Emptying CDK staging bucket: $CDK_BUCKET"
                aws s3 rm "s3://${CDK_BUCKET}" --recursive --region $AWS_REGION || true
            fi

            aws cloudformation delete-stack --stack-name $CDK_STACK --region $AWS_REGION
            print_success "CDK bootstrap stack deletion initiated"
        else
            print_warning "CDK bootstrap stack not found"
        fi
    else
        print_warning "Skipping CDK bootstrap stack deletion"
    fi
else
    print_warning "Skipping CDK bootstrap stack deletion"
fi

# --- Phase 7: Local Cleanup ---
print_header "Phase 7: Local File Cleanup (Optional)"

echo "Local files include build artifacts and environment configuration."
echo ""
read -p "Do you want to clean local build files? (yes/no): " clean_local

if [ "$clean_local" = "yes" ]; then
    print_status "Cleaning backend build artifacts..."
    rm -rf backend/cdk.out 2>/dev/null || true
    rm -f backend/outputs.json 2>/dev/null || true

    print_status "Cleaning frontend build artifacts..."
    rm -rf frontend/.next 2>/dev/null || true
    rm -rf frontend/out 2>/dev/null || true

    print_success "Build artifacts cleaned"

    echo ""
    read -p "Do you want to delete node_modules? (yes/no): " delete_node_modules

    if [ "$delete_node_modules" = "yes" ]; then
        print_status "Removing node_modules..."
        rm -rf backend/node_modules 2>/dev/null || true
        rm -rf backend/lambda/*/node_modules 2>/dev/null || true
        rm -rf frontend/node_modules 2>/dev/null || true
        print_success "node_modules removed"
    else
        print_warning "node_modules retained"
    fi

    echo ""
    read -p "Do you want to delete environment files (.env)? (yes/no): " delete_env

    if [ "$delete_env" = "yes" ]; then
        rm -f backend/.env 2>/dev/null || true
        rm -f frontend/.env.local 2>/dev/null || true
        print_success "Environment files deleted"
    else
        print_warning "Environment files retained"
    fi
else
    print_warning "Skipping local file cleanup"
fi

# --- Final Summary ---
print_header "CLEANUP SUMMARY"

cat << SUMMARY

${GREEN}✅ CLEANUP COMPLETED!${NC}

${PURPLE}═══════════════════════════════════════════════════════════════${NC}
${PURPLE}Removed Resources${NC}
${PURPLE}═══════════════════════════════════════════════════════════════${NC}

${BLUE}CloudFormation Stack (YmcaAiStack):${NC}
$(if [ "$STACK_STATUS" != "NOT_FOUND" ]; then
    echo "  ✅ Stack deleted (or deletion in progress)"
    echo "  ✅ Lambda functions removed"
    echo "  ✅ API Gateway removed"
    echo "  ✅ Step Functions removed"
    echo "  ✅ Cognito User Pool removed"
    echo "  ✅ Amplify App removed"
    echo "  ✅ Bedrock Knowledge Base removed"
    echo "  ✅ Secrets Manager removed"
else
    echo "  ⚠️  Stack not found"
fi)

${BLUE}Storage (RETAIN policy):${NC}
$(if [ "$delete_s3" = "yes" ]; then
    echo "  ✅ S3 buckets deleted"
    echo "     • $DOCUMENTS_BUCKET"
    echo "     • $VECTORS_BUCKET"
else
    echo "  ⚠️  S3 buckets retained (manual deletion required)"
    echo "     • $DOCUMENTS_BUCKET"
    echo "     • $VECTORS_BUCKET"
fi)

$(if [ "$delete_dynamodb" = "yes" ]; then
    echo "  ✅ DynamoDB tables deleted"
    echo "     • ymca-conversations"
    echo "     • ymca-analytics"
else
    echo "  ⚠️  DynamoDB tables retained (manual deletion required)"
    echo "     • ymca-conversations"
    echo "     • ymca-analytics"
fi)

${BLUE}Local Files:${NC}
$(if [ "$clean_local" = "yes" ]; then
    echo "  ✅ Build artifacts cleaned"
    if [ "$delete_node_modules" = "yes" ]; then
        echo "  ✅ node_modules removed"
    else
        echo "  ⚠️  node_modules retained"
    fi
    if [ "$delete_env" = "yes" ]; then
        echo "  ✅ Environment files deleted"
    else
        echo "  ⚠️  Environment files retained"
    fi
else
    echo "  ⚠️  Build artifacts retained"
fi)

${PURPLE}═══════════════════════════════════════════════════════════════${NC}
${PURPLE}Next Steps${NC}
${PURPLE}═══════════════════════════════════════════════════════════════${NC}

${GREEN}Verify cleanup:${NC}
  • CloudFormation stacks:
    aws cloudformation list-stacks --region $AWS_REGION

  • S3 buckets:
    aws s3 ls --region $AWS_REGION | grep ymca

  • DynamoDB tables:
    aws dynamodb list-tables --region $AWS_REGION

  • Lambda functions:
    aws lambda list-functions --region $AWS_REGION | grep ymca

${GREEN}To redeploy:${NC}
  1. Ensure backend/.env is configured (or will be prompted)
  2. Run: ./deploy.sh

${GREEN}Cost monitoring:${NC}
  • Verify all resources are deleted in AWS Console
  • Check billing dashboard: https://console.aws.amazon.com/billing/
  • CloudWatch Logs may incur small storage costs (auto-expire)

${PURPLE}═══════════════════════════════════════════════════════════════${NC}

${GREEN}Cleanup process complete! 🎉${NC}

SUMMARY

print_success "All requested cleanup operations completed successfully"
