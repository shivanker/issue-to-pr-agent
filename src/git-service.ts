import * as fs from 'fs';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { config } from './config';
import { RepoInfo, IssueInfo, ChangeImplementer } from './types';

/**
 * Service for handling Git operations
 */
export class GitService {
  private git: SimpleGit;
  private repoInfo: RepoInfo;
  private issueInfo: IssueInfo;
  private repoDir: string;
  private branchName: string;

  /**
   * Constructs a new GitService instance
   */
  constructor(repoInfo: RepoInfo, issueInfo: IssueInfo) {
    this.repoInfo = repoInfo;
    this.issueInfo = issueInfo;
    this.repoDir = path.join(config.app.tempDir, `${repoInfo.owner}-${repoInfo.repo}-${Date.now()}`);
    this.branchName = `issue-${issueInfo.number}-${Date.now()}`;
    this.git = simpleGit();
  }

  /**
   * Clones the repository
   */
  async cloneRepository(): Promise<string> {
    console.log(`Cloning repository ${this.repoInfo.cloneUrl} to ${this.repoDir}`);

    // Ensure the directory exists
    fs.mkdirSync(this.repoDir, { recursive: true });

    // Clone the repository
    await this.git.clone(this.repoInfo.cloneUrl, this.repoDir);

    // Set up the git instance to work in the cloned directory
    this.git = simpleGit(this.repoDir);

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
  async makeChanges(implementer: ChangeImplementer): Promise<string[]> {
    console.log(`Making changes for issue #${this.issueInfo.number}`);

    // Use the provided change implementer to modify files
    const changedFiles = await implementer(this.repoDir, this.issueInfo);

    return changedFiles;
  }

  /**
   * Commits changes to the repository
   */
  async commitChanges(changedFiles: string[]): Promise<void> {
    console.log(`Committing changes to ${changedFiles.length} files`);

    // Add all changed files
    await this.git.add(changedFiles);

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