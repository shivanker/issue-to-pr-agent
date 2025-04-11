import {
  createOctokitApp,
  getRepoInfoFromPayload,
  getIssueInfoFromPayload,
  createPullRequest,
  addIssueComment,
  getInstallationIdFromPayload,
  getPrInfoFromPayload,
  getPrReviewInfo,
  addPrComment,
} from "./github";
import { GitService } from "./git-service";
import { config } from "./config";
import {
  defaultChangeImplementer,
  prReviewChangeImplementer,
} from "./change-implementer";

/**
 * Service for handling GitHub webhooks
 */
export class WebhookService {
  /**
   * Handles a GitHub webhook event
   */
  async handleWebhook(event: string, payload: any): Promise<void> {
    console.log(`Received GitHub webhook event: ${event}`);

    // Handle different types of events
    if (event === "issues" && payload.action === "opened") {
      await this.handleIssueOpened(payload);
    } else if (
      (event === "pull_request_review" && payload.action === "submitted") ||
      (event === "pull_request_review_comment" && payload.action === "created")
    ) {
      await this.handlePrReviewComment(payload);
    } else {
      console.log(`Ignoring event ${event} with action ${payload.action}`);
    }
  }

  /**
   * Handles a new issue being opened
   */
  private async handleIssueOpened(payload: any): Promise<void> {
    console.log(
      `Processing new issue: #${payload.issue.number} - ${payload.issue.title}`
    );

    // Get repository and issue information
    const repoInfo = getRepoInfoFromPayload(payload);
    const issueInfo = getIssueInfoFromPayload(payload);

    // Get installation ID from payload
    const installationId = getInstallationIdFromPayload(payload);
    console.log(
      `Using installation ID: ${
        installationId || "none (using app-level authentication)"
      }`
    );

    // Create an authenticated Octokit instance
    const octokit = await createOctokitApp(installationId);

    // Create GitService instance
    const gitService = new GitService(
      repoInfo,
      issueInfo,
      octokit,
      installationId
    );

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
      let commandOutput: { stdout: string; stderr: string } | undefined;

      try {
        // Try to make changes using the AI agent
        const result = await gitService.makeChanges(defaultChangeImplementer);
        changedFiles = result.changedFiles;
        commandOutput = result.commandOutput;
      } catch (error) {
        console.error("Error implementing changes:", error);

        // Get any output that was collected before the error
        if (error instanceof Error && "commandOutput" in gitService) {
          commandOutput = (gitService as any).commandOutput;
        }

        // We'll post the command output if available
        if (commandOutput) {
          const outputComment = `### 🤖 AI Agent Output (before error)

<details>
<summary>Click to view detailed output</summary>

\`\`\`
${commandOutput.stdout}
\`\`\`

${
  commandOutput.stderr
    ? `**Error output:**\n\`\`\`\n${commandOutput.stderr}\n\`\`\``
    : ""
}
</details>
`;

          await addIssueComment(
            octokit,
            repoInfo.owner,
            repoInfo.repo,
            issueInfo.number,
            outputComment
          );
        } else {
          // If command output is not available, just post error as a comment
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

${
  error instanceof Error && error.cause
    ? `Caused by: ${String(error.cause)}`
    : ""
}
`
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

${
  commandOutput.stderr
    ? `**Error output:**\n\`\`\`\n${commandOutput.stderr}\n\`\`\``
    : ""
}
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
        console.log("No files were changed, skipping PR creation");
        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          "🤖 No changes were made based on this issue, skipping PR creation."
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
      const prBody = `This PR addresses issue #${issueInfo.number}\n\n${
        issueInfo.body || ""
      }`;

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

      console.log(
        `Successfully created PR #${prNumber} for issue #${issueInfo.number}`
      );
    } catch (error) {
      console.error("Error processing issue:", error);

      // Post error comment to the issue
      try {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        await addIssueComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          issueInfo.number,
          `🤖❌ Error: I encountered a problem while processing this issue:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check the logs for more details.`
        );
      } catch (commentError) {
        console.error("Failed to post error comment to issue:", commentError);
      }

      throw error; // Re-throw for top-level error handling
    } finally {
      // Clean up resources
      gitService.cleanup();
    }
  }

  /**
   * Handles a pull request review or review comment
   */
  private async handlePrReviewComment(payload: any): Promise<void> {
    // Only process if this is a PR that was created by this app (based on PR title prefix)
    const prTitle = payload.pull_request?.title || "";
    if (!prTitle.startsWith(config.app.prTitlePrefix)) {
      console.log("Ignoring PR review on PR not created by this app");
      return;
    }

    console.log(`Processing review on PR #${payload.pull_request.number}`);

    // Get repository information
    const repoInfo = getRepoInfoFromPayload(payload);
    const prInfo = getPrInfoFromPayload(payload);

    // Get installation ID from payload
    const installationId = getInstallationIdFromPayload(payload);
    console.log(
      `Using installation ID: ${
        installationId || "none (using app-level authentication)"
      }`
    );

    // Create an authenticated Octokit instance
    const octokit = await createOctokitApp(installationId);

    // Create GitService instance
    const gitService = new GitService(
      repoInfo,
      // We need to pass something for issueInfo - we'll just use dummy data
      { number: prInfo.prNumber, title: "", body: null, labels: [] },
      octokit,
      installationId
    );

    try {
      // Clone the repository
      await gitService.cloneRepository();

      // Get detailed PR and review information
      const fullPrInfo = await getPrReviewInfo(
        octokit,
        repoInfo.owner,
        repoInfo.repo,
        prInfo.prNumber
      );

      // Configure the git service for the PR branch
      gitService.configurePrBranch(fullPrInfo);

      // Checkout the PR branch
      await gitService.checkoutPrBranch();

      // Add a comment to let the user know we're working on it
      await addPrComment(
        octokit,
        repoInfo.owner,
        repoInfo.repo,
        prInfo.prNumber,
        `🤖 I'm implementing the requested changes from the review. 🛠️`
      );

      let changedFiles: string[] = [];
      let commandOutput: { stdout: string; stderr: string } | undefined;

      try {
        // Make changes based on the PR review comments
        const result = await gitService.updatePrWithChanges(
          prReviewChangeImplementer,
          fullPrInfo
        );
        changedFiles = result.changedFiles;
        commandOutput = result.commandOutput;
      } catch (error) {
        console.error("Error implementing review-requested changes:", error);

        // Get any output that was collected before the error
        if (error instanceof Error && "commandOutput" in gitService) {
          commandOutput = (gitService as any).commandOutput;
        }

        // Post the error and any output as a comment
        if (commandOutput) {
          const outputComment = `### 🤖 AI Agent Output (before error)

<details>
<summary>Click to view detailed output</summary>

\`\`\`
${commandOutput.stdout}
\`\`\`

${
  commandOutput.stderr
    ? `**Error output:**\n\`\`\`\n${commandOutput.stderr}\n\`\`\``
    : ""
}
</details>
`;

          await addPrComment(
            octokit,
            repoInfo.owner,
            repoInfo.repo,
            prInfo.prNumber,
            outputComment
          );
        } else {
          // If command output is not available, just post error as a comment
          await addPrComment(
            octokit,
            repoInfo.owner,
            repoInfo.repo,
            prInfo.prNumber,
            `### ❌ Error implementing review-requested changes

There was an error while trying to implement the review-requested changes:

\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

${
  error instanceof Error && error.cause
    ? `Caused by: ${String(error.cause)}`
    : ""
}
`
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

${
  commandOutput.stderr
    ? `**Error output:**\n\`\`\`\n${commandOutput.stderr}\n\`\`\``
    : ""
}
</details>
`;

        await addPrComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          prInfo.prNumber,
          outputComment
        );
      }

      // If no files were changed, inform the user
      if (changedFiles.length === 0) {
        console.log("No files were changed, skipping commit");
        await addPrComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          prInfo.prNumber,
          "🤖 No changes were made based on the review comments."
        );
        return;
      }

      // Commit the changes
      await gitService.commitChanges(changedFiles);

      // Push the changes
      await gitService.pushChanges();

      // Add a comment to the PR
      await addPrComment(
        octokit,
        repoInfo.owner,
        repoInfo.repo,
        prInfo.prNumber,
        `🤖 I've updated the PR with changes based on the review comments.\n\n${
          changedFiles.length > 0
            ? `Modified files:\n${changedFiles
                .map((f) => `- \`${f}\``)
                .join("\n")}`
            : ""
        }`
      );

      console.log(
        `Successfully updated PR #${prInfo.prNumber} based on review comments`
      );
    } catch (error) {
      console.error("Error processing PR review:", error);

      // Post error comment to the PR
      try {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        await addPrComment(
          octokit,
          repoInfo.owner,
          repoInfo.repo,
          prInfo.prNumber,
          `🤖❌ Error: I encountered a problem while processing the review comments:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease check the logs for more details.`
        );
      } catch (commentError) {
        console.error("Failed to post error comment to PR:", commentError);
      }

      throw error; // Re-throw for top-level error handling
    } finally {
      // Clean up resources
      gitService.cleanup();
    }
  }
}
