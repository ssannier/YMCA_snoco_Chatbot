#!/bin/bash

# YMCA AI CDK Destroy Script
# This script handles the destruction of the YMCA AI infrastructure

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

print_warning "This will destroy the YMCA AI Stack in account: $AWS_ACCOUNT in region: $AWS_REGION"
print_warning "This action cannot be undone!"

# Confirmation prompt
read -p "Are you sure you want to destroy the stack? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_status "Destruction cancelled"
    exit 0
fi

# Set environment variables
export CDK_DEFAULT_ACCOUNT=$AWS_ACCOUNT
export CDK_DEFAULT_REGION=$AWS_REGION

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Destroy the stack
print_status "Destroying YMCA AI Stack..."
npx cdk destroy YmcaAiStack --force

print_status "Stack destruction completed!"