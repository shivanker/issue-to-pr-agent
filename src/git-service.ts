import fs from 'fs';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { config } from './config';
import { RepoInfo, IssueInfo, ChangeImplementer } from './types';

/**
 * Service for Git operations
 */
export class GitService {
  private git: SimpleGit;
  private repoInfo: RepoInfo;
  private issueInfo: IssueInfo;
  private repoDir: string;
  private branchName: string;
  private installationId?: number;
  private octokit: Octokit;

  /**
   * Initializes the Git service
   */
  constructor(repoInfo: RepoInfo, issueInfo: IssueInfo, octokit: Octokit, installationId?: number) {
    this.repoInfo = repoInfo;
    this.issueInfo = issueInfo;
    this.installationId = installationId;
    this.octokit = octokit;

    // Create a unique directory for the repository
    const timestamp = Date.now();
    this.repoDir = path.join(config.app.tempDir, `${repoInfo.owner}-${repoInfo.repo}-${timestamp}`);

    // Create a branch name based on the issue number
    this.branchName = `issue-${issueInfo.number}-${timestamp}`;

    // Initialize git
    this.git = simpleGit();
  }

  /**
   * Clones the repository
   */
  async cloneRepository(): Promise<string> {
    console.log(`Cloning repository ${this.repoInfo.owner}/${this.repoInfo.repo}`);

    // Create a temporary directory for the repository
    if (!fs.existsSync(config.app.tempDir)) {
      fs.mkdirSync(config.app.tempDir, { recursive: true });
    }

    // Get authentication token for Git operations
    const authResult = await this.octokit.auth({
      type: 'installation',
      installationId: this.installationId,
      repositoryIds: [],
    }) as { token: string };

    // Use the token in the clone URL
    const repoUrl = `https://x-access-token:${authResult.token}@github.com/${this.repoInfo.owner}/${this.repoInfo.repo}.git`;

    // Clone the repository
    await this.git.clone(repoUrl, this.repoDir);
    this.git = simpleGit(this.repoDir);

    // Configure Git with author information if provided
    if (config.git.authorName && config.git.authorEmail) {
      await this.git.addConfig('user.name', config.git.authorName);
      await this.git.addConfig('user.email', config.git.authorEmail);
    }

    console.log(`Repository cloned to ${this.repoDir}`);
    return this.repoDir;
  }

  /**
   * Creates a new branch
   */
  async createBranch(): Promise<string> {
    console.log(`Creating branch ${this.branchName}`);

    // Checkout the default branch first
    await this.git.checkout(this.repoInfo.defaultBranch);

    // Create and checkout a new branch
    await this.git.checkoutLocalBranch(this.branchName);

    return this.branchName;
  }

  /**
   * Makes changes to the repository based on the issue information
   */
  async makeChanges(implementer: ChangeImplementer): Promise<{ changedFiles: string[], commandOutput?: { stdout: string, stderr: string } }> {
    console.log(`Making changes for issue #${this.issueInfo.number}`);

    try {
      // Use the provided change implementer to modify files
      const result = await implementer(this.repoDir, this.issueInfo);

      return {
        changedFiles: result.changedFiles,
        commandOutput: result.output
      };
    } catch (error) {
      // Store any command output that was generated before the error
      if (error instanceof Error && 'output' in error) {
        (this as any).commandOutput = (error as any).output;
      }

      // Re-throw the error to be handled by the caller
      throw error;
    }
  }

  /**
   * Commits changes to the repository
   */
  async commitChanges(changedFiles: string[]): Promise<void> {
    console.log(`Committing changes to ${changedFiles.length} files`);

    // Filter out files that no longer exist
    const existingFiles = changedFiles.filter(file =>
        fs.existsSync(path.join(this.repoDir, file))
    );

    const deletedFiles = changedFiles.filter(file =>
        !fs.existsSync(path.join(this.repoDir, file))
    );

    // Add modified and new files
    if (existingFiles.length > 0) {
        await this.git.add(existingFiles);
    }

    // Handle deleted files
    if (deletedFiles.length > 0) {
        await this.git.rm(deletedFiles);
    }

    // Create a commit with a message referencing the issue
    const commitMessage = `${config.app.defaultCommitMsg} #${this.issueInfo.number}`;
    await this.git.commit(commitMessage);
  }

  /**
   * Pushes changes to the remote repository
   */
  async pushChanges(): Promise<void> {
    console.log(`Pushing changes to remote branch ${this.branchName}`);

    // Push the changes to the remote repository
    await this.git.push('origin', this.branchName, ['--set-upstream']);
  }

  /**
   * Cleans up temporary files
   */
  cleanup(): void {
    console.log(`Cleaning up temporary directory ${this.repoDir}`);

    // Recursively remove the cloned repository directory
    try {
      if (fs.existsSync(this.repoDir)) {
        fs.rmSync(this.repoDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Gets the branch name
   */
  getBranchName(): string {
    return this.branchName;
  }
}