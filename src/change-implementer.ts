import { config } from "./config";
import { IssueInfo, ChangeResult, RepoInfo } from "./types";
import { Octokit } from "@octokit/rest";
import { runAider } from "./aider-utils"; // Import the refactored function

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
 * This is where you would define the logic for how to modify the repository in response to an issue
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
    `Preparing instructions for aider for issue #${issueInfo.number} in ${repoPath}`
  );

  // Ensure octokit is provided if needed by runAider for progress updates
  if (!octokit) {
    throw new Error("Octokit instance is required for defaultChangeImplementer");
  }
  if (!repoInfo) {
      throw new Error("RepoInfo is required for defaultChangeImplementer");
  }

  // Parse the issue body to extract structured information
  const parsedInfo = parseIssueBody(issueInfo.body);

  // Create a well-structured message for aider
  const structuredMessage = `
Issue #${issueInfo.number}: ${issueInfo.title}

${issueInfo.body || "No description provided."}

${parsedInfo.files ? `Files to modify: ${parsedInfo.files}` : ""}
${parsedInfo.changes ? `Changes needed: ${parsedInfo.changes}` : ""}

Please implement the necessary changes to address this issue. Focus on high quality implementation that follows best practices.
`.trim();

  // Call the refactored runAider function
  const result = await runAider(
    repoPath,
    structuredMessage,
    repoInfo,
    issueInfo,
    octokit
  );

  console.log(
    `Aider finished for issue #${issueInfo.number}. Changed files: ${result.changedFiles.join(", ")}`
  );

  return result;
}
