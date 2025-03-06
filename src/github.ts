import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { config } from './config';
import type {
  RepoInfo,
  IssueInfo,
  PullRequestOptions
} from './types';

/**
 * Creates an authenticated Octokit instance using GitHub App credentials
 */
export async function createOctokitApp(installationId?: number): Promise<Octokit> {
  const authOptions: any = {
    appId: config.github.appId,
    privateKey: config.github.privateKey,
    clientSecret: config.github.clientSecret,
  };

  // Add installation ID if provided
  if (installationId) {
    authOptions.installationId = installationId;
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: authOptions,
  });
}

/**
 * Extracts the installation ID from a webhook payload
 */
export function getInstallationIdFromPayload(payload: any): number | undefined {
  return payload.installation?.id;
}

/**
 * Gets repository information from a GitHub event
 */
export function getRepoInfoFromPayload(payload: any): RepoInfo {
  return {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    defaultBranch: payload.repository.default_branch,
    cloneUrl: payload.repository.clone_url,
  };
}

/**
 * Gets issue information from a GitHub event
 */
export function getIssueInfoFromPayload(payload: any): IssueInfo {
  return {
    number: payload.issue.number,
    title: payload.issue.title,
    body: payload.issue.body,
    labels: payload.issue.labels?.map((label: any) => label.name) || [],
  };
}

/**
 * Creates a new branch in the repository
 */
export async function createBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string
): Promise<void> {
  // Get the base branch's reference
  const baseRef = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  // Create a new branch based on the base branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseRef.data.object.sha,
  });
}

/**
 * Creates a pull request in the repository
 */
export async function createPullRequest(
  octokit: Octokit,
  options: PullRequestOptions
): Promise<number> {
  const response = await octokit.pulls.create({
    ...options,
    maintainer_can_modify: true,
  });

  return response.data.number;
}

/**
 * Adds a comment to an issue
 */
export async function addIssueComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}