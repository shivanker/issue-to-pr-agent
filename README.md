# Issue-to-PR Agent

A GitHub App that creates Pull Requests in response to new issues opened in authorized repositories.

## Overview

This app automatically creates a pull request when a new issue is opened in repositories where it's installed. It works by:

1. Receiving GitHub webhook events when new issues are opened
2. Creating a new branch, making changes based on the issue
3. Submitting a pull request that references the original issue

## Prerequisites

- Node.js 22+
- AWS account (for Lambda deployment)
- GitHub account (for GitHub App creation)
- Docker (optional, for container deployment)

## Setup

### GitHub App Setup

1. Go to GitHub Settings → Developer settings → GitHub Apps → New GitHub App
2. Configure:
   - App name and description
   - Webhook URL (your Lambda URL, can update later)
   - Permissions: Issues (R/W), Pull requests (R/W), Contents (R/W)
   - Subscribe to events: Issues
3. Generate and download a private key
4. Install the app on your repositories

### Environment Configuration

Create `.env` file with:

```
# GitHub App credentials (required)
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY=your-private-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Git configuration (required)
GIT_AUTHOR_NAME=GitHub Issue Bot
GIT_AUTHOR_EMAIL=bot@example.com

# Local testing (optional)
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
```

Note: Installation IDs are automatically extracted from webhook payloads.

## Testing

### Run Local Tests

```bash
# Test with sample webhook events
npm run test:local

# Start webhook server for ngrok testing
npm run webhook

# Test with Docker container
./test.sh container
```

### Testing with Real GitHub Events

1. Run `npm run webhook` to start local server
2. Use ngrok: `ngrok http 3000`
3. Set the ngrok URL as your GitHub App webhook URL
4. Create an issue in your test repository

## Deployment

```bash
./build-and-deploy.sh
```

This builds and pushes a container to ECR, then updates your Lambda function.

## AWS Lambda Configuration

1. Create Lambda function

   - Runtime: Node.js 20.x (or use container image)
   - Architecture: ARM64 (Graviton2) recommended
   - Memory: 256-512 MB
   - Timeout: 60+ seconds

2. Environment variables:

   - `GITHUB_APP_ID`
   - `GITHUB_PRIVATE_KEY` (with newlines escaped)
   - `GITHUB_WEBHOOK_SECRET`
   - `GIT_AUTHOR_NAME`
   - `GIT_AUTHOR_EMAIL`

3. Expose via API Gateway or Function URL

## Customization

Edit `src/change-implementer.ts` to customize what changes are made in response to issues:

```typescript
export async function defaultChangeImplementer(
  repoPath: string,
  issueInfo: IssueInfo
): Promise<string[]> {
  // Your custom implementation here
  return ["paths/of/changed/files"];
}
```

## Architecture Notes

- Written in TypeScript
- Uses GitHub App authentication
- Automatic installation ID extraction from webhooks
- Works with both zip and container Lambda deployments

## Troubleshooting

- **Auth issues**: Verify app credentials and installation
- **Webhook signature failures**: Check webhook secret
- **Container issues**: Ensure ARM64 compatibility
- **File system errors**: Check Lambda permissions and `/tmp` directory

## Development

```bash
npm install       # Install dependencies
npm run dev       # Watch mode during development
npm run lint      # Lint code
npm run build     # Build for production
```

## License

ISC
