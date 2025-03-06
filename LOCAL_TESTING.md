# Local Testing Instructions

This document provides instructions for testing the GitHub webhook handler locally, both with sample data and with real GitHub events via ngrok.

## Prerequisites

- Node.js v22 or later
- npm
- [ngrok](https://ngrok.com/) (for testing with real GitHub events)
- A GitHub App with the necessary permissions (for real GitHub events)
- Docker (optional, for container testing)

## Configuration

Before testing, make sure your `.env` file has the correct configuration. You can copy the `.env.example` file as a starting point:

```bash
cp .env.example .env
```

Then edit the `.env` file with your GitHub App details:

```
# GitHub App credentials
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY=your-private-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_CLIENT_SECRET=your-client-secret-if-needed

# Installation ID (usually extracted from webhook payload)
# Only needed for testing outside of webhook context
GITHUB_INSTALLATION_ID=your-installation-id

# GitHub repository for local testing
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name

# Git configuration
GIT_WORK_DIR=/tmp/issue-to-pr-agent
GIT_AUTHOR_NAME=GitHub Issue Bot
GIT_AUTHOR_EMAIL=bot@example.com
```

## Testing Options

This project provides multiple ways to test the application:

### Option 1: Simple Local Testing with Sample Data

Run the test script that uses sample issue and ping events:

```bash
npm run test:local
```

This will:

1. Load sample events from `src/test-data.ts` (both issue opened and ping events)
2. Process them through the Lambda handler
3. Log the responses

### Option 2: Express Webhook Server with ngrok

Test with real GitHub events:

```bash
npm run webhook
```

This starts an Express server on port 3000 (or the port specified in the `PORT` environment variable).

### Option 3: Local Docker Container Testing

Test using the same container that will be deployed to AWS:

```bash
# Build and run the container
./test-container-locally.sh

# In another terminal, send a test ping event
./test-ping.sh
```

## Installation IDs and Authentication

The app automatically extracts installation IDs from webhook payloads, which are used to authenticate with GitHub:

1. For webhook testing, the installation ID is included in the webhook payload
2. For local testing outside of webhooks, you can set `GITHUB_INSTALLATION_ID` in your `.env` file
3. See [AUTH.md](AUTH.md) for more details on GitHub App authentication

## Testing with Real GitHub Events using ngrok

To test with real GitHub events:

### 1. Start the webhook server

```bash
npm run webhook
```

This will start an Express server on port 3000 (or the port specified in the `PORT` environment variable).

### 2. Expose your local server using ngrok

In a separate terminal:

```bash
ngrok http 3000
```

ngrok will provide you with a public URL (e.g., `https://abcd1234.ngrok.io`).

### 3. Configure your GitHub App

- Go to your GitHub App settings
- Set the Webhook URL to your ngrok URL + `/webhook` (e.g., `https://abcd1234.ngrok.io/webhook`)
- Make sure the webhook is active and has the necessary permissions (issues, contents, pull requests)
- Save your changes

### 4. Test by creating a new issue

Create a new issue in a repository where your GitHub App is installed. The webhook server will receive the event and process it.

## Docker Container Testing

For container-based testing:

### 1. Run the container locally

```bash
./test-container-locally.sh --detach
```

This builds and starts the Docker container in the background.

### 2. Send a test ping event

```bash
./test-ping.sh
```

This sends a simulated GitHub ping event to the container.

### 3. Check the logs

```bash
docker logs project-sensei-local
```

## Troubleshooting

### Webhook Signature Verification

If you have a webhook secret configured in GitHub, make sure it matches the `GITHUB_WEBHOOK_SECRET` in your `.env` file. Otherwise, signature verification will fail.

### GitHub API Rate Limits

Be aware that you might hit GitHub API rate limits during testing, especially if you're creating multiple issues in quick succession.

### Installation ID Issues

If you're getting authentication errors when trying to perform repository actions:

1. Make sure your GitHub App is installed on the test repository
2. For direct testing, find your installation ID in the GitHub App settings and add it to your `.env` file
3. For webhook testing, verify the installation ID is in the payload (this is automatic for real GitHub webhooks)

### Local File System

The application creates temporary directories and files on your local system during testing. Check the `GIT_WORK_DIR` in your config if you're experiencing permission issues.

## Additional Resources

- [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
- [GitHub Apps Authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [ngrok Documentation](https://ngrok.com/docs)
