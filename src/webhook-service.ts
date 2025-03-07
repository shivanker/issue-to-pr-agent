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

      let changedFiles: string[] = [];
      let commandOutput: { stdout: string, stderr: string } | undefined;

      try {
        // Try to make changes using the AI agent
        const result = await gitService.makeChanges(defaultChangeImplementer);
        changedFiles = result.changedFiles;
        commandOutput = result.commandOutput;
      } catch (error) {
        console.error('Error implementing changes:', error);

        // Get any output that was collected before the error
        if (error instanceof Error && 'commandOutput' in gitService) {
          commandOutput = (gitService as any).commandOutput;
        }

        // Post error as a comment
        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          `### ❌ Error implementing changes

There was an error while trying to implement changes for this issue:

\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

${error instanceof Error && error.cause ? `Caused by: ${String(error.cause)}` : ''}
`
        );

        // We'll still post the command output if available, then return
        if (commandOutput) {
          const outputComment = `### 🤖 AI Agent Output (before error)

<details>
<summary>Click to view detailed output</summary>

\`\`\`
${commandOutput.stdout}
\`\`\`

${commandOutput.stderr ? `**Error output:**\n\`\`\`\n${commandOutput.stderr}\n\`\`\`` : ''}
</details>
`;

          await addIssueComment(
            octokit,
            repoInfo.owner,
            repoInfo.repo,
            issueInfo.number,
            outputComment
          );
        }

        return;
      }

      // Post aider command output as a comment if available
      if (commandOutput) {
        const outputComment = `### 🤖 AI Agent Output

<details>
<summary>Click to view detailed output</summary>

\`\`\`
${commandOutput.stdout}
\`\`\`

${commandOutput.stderr ? `**Error output:**\n\`\`\`\n${commandOutput.stderr}\n\`\`\`` : ''}
</details>
`;

        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          outputComment
        );
      }

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
    } catch (error) {
      console.error('Error processing issue:', error);

      // Post error comment to the issue
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          `🤖❌ Error: I encountered a problem while processing this issue:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check the logs for more details.`
        );
      } catch (commentError) {
        console.error('Failed to post error comment to issue:', commentError);
      }

      throw error; // Re-throw for top-level error handling
    } finally {
      // Clean up resources
      gitService.cleanup();
    }
  }
}