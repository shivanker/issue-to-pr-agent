import { Octokit } from '@octokit/rest';
import { WebhookPayloadIssues } from '@octokit/webhooks-types';

// Repository information
export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
}

// Issue information
export interface IssueInfo {
  number: number;
  title: string;
  body: string;
}

// PR creation parameters
export interface PullRequestParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

// Git operations context
export interface GitContext {
  octokit: Octokit;
  repoInfo: RepoInfo;
  issueInfo: IssueInfo;
  workingDir: string;
  branchName: string;
}

// GitHub webhook payload with installation ID
export interface WebhookPayloadWithInstallation extends WebhookPayloadIssues {
  installation?: {
    id: number;
  };
}