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

/**
 * Actual GitHub ping webhook event for testing
 */
export const githubPingEvent: LambdaEvent = {
  headers: {
    'request-method': 'POST',
    'accept': '*/*',
    'content-type': 'application/json',
    'user-agent': 'GitHub-Hookshot/e43c576',
    'x-github-delivery': '85240cf0-fabd-11ef-921c-bd13567f8cec',
    'x-github-event': 'ping',
    'x-github-hook-id': '533790625',
    'x-github-hook-installation-target-id': '1168904',
    'x-github-hook-installation-target-type': 'integration'
  },
  body: JSON.stringify({
    zen: "Favor focus over features.",
    hook_id: 533790625,
    hook: {
      type: "App",
      id: 533790625,
      name: "web",
      active: true,
      events: [
        "issues",
        "issue_comment",
        "pull_request_review",
        "pull_request_review_comment",
        "pull_request_review_thread"
      ],
      config: {
        content_type: "json",
        insecure_ssl: "0",
        url: "https://vvwleqwbpw4npxojqkdlunbaxe0hcckf.lambda-url.us-east-1.on.aws/"
      },
      updated_at: "2025-03-06T19:02:16Z",
      created_at: "2025-03-06T19:02:16Z",
      app_id: 1168904,
      deliveries_url: "https://api.github.com/app/hook/deliveries"
    }
  }),
  isBase64Encoded: false
};