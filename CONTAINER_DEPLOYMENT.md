# Lambda Container Deployment

This document explains how to deploy the GitHub webhook handler as a Lambda container.

## Container Deployment Overview

The application is deployed as an ARM64 container image to AWS Lambda, using Amazon ECR (Elastic Container Registry) to store the Docker image.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured locally
- Docker installed locally (with buildx support for ARM64 builds)
- GitHub repository with GitHub Actions configured
- GitHub App credentials (App ID, Private Key, etc.)

## ARM64 Architecture Note

This project is configured for ARM64 architecture Lambda functions (AWS Graviton2 processors), which offer better price-performance than x86 options. The Dockerfile and deployment scripts are specifically optimized for ARM64.

## Environment Variables

The Lambda function requires the following environment variables:

```
# GitHub App credentials
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY=your-private-key-with-newlines-escaped
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_CLIENT_SECRET=your-client-secret-if-needed

# GitHub repository for local testing (optional)
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name

# Git configuration
GIT_AUTHOR_NAME=GitHub Issue Bot
GIT_AUTHOR_EMAIL=bot@example.com
```

**Note about Installation IDs**: The app automatically extracts installation IDs from webhook payloads, so you don't need to provide them as environment variables. See [AUTH.md](AUTH.md) for details.

## Manual Deployment Steps

If you want to deploy manually without GitHub Actions:

### Option 1: Use the build-and-deploy.sh script

The repository includes a script to handle the build and deployment process:

```bash
./build-and-deploy.sh
```

This script will:

1. Build the Docker image for ARM64
2. Login to ECR
3. Create the ECR repository if needed
4. Tag and push the image
5. Update the Lambda function

### Option 2: Manual steps

#### 1. Build the Docker image locally

Build for ARM64 using buildx:

```bash
docker buildx build --platform linux/arm64 --provenance=false -t project-sensei .
```

#### 2. Tag and push to Amazon ECR

First, create the repository if it doesn't exist:

```bash
aws ecr create-repository --repository-name project-sensei
```

Login to ECR:

```bash
aws ecr get-login-password | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com
```

Tag the image:

```bash
docker tag project-sensei:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/project-sensei:latest
```

Push the image:

```bash
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/project-sensei:latest
```

#### 3. Update the Lambda function

If the Lambda function doesn't exist yet, create it specifying the ARM64 architecture:

```bash
aws lambda create-function \
  --function-name project-sensei \
  --package-type Image \
  --code ImageUri=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/project-sensei:latest \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --architectures arm64 \
  --environment "Variables={GITHUB_APP_ID=your-app-id,GITHUB_PRIVATE_KEY=your-private-key,GITHUB_WEBHOOK_SECRET=your-webhook-secret,GIT_AUTHOR_NAME=GitHub Issue Bot,GIT_AUTHOR_EMAIL=bot@example.com}"
```

If it already exists, update it:

```bash
aws lambda update-function-code \
  --function-name project-sensei \
  --image-uri $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/project-sensei:latest
```

## Automated Deployment with GitHub Actions

The repository includes a GitHub Actions workflow file at `.github/workflows/update-lambda-container.yml` that automates the deployment process whenever code is pushed to the main branch.

### Setting up GitHub Secrets

For the GitHub Actions workflow to deploy to AWS, you need to set the following secrets in your GitHub repository:

1. `AWS_ACCESS_KEY_ID`: Your AWS access key ID
2. `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key
3. `AWS_REGION`: The AWS region where your Lambda function is deployed

Also set these variables in the Lambda function's environment:

1. `GITHUB_APP_ID`: Your GitHub App ID
2. `GITHUB_PRIVATE_KEY`: Your GitHub App private key (with newlines escaped)
3. `GITHUB_WEBHOOK_SECRET`: Your webhook secret
4. Other environment variables as needed

### Creating Lambda Resources in AWS

Before the GitHub Actions workflow can deploy your container, ensure you have:

1. Created an ECR repository named `project-sensei`
2. Created a Lambda function named `project-sensei` with the container package type and ARM64 architecture
3. Set up appropriate IAM roles and permissions
4. Configured the environment variables in the Lambda console

### Initial Lambda Function Creation

For the first deployment, you'll need to create the Lambda function with the right permissions and architecture:

```bash
aws lambda create-function \
  --function-name project-sensei \
  --package-type Image \
  --code ImageUri=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/project-sensei:latest \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --timeout 900 \
  --memory-size 512 \
  --architectures arm64 \
  --environment "Variables={GITHUB_APP_ID=your-app-id,GITHUB_PRIVATE_KEY=your-private-key,GITHUB_WEBHOOK_SECRET=your-webhook-secret,GIT_AUTHOR_NAME=GitHub Issue Bot,GIT_AUTHOR_EMAIL=bot@example.com}"
```

Replace `lambda-execution-role` with the appropriate IAM role that has permissions for:

- CloudWatch Logs access
- GitHub API access (if using AWS roles for GitHub authentication)
- Any other resources needed by your function

## Testing the Container Locally

You can test the container locally before deploying:

```bash
# Build and run the container with environment variables
./test-container-locally.sh

# In another terminal, send a test ping event
./test-ping.sh
```

See [LOCAL_TESTING.md](LOCAL_TESTING.md) for more detailed testing instructions.

## Troubleshooting

### Image Manifest Issues

If you encounter errors like `The image manifest, config or layer media type for the source image is not supported`, ensure:

1. You're correctly building for ARM64 architecture
2. You're using the ARM64 version of the AWS Lambda base image (`public.ecr.aws/lambda/nodejs:20-arm64`)
3. Docker buildx is properly set up for cross-platform builds

### GitHub Authentication Issues

If you see authentication errors in the logs:

1. Check that your GitHub App credentials are correctly set in the Lambda environment variables
2. Verify that the app is properly installed on the repositories you're accessing
3. The installation ID should be automatically extracted from webhook payloads
4. See [AUTH.md](AUTH.md) for more details about authentication

### Cross-Platform Building Issues

If you have trouble building for ARM64 locally on an x86 machine:

1. Ensure you have QEMU installed: `docker run --rm --privileged multiarch/qemu-user-static --reset -p yes`
2. Create a new builder instance: `docker buildx create --name mybuilder --driver docker-container --use`
3. Bootstrap the builder: `docker buildx inspect --bootstrap`

## AWS API Gateway Integration

If you are exposing this Lambda function via API Gateway to receive GitHub webhooks:

1. Create an API Gateway HTTP API or REST API
2. Add a route that triggers your Lambda function
3. Update your GitHub App's webhook URL to the API Gateway endpoint

## Container Optimization Notes

- The Dockerfile uses a simple structure for ease of understanding and maintenance
- We're using the ARM64 version of the Lambda base image for optimal performance on Graviton2
- Node.js files are copied into the container at the correct location for Lambda to find them
