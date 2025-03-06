#!/bin/bash
set -e

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

# ECR repository and image names
ECR_REPOSITORY=project-sensei
IMAGE_TAG=latest
FUNCTION_NAME=project-sensei

echo "=== Building Docker image for ARM64 ==="
docker buildx build --platform linux/arm64 --provenance=false -t $ECR_REPOSITORY:$IMAGE_TAG .

echo "=== Logging in to Amazon ECR ==="
aws ecr get-login-password | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Check if repository exists, create if it doesn't
if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY > /dev/null 2>&1; then
  echo "=== Creating ECR repository $ECR_REPOSITORY ==="
  aws ecr create-repository --repository-name $ECR_REPOSITORY
fi

echo "=== Tagging image ==="
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "=== Pushing image to ECR ==="
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "=== Updating Lambda function ==="
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --image-uri $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "=== Deployment completed ==="