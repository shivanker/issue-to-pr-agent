/**
 * Configuration settings for the GitHub App and AWS Lambda
 */
export const config = {
  github: {
    appId: process.env.GITHUB_APP_ID || '',
    privateKey: process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^['"]|['"]$/g, '') || '',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    installationId: process.env.GITHUB_INSTALLATION_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    userAgent: 'issue-to-pr-agent',
    // For local testing - repository to use if not specified in the webhook payload
    owner: process.env.GITHUB_OWNER || 'shivanker',
    repo: process.env.GITHUB_REPO || 'issue-to-pr-agent',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    lambdaTimeout: 900, // 15 minutes in seconds - maximum Lambda timeout
  },
  app: {
    // Default branch to create PRs against
    defaultBaseBranch: 'main',
    // Default PR title prefix
    prTitlePrefix: 'Auto PR for issue #',
    // Default commit message
    defaultCommitMsg: 'Auto-generated changes for issue',
    // Temporary directory for git operations
    tempDir: '/tmp/repo-checkout',
  },
  git: {
    workDir: process.env.GIT_WORK_DIR || '/tmp/issue-to-pr-agent',
    authorName: process.env.GIT_AUTHOR_NAME || 'shivanker',
    authorEmail: process.env.GIT_AUTHOR_EMAIL || 'shivanker@sushilabs.co.uk',
  }
};