import { createOctokitApp, getRepoInfoFromPayload, getIssueInfoFromPayload, createPullRequest, addIssueComment, getInstallationIdFromPayload } from './github';
import { GitService } from './git-service';
import { config } from './config';
import { defaultChangeImplementer } from './change-implementer';

/**
 * Service for handling GitHub webhooks
 */
export class WebhookService {
  /**
   * Handles a GitHub webhook event
   */
  async handleWebhook(event: string, payload: any): Promise<void> {
    console.log(`Received GitHub webhook event: ${event}`);

    // Only process 'issues' events with the 'opened' action
    if (event === 'issues' && payload.action === 'opened') {
      await this.handleIssueOpened(payload);
    } else {
      console.log(`Ignoring event ${event} with action ${payload.action}`);
    }
  }

  /**
   * Handles a new issue being opened
   */
  private async handleIssueOpened(payload: any): Promise<void> {
    console.log(`Processing new issue: #${payload.issue.number} - ${payload.issue.title}`);

    try {
      // Get repository and issue information
      const repoInfo = getRepoInfoFromPayload(payload);
      const issueInfo = getIssueInfoFromPayload(payload);

      // Get installation ID from payload
      const installationId = getInstallationIdFromPayload(payload);
      console.log(`Using installation ID: ${installationId || 'none (using app-level authentication)'}`);

      // Create an authenticated Octokit instance
      const octokit = await createOctokitApp(installationId);

      // Create GitService instance
      const gitService = new GitService(repoInfo, issueInfo, octokit, installationId);

      try {
        // Clone the repository
        await gitService.cloneRepository();

        // Create a new branch
        const branchName = await gitService.createBranch();

        // Make changes to the repository
        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          `🤖 I've started working on this issue. 🛠️`
        );
        const changedFiles = await gitService.makeChanges(defaultChangeImplementer);

        // If no files were changed, skip the PR creation
        if (changedFiles.length === 0) {
          console.log('No files were changed, skipping PR creation');
          await addIssueComment(
            octokit,
            repoInfo.owner,
            repoInfo.repo,
            issueInfo.number,
            '🤖 No changes were made based on this issue, skipping PR creation.'
          );
          return;
        }

        // TODO: Generate commit message & PR title/body automatically
        // Commit the changes
        await gitService.commitChanges(changedFiles);

        // Push the changes
        await gitService.pushChanges();

        // Create a PR
        const prTitle = `${config.app.prTitlePrefix}${issueInfo.number}: ${issueInfo.title}`;
        const prBody = `This PR addresses issue #${issueInfo.number}\n\n${issueInfo.body || ''}`;

        const prNumber = await createPullRequest(octokit, {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          title: prTitle,
          head: branchName,
          base: repoInfo.defaultBranch,
          body: prBody,
          draft: false,
          maintainer_can_modify: true,
        });

        // Add a comment to the issue
        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          `🤖 I've created a pull request #${prNumber} with proposed changes for this issue.`
        );

        console.log(`Successfully created PR #${prNumber} for issue #${issueInfo.number}`);
      } finally {
        // Clean up resources
        gitService.cleanup();
      }
    } catch (error) {
      console.error('Error processing issue:', error);
      throw error;
    }
  }
}