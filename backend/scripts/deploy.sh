#!/bin/bash

# YMCA AI CDK Deployment Script
# This script handles the deployment of the YMCA AI infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid"
    print_error "Please run 'aws configure' to set up your credentials"
    exit 1
fi

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

print_status "Deploying YMCA AI Stack to account: $AWS_ACCOUNT in region: $AWS_REGION"

# Set environment variables
export CDK_DEFAULT_ACCOUNT=$AWS_ACCOUNT
export CDK_DEFAULT_REGION=$AWS_REGION
export NODE_ENV=${NODE_ENV:-development}

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build TypeScript
print_status "Building TypeScript..."
npm run build

# Bootstrap CDK if needed
print_status "Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION > /dev/null 2>&1; then
    print_warning "CDK not bootstrapped in this region. Bootstrapping now..."
    npx cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
else
    print_status "CDK already bootstrapped"
fi

# Synthesize the stack
print_status "Synthesizing CDK stack..."
npx cdk synth

# Deploy the stack
print_status "Deploying YMCA AI Stack..."
npx cdk deploy YmcaAiStack --require-approval never

print_status "Deployment completed successfully!"
print_status "You can view the stack outputs by running: npx cdk deploy YmcaAiStack --outputs-file outputs.json"