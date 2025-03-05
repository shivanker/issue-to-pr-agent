#!/bin/bash
set -e

# Variables
FUNCTION_NAME="issue-to-pr-agent"
REGION="${AWS_REGION:-us-east-1}"

# Build the project
echo "Building the project..."
npm run clean
npm run build

# Create deployment directory
echo "Creating deployment package..."
mkdir -p ./dist/package

# Copy necessary files for deployment
cp -r ./dist/*.js ./dist/package/
cp package.json ./dist/package/
cp package-lock.json ./dist/package/

# Install production dependencies
echo "Installing production dependencies..."
cd ./dist/package
npm ci --production
cd ../..

# Create zip file
echo "Creating zip file..."
cd ./dist/package
zip -r ../lambda-package.zip .
cd ../..

# Deploy to AWS Lambda
echo "Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://dist/lambda-package.zip \
  --region $REGION

echo "Deployment completed successfully!"