import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { config } from "./config";
import type {
  RepoInfo,
  IssueInfo,
  PullRequestOptions,
  PrReviewInfo,
  ReviewCommentInfo,
} from "./types";

/**
 * Creates an authenticated Octokit instance using GitHub App credentials
 */
export async function createOctokitApp(
  installationId?: number
): Promise<Octokit> {
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

/**
 * Gets pull request information from a GitHub event
 */
export function getPrInfoFromPayload(payload: any): {
  prNumber: number;
  branch: string;
  base: string;
} {
  return {
    prNumber: payload.pull_request.number,
    branch: payload.pull_request.head.ref,
    base: payload.pull_request.base.ref,
  };
}

/**
 * Gets pull request review comments
 */
export async function getPrReviewComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ReviewCommentInfo[]> {
  // Get all review comments
  const { data: reviewComments } = await octokit.pulls.listReviewComments({
    owner,
    repo,
    pull_number: prNumber,
  });

  return reviewComments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    path: comment.path,
    line: comment.line,
    position: comment.position,
    committish: comment.commit_id,
  }));
}

/**
 * Gets pull request review information
 */
export async function getPrReviewInfo(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PrReviewInfo> {
  // Get PR details
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Get review comments
  const reviews = await getPrReviewComments(octokit, owner, repo, prNumber);

  return {
    prNumber,
    prTitle: pr.title,
    prBody: pr.body,
    reviews,
    branch: pr.head.ref,
    base: pr.base.ref,
  };
}

/**
 * Gets PR information from a review comment payload
 */
export function getPrInfoFromReviewPayload(payload: any): {
  prNumber: number;
} {
  return {
    prNumber: payload.pull_request.number,
  };
}

/**
 * Adds a comment to a pull request
 */
export async function addPrComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}
