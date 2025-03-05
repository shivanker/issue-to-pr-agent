import type { WebhookEvent } from '@octokit/webhooks-types';

/**
 * Interface for the Lambda function event
 */
export interface LambdaEvent {
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/**
 * Interface for the Lambda function response
 */
export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/**
 * Interface for repository information
 */
export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  cloneUrl: string;
}

/**
 * Interface for issue information
 */
export interface IssueInfo {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
}

/**
 * Interface for pull request options
 */
export interface PullRequestOptions {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
}

/**
 * Interface for GitHub event types we handle
 */
export type GitHubEvent = WebhookEvent;

/**
 * Interface for GitHub issue event
 */
export type IssuesEvent = WebhookEvent & { action: 'opened' };

/**
 * Interface for a function that implements repository changes
 */
export type ChangeImplementer = (repoPath: string, issueInfo: IssueInfo) => Promise<string[]>;