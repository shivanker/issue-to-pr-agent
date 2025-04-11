import { exec } from "child_process";
import {
  IssueInfo,
  ChangeResult,
  RepoInfo,
  PrReviewInfo,
  PrReviewChangeImplementer,
} from "./types";
import { Octokit } from "@octokit/rest";
import { promisify } from "util";
import { runAider } from "./aider-utils";

const execPromise = promisify(exec);

/**
 * Parses issue body to extract structured information
 * @param body Issue body text
 * @returns Object with extracted information
 */
export function parseIssueBody(body: string | null): Record<string, string> {
  if (!body) return {};

  const result: Record<string, string> = {};

  // Look for structured sections in the issue body
  // Example formats to support:
  // - "Files to modify: file1.js, file2.js"
  // - "Changes: Add feature X to component Y"

  const fileMatch = body.match(/files to modify:([^\n]+)/i);
  if (fileMatch && fileMatch[1]) {
    result.files = fileMatch[1].trim();
  }

  const changesMatch = body.match(/changes:([^\n]+)/i);
  if (changesMatch && changesMatch[1]) {
    result.changes = changesMatch[1].trim();
  }

  return result;
}

/**
 * Default implementation for making changes to a repository based on an issue
 * This is where you would define the logic for how to modify the repository in
 * response to an issue.
 *
 * @param repoPath Path to the cloned repository
 * @param issueInfo Information about the issue that triggered the changes
 * @param repoInfo Optional repository information
 * @param octokit Optional Octokit instance for GitHub API
 * @returns ChangeResult with array of paths to files that were modified and command output
 */
export async function defaultChangeImplementer(
  repoPath: string,
  issueInfo: IssueInfo,
  repoInfo?: RepoInfo,
  octokit?: Octokit
): Promise<ChangeResult> {
  console.log(
    `Implementing changes for issue #${issueInfo.number} in ${repoPath}`
  );

  const changedFiles: string[] = [];
  let commandOutput: { stdout: string; stderr: string } = {
    stdout: "",
    stderr: "",
  };

  // Get initial git status to compare later
  const { stdout: initialGitStatus } = await execPromise(
    `cd "${repoPath}" && git status --porcelain`
  );
  const initialFiles = new Set(
    initialGitStatus
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const match = line.match(/^..\s+(.+)$/);
        return match ? match[1] : null;
      })
      .filter((filename): filename is string => filename !== null)
  );

  // Parse the issue body to extract structured information
  const parsedInfo = parseIssueBody(issueInfo.body);

  // Create a well-structured prompt for aider
  const structuredPrompt = `
Issue #${issueInfo.number}: ${issueInfo.title}

<Issue_Description>
${issueInfo.body || "No description provided."}
</Issue_Description>

${parsedInfo.files ? `Files to modify: ${parsedInfo.files}` : ""}
${parsedInfo.changes ? `Changes needed: ${parsedInfo.changes}` : ""}

Please implement the necessary changes to address this issue.
Focus on high quality implementation that follows best practices.
`.trim();

  try {
    // Run Aider using the utility function
    console.log("Invoking Aider to implement changes...");
    commandOutput = await runAider(
      repoPath,
      structuredPrompt,
      octokit,
      repoInfo,
      issueInfo
    );
    console.log("Aider finished successfully.");
  } catch (error) {
    // runAider throws an error with output attached if it fails
    console.error("Error running runAider:", error);
    commandOutput = (error as any).output || {
      stdout: "",
      stderr: `Aider invocation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };

    // Re-throw the error after capturing output
    const enhancedError = new Error(
      `Failed to run aider command: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;
  }

  // Detect changed files
  try {
    // Get list of changed files by checking git status
    // This will include both staged and unstaged changes
    console.log("Detecting changed files after Aider execution...");
    const { stdout: gitStatusOutput } = await execPromise(
      `cd "${repoPath}" && git status --porcelain`
    );

    // Parse git status output to get changed files
    const currentFiles = new Set(
      gitStatusOutput
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          // Git status --porcelain format is "XY filename"
          // where X is status in staging area, Y is status in working directory
          const match = line.match(/^..\s+(.+)$/);
          return match ? match[1] : null;
        })
        .filter((filename): filename is string => filename !== null)
    );

    for (const file of currentFiles) {
      changedFiles.push(file);
    }
    for (const file of initialFiles) {
      if (!currentFiles.has(file)) {
        // File was present initially but not anymore -> deleted
        changedFiles.push(file);
      }
    }

    // If aider made commits, get files from the last commit
    // This helps capture changes even if git status is clean after auto-commit
    try {
      const { stdout: lastCommitFiles } = await execPromise(
        `cd "${repoPath}" && git show --name-only --pretty="" HEAD`
      );
      const commitChangedFiles = lastCommitFiles
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const file of commitChangedFiles) {
        if (!changedFiles.includes(file)) {
          changedFiles.push(file);
        }
      }
      console.log("Included files from last aider commit.");
    } catch (error) {
      console.log(
        "Could not get files from last commit (maybe no commits yet), continuing..."
      );
    }

    // Deduplicate changedFiles
    const uniqueChangedFiles = [...new Set(changedFiles)];

    console.log(`Detected ${uniqueChangedFiles.length} unique changed files.`);

    return { changedFiles: uniqueChangedFiles, output: commandOutput };
  } catch (error) {
    console.error("Error detecting changed files:", error);

    // Add error to stderr output
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandOutput.stderr += `\n\nError detecting changed files: ${errorMessage}`;

    // Re-throw with the updated command output
    const enhancedError = new Error(
      `Failed to detect changed files: ${errorMessage}`,
      { cause: error }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;
  }
}

/**
 * Builds a structured prompt for aider from PR review comments
 * @param prInfo PR review information
 * @returns A well-structured prompt for aider
 */
function buildPrReviewPrompt(prInfo: PrReviewInfo): string {
  const commentsByFile: Record<
    string,
    { line: number | undefined; comment: string }[]
  > = {};

  // Organize comments by file
  for (const review of prInfo.reviews) {
    if (review.path) {
      if (!commentsByFile[review.path]) {
        commentsByFile[review.path] = [];
      }

      commentsByFile[review.path].push({
        line: review.line,
        comment: review.body,
      });
    }
  }

  // Build prompt with all comments organized by file
  let prompt =
    `PR #${prInfo.prNumber}: ${prInfo.prTitle}\n\n` +
    `<PR_Description>\n${
      prInfo.prBody || "No description provided."
    }\n</PR_Description>\n\n`;

  prompt += `Please implement the changes requested in the following review comments:\n\n`;

  // Add general comments (not associated with specific files)
  const generalComments = prInfo.reviews.filter((r) => !r.path);
  if (generalComments.length > 0) {
    prompt += "General comments:\n\n";
    for (const comment of generalComments) {
      prompt += `${comment.body}\n\n`;
    }
  }

  // Add file-specific comments with line numbers
  for (const [file, comments] of Object.entries(commentsByFile)) {
    prompt += `File: ${file}\n`;
    for (const { line, comment } of comments) {
      prompt += `${line ? `Line ${line}: ` : ""}${comment}\n\n`;
    }
    prompt += "\n";
  }

  return prompt.trim();
}

/**
 * Implements changes based on PR review comments
 */
export const prReviewChangeImplementer: PrReviewChangeImplementer = async (
  repoPath: string,
  prInfo: PrReviewInfo,
  repoInfo: RepoInfo,
  octokit: Octokit
): Promise<ChangeResult> => {
  console.log(
    `Implementing changes for PR #${prInfo.prNumber} based on review comments`
  );

  const changedFiles: string[] = [];
  let commandOutput: { stdout: string; stderr: string } = {
    stdout: "",
    stderr: "",
  };

  // Get initial git status to compare later
  const { stdout: initialGitStatus } = await execPromise(
    `cd "${repoPath}" && git status --porcelain`
  );
  const initialFiles = new Set(
    initialGitStatus
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const match = line.match(/^..\s+(.+)$/);
        return match ? match[1] : null;
      })
      .filter((filename): filename is string => filename !== null)
  );

  // Create a well-structured prompt for aider with all review comments
  const structuredPrompt = buildPrReviewPrompt(prInfo);

  try {
    // Run Aider using the utility function
    console.log("Invoking Aider to implement review-requested changes...");
    commandOutput = await runAider(
      repoPath,
      structuredPrompt,
      octokit,
      repoInfo
    );
    console.log("Aider finished successfully.");
  } catch (error) {
    // runAider throws an error with output attached if it fails
    console.error("Error running runAider for PR review:", error);
    commandOutput = (error as any).output || {
      stdout: "",
      stderr: `Aider invocation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };

    // Re-throw the error after capturing output
    const enhancedError = new Error(
      `Failed to run aider command for PR review: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;
  }

  // Detect changed files - this is the same code as in defaultChangeImplementer
  try {
    // Get list of changed files by checking git status
    // This will include both staged and unstaged changes
    console.log("Detecting changed files after Aider execution...");
    const { stdout: gitStatusOutput } = await execPromise(
      `cd "${repoPath}" && git status --porcelain`
    );

    // Parse git status output to get changed files
    const currentFiles = new Set(
      gitStatusOutput
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          // Git status --porcelain format is "XY filename"
          // where X is status in staging area, Y is status in working directory
          const match = line.match(/^..\s+(.+)$/);
          return match ? match[1] : null;
        })
        .filter((filename): filename is string => filename !== null)
    );

    for (const file of currentFiles) {
      changedFiles.push(file);
    }
    for (const file of initialFiles) {
      if (!currentFiles.has(file)) {
        // File was present initially but not anymore -> deleted
        changedFiles.push(file);
      }
    }

    // If aider made commits, get files from the last commit
    // This helps capture changes even if git status is clean after auto-commit
    try {
      const { stdout: lastCommitFiles } = await execPromise(
        `cd "${repoPath}" && git show --name-only --pretty="" HEAD`
      );
      const commitChangedFiles = lastCommitFiles
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const file of commitChangedFiles) {
        if (!changedFiles.includes(file)) {
          changedFiles.push(file);
        }
      }
      console.log("Included files from last aider commit.");
    } catch (error) {
      console.log(
        "Could not get files from last commit (maybe no commits yet), continuing..."
      );
    }

    // Deduplicate changedFiles
    const uniqueChangedFiles = [...new Set(changedFiles)];

    console.log(`Detected ${uniqueChangedFiles.length} unique changed files.`);

    return { changedFiles: uniqueChangedFiles, output: commandOutput };
  } catch (error) {
    console.error("Error detecting changed files:", error);

    // Add error to stderr output
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandOutput.stderr += `\n\nError detecting changed files: ${errorMessage}`;

    // Re-throw with the updated command output
    const enhancedError = new Error(
      `Failed to detect changed files: ${errorMessage}`,
      { cause: error }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;
  }
};
