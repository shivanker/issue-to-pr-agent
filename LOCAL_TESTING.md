# Local Testing Instructions

This document provides instructions for testing the GitHub webhook handler locally, both with sample data and with real GitHub events via ngrok.

## Prerequisites

- Node.js v22 or later
- npm
- [ngrok](https://ngrok.com/) (for testing with real GitHub events)
- A GitHub App with the necessary permissions (for real GitHub events)

## Configuration

Before testing, make sure your `src/config.ts` file has the correct configuration:

```typescript
export const config = {
  github: {
    appId: "your-github-app-id",
    privateKey: "your-github-app-private-key",
    installationId: "your-installation-id",
    privateKey: "begin-private-key\n...",
    webhookSecret: "your-webhook-secret", // Optional
    userAgent: "issue-to-pr-agent",
    owner: "your-github-username", // Used for local testing
    repo: "your-repo-name", // Used for local testing
  },
  git: {
    workDir: "/tmp/issue-to-pr-agent", // Temporary directory for cloned repositories
    authorName: "GitHub Issue Bot",
    authorEmail: "bot@example.com",
  },
};
```

## Testing with Sample Data

The sample data simulates a GitHub webhook event for a new issue. You can run this test without any external dependencies:

```bash
npm run test:local
```

This will:

1. Use the sample issue opened event data in `src/test-data.ts`
2. Process it through the Lambda handler
3. Log the response

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

## Troubleshooting

### Webhook Signature Verification

If you have a webhook secret configured in GitHub, make sure it matches the `webhookSecret` in your config file. Otherwise, signature verification will fail.

### GitHub API Rate Limits

Be aware that you might hit GitHub API rate limits during testing, especially if you're creating multiple issues in quick succession.

### Local File System

The application creates temporary directories and files on your local system during testing. Check the `workDir` in your config if you're experiencing permission issues.

## Additional Resources

- [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
- [ngrok Documentation](https://ngrok.com/docs)
