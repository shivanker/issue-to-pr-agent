// Configuration for the GitHub app
export const config = {
  // GitHub App configuration
  appId: process.env.GITHUB_APP_ID || '',
  privateKey: process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  
  // AWS configuration
  region: process.env.AWS_REGION || 'us-east-1',
  
  // Git configuration
  gitUserName: 'Issue-to-PR Bot',
  gitUserEmail: 'issue-to-pr-bot@example.com',
  
  // Temporary directory for cloning repositories
  tempDir: '/tmp/repo-checkout',
  
  // PR configuration
  prBranchPrefix: 'issue-to-pr/',
  prTitle: 'Automated changes from Issue #',
  prBody: 'This PR was automatically generated in response to Issue #',
};