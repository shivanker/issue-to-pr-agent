import { addIssueComment } from "./github";
import { config } from "./config";
import { exec, spawn } from "child_process";
import { IssueInfo, ChangeResult, RepoInfo } from "./types";
import { Octokit } from "@octokit/rest";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);

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
    `Implementing changes for issue #${issueInfo.number} in ${repoPath}`
  );

  const changedFiles: string[] = [];
  let commandOutput = { stdout: "", stderr: "" };

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
      .filter((filename) => filename !== null) as string[]
  );

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

  // Create a temporary file for the message
  const tempFilePath = path.join(
    os.tmpdir(),
    `aider-message-${Date.now()}.txt`
  );

  try {
    // Write the message to the temporary file
    await writeFilePromise(tempFilePath, structuredMessage);
    console.log(`Message written to temporary file: ${tempFilePath}`);

    // Copy the aider binary to the aiderHome directory
    if (!fs.existsSync(config.app.aiderHome)) {
      fs.mkdirSync(config.app.aiderHome, { recursive: true });
      fs.cpSync("/opt/bin", config.app.aiderHome, { recursive: true });
    }

    // Run aider command to implement changes with message-file
    const aiderCommand = `${config.app.aiderHome}/.local/bin/aider --no-gitignore --model fireworks_ai/accounts/fireworks/models/deepseek-r1 --yes --auto-commits --dirty-commits --editor-model claude-3-7-sonnet-latest --message-file "${tempFilePath}"`;

    console.log(`Running aider command: ${aiderCommand}`);

    const executeWithStreaming = (
      command: string
    ): Promise<{ stdout: string; stderr: string }> => {
      return new Promise((resolve, reject) => {
        const proc = spawn(command, {
          shell: true,
          cwd: repoPath,
          stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
          env: {
            ...process.env,
            HOME: config.app.aiderHome,
            PATH: `${config.app.aiderHome}/.local/bin:${process.env.PATH}`,
          },
        });

        // Provide automatic 'y' responses to any prompts
        if (proc.stdin) {
          // Write 'y' + enter periodically to answer any prompts that might appear
          const autoResponder = setInterval(() => {
            proc.stdin?.write("y\n");
          }, 5000); // Check every 5 seconds

          // Clean up interval when process ends
          proc.on("close", () => clearInterval(autoResponder));
          proc.on("error", () => clearInterval(autoResponder));
        }

        let stdoutData = "";
        let stderrData = "";
        let lastLogTime = Date.now();
        const LOG_INTERVAL = 45000;

        // Function to post a combined update to the issue
        const postCombinedUpdate = async () => {
          if (
            Date.now() - lastLogTime > LOG_INTERVAL &&
            octokit &&
            repoInfo &&
            issueInfo
          ) {
            try {
              const hasStdout = stdoutData.trim().length > 0;
              const hasStderr = stderrData.trim().length > 0;

              let commentBody = `🔄 **Progress Update for Issue #${issueInfo.number}**\n\n`;

              // Add stdout section if there's output
              if (hasStdout) {
                commentBody +=
                  `<details>\n` +
                  `<summary>Standard Output (click to expand full log)</summary>\n\n` +
                  `\`\`\`\n${stdoutData}\n\`\`\`\n` +
                  `</details>\n\n` +
                  `**Recent output:** \`${stdoutData.substring(
                    Math.max(0, stdoutData.length - 200)
                  )}\`\n\n`;
              }

              // Add stderr section if there's output
              if (hasStderr) {
                commentBody +=
                  `<details>\n` +
                  `<summary>⚠️ Error Output (click to expand full log)</summary>\n\n` +
                  `\`\`\`\n${stderrData}\n\`\`\`\n` +
                  `</details>\n\n` +
                  `**Recent error output:** \`${stderrData.substring(
                    Math.max(0, stderrData.length - 200)
                  )}\`\n\n`;
              }

              await addIssueComment(
                octokit,
                repoInfo.owner,
                repoInfo.repo,
                issueInfo.number,
                commentBody
              );
              console.log("Posted combined progress update to issue");
            } catch (error) {
              console.error(
                "Failed to post combined progress comment to issue:",
                error
              );
            }
            lastLogTime = Date.now();
          }
        };

        proc.stdout.on("data", async (data) => {
          const chunk = data.toString();
          stdoutData += chunk;
          console.log("Command output:", chunk.substring(chunk.length - 200));
          await postCombinedUpdate();
        });

        proc.stderr.on("data", async (data) => {
          const chunk = data.toString();
          stderrData += chunk;
          console.error(
            "Command error output:",
            chunk.substring(chunk.length - 200)
          );
          await postCombinedUpdate();
        });

        proc.on("close", (code) => {
          if (code !== 0) {
            const error = new Error(`Command exited with code ${code}`);
            (error as any).stdout = stdoutData;
            (error as any).stderr = stderrData;
            reject(error);
          } else {
            resolve({ stdout: stdoutData, stderr: stderrData });
          }
        });

        proc.on("error", (error) => {
          (error as any).stdout = stdoutData;
          (error as any).stderr = stderrData;
          reject(error);
        });
      });
    };

    // For the long-running aiderCommand, use the streaming version
    const { stdout, stderr } = await executeWithStreaming(aiderCommand);
    commandOutput = { stdout, stderr };

    console.log("Aider command stdout:", stdout);
    console.log("Aider command stderr:", stderr);
  } catch (error) {
    // Capture any error from the aider command, but still try to collect changed files
    // and include the error in the result's output
    console.error("Error running aider command:", error);

    // Add error to stderr output
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandOutput.stderr += `\n\nError running aider command: ${errorMessage}`;

    // Re-throw the error after we've updated the commandOutput
    const enhancedError = new Error(
      `Failed to run aider command: ${errorMessage}`,
      { cause: error }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;
  }

  try {
    // Get list of changed files by checking git status
    // This will include both staged and unstaged changes
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
        .filter((filename) => filename !== null) as string[]
    );

    // Find new files that weren't in the initial status
    for (const file of currentFiles) {
      if (!initialFiles.has(file)) {
        changedFiles.push(file);
      }
    }

    // Also find files that were in initial status but no longer in current status (deleted files)
    for (const file of initialFiles) {
      if (!currentFiles.has(file)) {
        changedFiles.push(file);
      }
    }

    // If aider made commits already, we need to detect what files were changed in those commits
    // This gets the list of files changed in the most recent commit
    try {
      const { stdout: lastCommitFiles } = await execPromise(
        `cd "${repoPath}" && git show --name-only --pretty="" HEAD`
      );
      const commitChangedFiles = lastCommitFiles
        .split("\n")
        .filter((line) => line.trim() !== "");

      // Add files from the commit that aren't already in our list
      for (const file of commitChangedFiles) {
        if (!changedFiles.includes(file)) {
          changedFiles.push(file);
        }
      }
    } catch (error) {
      // If this fails, it might be because there are no commits yet, which is fine
      console.log("Could not get files from last commit, continuing...");
    }

    console.log(`Modified ${changedFiles.length} files`);

    return { changedFiles, output: commandOutput };
  } catch (error) {
    console.error("Error detecting changed files:", error);

    // Add error to stderr output
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandOutput.stderr += `\n\nError detecting changed files: ${errorMessage}`;

    // Re-throw with the updated command output
    const enhancedError = new Error(
      `Failed to detect changed files: ${errorMessage}`,
      {
        cause: error,
      }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;
  }
}
