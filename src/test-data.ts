import { LambdaEvent } from './types';

/**
 * Sample GitHub issue opened webhook event for local testing
 */
export const sampleIssueOpenedEvent: LambdaEvent = {
  headers: {
    'x-github-event': 'issues',
    'x-hub-signature-256': 'sha256=mock_signature',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    action: 'opened',
    issue: {
      number: 123,
      title: 'Test Issue: Add new feature',
      body: 'This is a test issue body.\n\nPlease implement a new feature that does the following:\n\n- Step 1: Create a new file\n- Step 2: Add sample content\n\nThank you!',
      labels: [
        { name: 'enhancement' },
        { name: 'test' }
      ],
      user: {
        login: 'test-user'
      },
      html_url: 'https://github.com/test-owner/test-repo/issues/123'
    },
    repository: {
      name: 'test-repo',
      owner: {
        login: 'test-owner'
      },
      default_branch: 'main',
      clone_url: 'https://github.com/test-owner/test-repo.git',
      html_url: 'https://github.com/test-owner/test-repo'
    },
    sender: {
      login: 'test-user'
    }
  }),
  isBase64Encoded: false
};