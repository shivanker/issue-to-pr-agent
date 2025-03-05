# Issue-to-PR Agent

A GitHub App that automatically creates Pull Requests in response to new Issues. When a new issue is opened in a repository where this app is installed, it:

1. Clones the repository
2. Creates a new branch
3. Makes changes based on the issue content
4. Commits and pushes the changes
5. Creates a Pull Request
6. Adds a comment to the original issue

This app runs as an AWS Lambda function, triggered by GitHub webhooks.

## Features

- Listens to GitHub webhook events for new issues
- Automatically creates a branch, makes changes, and submits a PR
- Runs serverlessly on AWS Lambda
- Written in TypeScript with modern best practices
- Secure authentication with GitHub Apps

## Prerequisites

- Node.js 16.x or later
- AWS Account
- GitHub Account
- [Serverless Framework](https://www.serverless.com/) installed globally

## Setup

### 1. Create a GitHub App

1. Go to your GitHub account settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in the required information:
   - GitHub App name: `Issue-to-PR Agent` (or your preferred name)
   - Homepage URL: Your website or repository URL
   - Webhook URL: Leave blank for now (we'll update it after deployment)
   - Webhook secret: Generate a secure random string
4. Set permissions:
   - Repository permissions:
     - Contents: Read & write
     - Issues: Read & write
     - Pull requests: Read & write
   - Subscribe to events:
     - Issues
5. Create the app and note down:
   - App ID
   - Client ID
   - Client secret
   - Generate a private key and download it

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

Note: For the private key, replace newlines with `\n`.

### 4. Build the Project

```bash
npm run build
```

### 5. Deploy to AWS Lambda

```bash
npm run deploy
```

After deployment, the Serverless Framework will output the Lambda function URL. Use this URL as the Webhook URL in your GitHub App settings.

## Local Development

To run the app locally for development:

```bash
npm run start
```

This will start a local server using serverless-offline. You can use a tool like [ngrok](https://ngrok.com/) to expose your local server to the internet for testing with GitHub webhooks.

## Customization

You can customize how the app processes issues and creates PRs by modifying the `makeChanges` function in `src/git.ts`. By default, it creates a simple markdown file with the issue details, but you can implement more complex logic based on your requirements.

## Architecture

- `src/index.ts`: Main Lambda handler function
- `src/github.ts`: GitHub API interactions
- `src/git.ts`: Git operations
- `src/config.ts`: Configuration settings
- `src/types.ts`: TypeScript type definitions

## License

ISC