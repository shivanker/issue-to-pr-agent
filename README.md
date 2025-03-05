# Issue-to-PR Agent

A GitHub App that automatically creates Pull Requests in response to new issues opened in authorized repositories. The app runs as an AWS Lambda function and uses webhooks to listen for issue events.

## Features

- Automatically triggers when new issues are opened
- Clones the repository where the issue was opened
- Creates a new branch for changes
- Makes customizable changes to the repository based on the issue content
- Commits and pushes the changes
- Creates a Pull Request referencing the original issue
- Adds a comment to the issue with a link to the new PR

## Architecture

- **AWS Lambda**: Serverless function that processes GitHub webhooks
- **GitHub Webhooks**: Listens for issue events
- **GitHub API**: Used to create branches, pull requests, and comments
- **TypeScript**: Type-safe code for better maintainability
- **Simple Git**: Library for Git operations

## Prerequisites

- Node.js 20.x or later
- AWS Account with permissions to create Lambda functions
- GitHub account with permissions to create GitHub Apps

## Setup

### 1. Create a GitHub App

1. Go to your GitHub account settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in the required information:
   - App name: `issue-to-pr-agent` (or your preferred name)
   - Description: GitHub App that creates pull requests in response to new issues
   - Webhook URL: This will be your Lambda function URL (you can update this later)
   - Webhook secret: Generate a secure random string
   - Permissions:
     - Issues: Read & write
     - Pull requests: Read & write
     - Contents: Read & write
   - Subscribe to events: Issues
4. Create the app
5. Generate a private key for your app
6. Install the app on repositories where you want to use it

### 2. Configure AWS Lambda

1. Create a new Lambda function in the AWS Management Console
2. Runtime: Node.js 20.x
3. Set the following environment variables:
   - `GITHUB_APP_ID`: Your GitHub App ID
   - `GITHUB_PRIVATE_KEY`: Your GitHub App private key (replace newlines with `\n`)
   - `GITHUB_WEBHOOK_SECRET`: Your webhook secret
   - `GITHUB_INSTALLATION_ID`: The installation ID for your GitHub App

### 3. Build and Deploy

```bash
# Clone this repository
git clone https://github.com/yourusername/issue-to-pr-agent.git
cd issue-to-pr-agent

# Install dependencies
npm install

# Build the project
npm run build

# Package for Lambda deployment
npm run package

# Deploy to AWS Lambda (alternatively, upload manually via AWS Console)
npm run deploy
```

### 4. Configure Webhook URL

1. Go back to your GitHub App settings
2. Update the Webhook URL with your Lambda function URL
3. Save changes

## Customizing the Change Implementation

The default implementation creates a markdown file with issue information. To customize the changes made in response to an issue, modify the `defaultChangeImplementer` function in `src/services/change-implementer.ts`:

```typescript
export async function defaultChangeImplementer(
  repoPath: string,
  issueInfo: IssueInfo
): Promise<string[]> {
  // Your custom implementation here
  // ...

  return changedFiles; // Return array of modified file paths
}
```

## Development

```bash
# Install dependencies
npm install

# Watch for changes during development
npm run dev

# Lint the code
npm run lint

# Build the project
npm run build
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
