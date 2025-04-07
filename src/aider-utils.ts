import { config } from "./config";
import { exec, spawn } from "child_process";
import { IssueInfo, ChangeResult, RepoInfo } from "./types";
import { Octokit } from "@octokit/rest";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addIssueComment } from "./github"; // Assuming addIssueComment can also comment on PRs

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);

let aiderEnvironmentSetupDone = false;

/**
 * Sets up the environment for running aider (e.g., copying binary).
 * Ensures this setup runs only once per Lambda invocation.
 */
function setupAiderEnvironment(): void {
  if (aiderEnvironmentSetupDone) {
    return;
  }
  console.log("Setting up aider environment...");
  // Copy the aider binary to the aiderHome directory if it doesn't exist
  if (!fs.existsSync(config.app.aiderHome)) {
    fs.mkdirSync(config.app.aiderHome, { recursive: true });
    // Ensure the source directory exists before copying
    const sourceDir = "/opt/bin"; // Source directory in Lambda environment
    if (fs.existsSync(sourceDir)) {
      fs.cpSync(sourceDir, config.app.aiderHome, { recursive: true });
      console.log(`Copied contents from ${sourceDir} to ${config.app.aiderHome}`);
    } else {
      console.warn(`Aider source directory ${sourceDir} not found. Skipping copy.`);
      // Optionally, try an alternative path if applicable
      // const altSourceDir = path.join(__dirname, '..', 'bin'); // Example alternative
      // if (fs.existsSync(altSourceDir)) {
      //   fs.cpSync(altSourceDir, config.app.aiderHome, { recursive: true });
      //   console.log(`Copied contents from ${altSourceDir} to ${config.app.aiderHome}`);
      // } else {
      //    console.error(`Aider binary source not found at ${sourceDir} or alternative paths.`);
      //    throw new Error("Aider binary source not found.");
      // }
    }
  } else {
    console.log(`Aider home directory ${config.app.aiderHome} already exists.`);
  }
  aiderEnvironmentSetupDone = true;
  console.log("Aider environment setup complete.");
}


/**
 * Executes a command with streaming I/O, progress updates, and error handling.
 * @param command The command to execute.
 * @param repoPath The path to the repository where the command should run.
 * @param repoInfo Repository information for posting updates.
 * @param issueInfo Issue information for posting updates.
 * @param octokit Authenticated Octokit instance.
 * @returns Promise resolving with stdout and stderr.
 */
const executeWithStreaming = (
  command: string,
  repoPath: string,
  repoInfo: RepoInfo,
  issueInfo: IssueInfo, // Using IssueInfo for PR number as well
  octokit: Octokit
): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    console.log(`Executing command in ${repoPath}: ${command}`);
    const proc = spawn(command, {
      shell: true,
      cwd: repoPath,
      stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
      env: {
        ...process.env,
        HOME: config.app.aiderHome, // Ensure HOME is set for aider config/cache
        PATH: `${config.app.aiderHome}/.local/bin:${process.env.PATH}`, // Ensure aider is in PATH
      },
    });

    let stdoutData = "";
    let stderrData = "";
    let lastLogTime = Date.now();
    const LOG_INTERVAL = 45000; // 45 seconds

    // Provide automatic 'y' responses to any prompts
    let autoResponder: NodeJS.Timeout | null = null;
    if (proc.stdin) {
      // Write 'y' + enter periodically to answer any prompts that might appear
      autoResponder = setInterval(() => {
        if (!proc.stdin?.writableEnded) {
          proc.stdin.write("y\n", (err) => {
             if (err) console.error("Error writing 'y' to stdin:", err);
          });
        } else {
           if (autoResponder) clearInterval(autoResponder);
        }
      }, 5000); // Respond every 5 seconds

      // Clean up interval when process ends
      const cleanupAutoResponder = () => {
        if (autoResponder) clearInterval(autoResponder);
        if (!proc.stdin?.writableEnded) {
           proc.stdin.end(); // Close stdin when process finishes
        }
      };
      proc.on("close", cleanupAutoResponder);
      proc.on("error", cleanupAutoResponder);
    }


    // Function to post a combined update to the issue/PR
    const postCombinedUpdate = async () => {
      if (Date.now() - lastLogTime > LOG_INTERVAL) {
        try {
          const hasStdout = stdoutData.trim().length > 0;
          const hasStderr = stderrData.trim().length > 0;

          // Only post if there's new significant output
          if (!hasStdout && !hasStderr) {
             lastLogTime = Date.now(); // Reset timer even if nothing to post
             return;
          }

          let commentBody = `🔄 **AI Agent Progress Update (Issue/PR #${issueInfo.number})**\n\n`;
          const maxSnippetLength = 300; // Max length for recent output snippets

          // Add stdout section if there's output
          if (hasStdout) {
            const stdoutSnippet = stdoutData.substring(Math.max(0, stdoutData.length - maxSnippetLength)).trim();
            commentBody +=
              `<details>\n` +
              `<summary>Standard Output Log (click to expand)</summary>\n\n` +
              `\`\`\`\n${stdoutData}\n\`\`\`\n` +
              `</details>\n\n` +
              `**Recent output:**\n\`\`\`\n${stdoutSnippet}\n\`\`\`\n\n`;
          }

          // Add stderr section if there's output
          if (hasStderr) {
             const stderrSnippet = stderrData.substring(Math.max(0, stderrData.length - maxSnippetLength)).trim();
            commentBody +=
              `<details>\n` +
              `<summary>⚠️ Error Output Log (click to expand)</summary>\n\n` +
              `\`\`\`\n${stderrData}\n\`\`\`\n` +
              `</details>\n\n` +
              `**Recent error output:**\n\`\`\`\n${stderrSnippet}\n\`\`\`\n\n`;
          }

          await addIssueComment(
            octokit,
            repoInfo.owner,
            repoInfo.repo,
            issueInfo.number, // Post to the issue/PR number
            commentBody
          );
          console.log(`Posted combined progress update to issue/PR #${issueInfo.number}`);
          // Clear buffers after posting to avoid reposting same content? No, keep full log.
        } catch (error) {
          console.error(
            `Failed to post combined progress comment to issue/PR #${issueInfo.number}:`,
            error
          );
        }
        lastLogTime = Date.now(); // Reset timer after attempting post
      }
    };

    proc.stdout?.on("data", async (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      // Log only a snippet to avoid excessive logging
      console.log("Command stdout (snippet):", chunk.substring(0, 200).replace(/\n/g, ' '));
      await postCombinedUpdate();
    });

    proc.stderr?.on("data", async (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.error("Command stderr (snippet):", chunk.substring(0, 200).replace(/\n/g, ' '));
      await postCombinedUpdate();
    });

    proc.on("close", (code) => {
      console.log(`Command exited with code ${code}`);
      // Attempt one final update post before resolving/rejecting
      postCombinedUpdate().finally(() => {
          if (code !== 0) {
            const error = new Error(`Command exited with code ${code}`);
            (error as any).stdout = stdoutData;
            (error as any).stderr = stderrData;
            reject(error);
          } else {
            resolve({ stdout: stdoutData, stderr: stderrData });
          }
      });
    });

    proc.on("error", (error) => {
      console.error("Command execution error:", error);
       // Attempt one final update post before rejecting
       postCombinedUpdate().finally(() => {
          (error as any).stdout = stdoutData;
          (error as any).stderr = stderrData;
          reject(error);
       });
    });
  });
};


/**
 * Runs the aider tool to implement changes based on a message.
 *
 * @param repoPath Path to the cloned repository.
 * @param message The instruction message for aider.
 * @param repoInfo Information about the repository.
 * @param issueInfo Information about the issue (used for context and commenting).
 * @param octokit Authenticated Octokit instance.
 * @returns Promise resolving with the list of changed files and command output.
 */
export async function runAider(
  repoPath: string,
  message: string,
  repoInfo: RepoInfo,
  issueInfo: IssueInfo, // Can represent an issue or a PR
  octokit: Octokit
): Promise<ChangeResult> {
  console.log(`Running aider for issue/PR #${issueInfo.number} in ${repoPath}`);

  // Ensure aider environment is set up (idempotent)
  setupAiderEnvironment();

  let commandOutput = { stdout: "", stderr: "" };
  const changedFiles: string[] = [];

  // Get initial git status to compare later
  const { stdout: initialGitStatus } = await execPromise(
    `cd "${repoPath}" && git status --porcelain`
  ).catch(err => {
      console.warn("Could not get initial git status:", err);
      return { stdout: "" }; // Proceed even if status fails initially
  });
  const initialFiles = new Set(
    initialGitStatus
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const match = line.match(/^..\s+(.+)$/);
        return match ? match[1].trim() : null; // Trim filename
      })
      .filter((filename): filename is string => filename !== null)
  );
  console.log("Initial tracked files:", Array.from(initialFiles));


  // Create a temporary file for the message
  const tempMessageDir = path.join(os.tmpdir(), 'aider-messages');
  if (!fs.existsSync(tempMessageDir)) {
      fs.mkdirSync(tempMessageDir, { recursive: true });
  }
  const tempFilePath = path.join(
    tempMessageDir,
    `aider-message-${repoInfo.owner}-${repoInfo.repo}-${issueInfo.number}-${Date.now()}.txt`
  );

  try {
    // Write the message to the temporary file
    await writeFilePromise(tempFilePath, message);
    console.log(`Aider message written to temporary file: ${tempFilePath}`);

    // Construct the aider command
    // Using --yes for auto-acceptance, --auto-commits for automatic commits by aider
    // --dirty-commits allows committing even if the repo isn't clean (aider handles staging)
    // --no-gitignore to ensure aider can see all files if needed
    // --model specifies the AI model
    const aiderCommand = `${config.app.aiderHome}/.local/bin/aider --model ${config.app.aiderModel} --yes --auto-commits --dirty-commits --no-gitignore --message-file "${tempFilePath}"`;

    console.log(`Running aider command: ${aiderCommand}`);

    // Execute aider using the streaming function
    const { stdout, stderr } = await executeWithStreaming(
        aiderCommand,
        repoPath,
        repoInfo,
        issueInfo,
        octokit
    );
    commandOutput = { stdout, stderr };

    console.log("Aider command finished.");
    // console.log("Aider stdout:", stdout); // Often very long, log snippet or rely on progress updates
    // console.log("Aider stderr:", stderr);

  } catch (error) {
    console.error("Error running aider command:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Capture output even if the command fails
    if (error && typeof error === 'object') {
        commandOutput.stdout = (error as any).stdout || commandOutput.stdout || "";
        commandOutput.stderr = (error as any).stderr || commandOutput.stderr || "";
    }
    commandOutput.stderr += `\n\nError during aider execution: ${errorMessage}`;

    // Re-throw the error after capturing output, ensuring it includes the output
    const enhancedError = new Error(
      `Failed to run aider command: ${errorMessage}`,
      { cause: error }
    );
    (enhancedError as any).output = commandOutput;
    throw enhancedError;

  } finally {
     // Clean up the temporary message file
     if (fs.existsSync(tempFilePath)) {
       try {
         fs.unlinkSync(tempFilePath);
         console.log(`Cleaned up temporary message file: ${tempFilePath}`);
       } catch (unlinkError) {
         console.error(`Error cleaning up temporary message file ${tempFilePath}:`, unlinkError);
       }
     }
  }

  // --- Detect changed files ---
  try {
    console.log("Detecting changed files after aider execution...");
    // Strategy 1: Check git status for uncommitted changes (aider might not always commit)
    const { stdout: gitStatusOutput } = await execPromise(
      `cd "${repoPath}" && git status --porcelain`
    );
    const currentFiles = new Set(
      gitStatusOutput
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const match = line.match(/^..\s+(.+)$/);
          return match ? match[1].trim() : null; // Trim filename
        })
        .filter((filename): filename is string => filename !== null)
    );
     console.log("Files in git status after aider:", Array.from(currentFiles));


    // Files changed according to git status (new, modified, deleted compared to initial state)
    const statusChangedFiles = new Set<string>();
    for (const file of currentFiles) {
        if (!initialFiles.has(file)) { // New or modified file detected by status
            statusChangedFiles.add(file);
        }
    }
    for (const file of initialFiles) {
        if (!currentFiles.has(file)) { // Deleted file detected by status
            statusChangedFiles.add(file);
        }
    }
     console.log("Files changed based on git status diff:", Array.from(statusChangedFiles));


    // Strategy 2: Check files changed in the last commit (if aider used --auto-commits)
    let commitChangedFiles = new Set<string>();
    try {
      // Get files from the most recent commit on the current branch
      const { stdout: lastCommitFilesOutput } = await execPromise(
        `cd "${repoPath}" && git show --name-only --pretty="" HEAD`
      );
      commitChangedFiles = new Set(
        lastCommitFilesOutput
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map(file => file.trim()) // Trim filenames
      );
      console.log("Files changed in last commit (HEAD):", Array.from(commitChangedFiles));
    } catch (error) {
      console.warn("Could not get files from last commit (maybe no commits yet or other git issue):", error);
      // If this fails, rely solely on git status changes
    }

    // Combine results: Files detected by status + files detected in last commit
    const combinedChangedFiles = new Set([...statusChangedFiles, ...commitChangedFiles]);

    // Convert Set to Array for the final result
    changedFiles.push(...combinedChangedFiles);

    console.log(`Detected ${changedFiles.length} changed files:`, changedFiles);

    // Return the result including the command output
    return { changedFiles, output: commandOutput };

  } catch (error) {
    console.error("Error detecting changed files:", error);
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
