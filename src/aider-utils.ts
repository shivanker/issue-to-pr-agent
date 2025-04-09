import { config } from "./config";
import { spawn } from "child_process";
import { IssueInfo, RepoInfo } from "./types";
import { Octokit } from "@octokit/rest";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addIssueComment } from "./github";

const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);

/**
 * Sets up the necessary environment for running Aider.
 * Ensures the Aider home directory exists and contains the binary.
 */
export function setupAiderEnvironment(): void {
  if (!fs.existsSync(config.app.aiderHome)) {
    console.log(`Creating Aider home directory: ${config.app.aiderHome}`);
    fs.mkdirSync(config.app.aiderHome, { recursive: true });
    // Assuming /opt/bin contains the necessary aider setup
    // Adjust this path if the source location changes in your Dockerfile or setup
    const sourceBinPath = "/opt/bin";
    if (fs.existsSync(sourceBinPath)) {
      console.log(
        `Copying Aider binary/files from ${sourceBinPath} to ${config.app.aiderHome}`
      );
      // Use cpSync for simplicity, ensure Node version supports it (>= 16.7.0)
      fs.cpSync(sourceBinPath, config.app.aiderHome, { recursive: true });
      console.log(
        `Aider environment setup complete in ${config.app.aiderHome}`
      );
    } else {
      console.warn(
        `Aider source path ${sourceBinPath} not found. Skipping copy.`
      );
    }
  } else {
    console.log(`Aider home directory already exists: ${config.app.aiderHome}`);
  }
}

/**
 * Executes a command with streaming output and progress updates to a GitHub issue.
 * @param command The command to execute.
 * @param repoPath The path to the repository where the command should be executed.
 * @param octokit Optional Octokit instance for posting progress comments.
 * @param repoInfo Optional repository info for posting progress comments.
 * @param issueInfo Optional issue info for posting progress comments.
 * @returns Promise<{ stdout: string; stderr: string }>
 */
export function executeWithStreaming(
  command: string,
  repoPath: string,
  octokit?: Octokit,
  repoInfo?: RepoInfo,
  issueInfo?: IssueInfo // Make issueInfo optional for broader use
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    console.log(`Executing command in ${repoPath}: ${command}`);
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

    // Provide automatic 'y' responses if needed
    if (proc.stdin) {
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
    const LOG_INTERVAL = 45000; // 45 seconds

    // Function to post a combined update to the issue (only if context is provided)
    const postCombinedUpdate = async () => {
      if (
        Date.now() - lastLogTime > LOG_INTERVAL &&
        octokit &&
        repoInfo &&
        issueInfo // Only post if we have issue context
      ) {
        try {
          const hasStdout = stdoutData.trim().length > 0;
          const hasStderr = stderrData.trim().length > 0;

          if (!hasStdout && !hasStderr) {
            // No new output, don't post empty update
            lastLogTime = Date.now(); // Reset timer even if nothing posted
            return;
          }

          let commentBody = `🔄 **Progress Update for Issue #${issueInfo.number}**\n\n`;
          if (hasStdout) {
            commentBody +=
              `<details>\n<summary>Standard Output Log</summary>\n\n` +
              `\`\`\`\n${stdoutData}\n\`\`\`\n</details>\n\n` +
              `**Recent output:** \`${stdoutData.substring(
                Math.max(0, stdoutData.length - 200)
              )}\`\n\n`;
          }
          if (hasStderr) {
            commentBody +=
              `<details>\n<summary>⚠️ Error Output Log</summary>\n\n` +
              `\`\`\`\n${stderrData}\n\`\`\`\n</details>\n\n` +
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
          console.log(`Posted progress update to issue #${issueInfo.number}`);
        } catch (error) {
          console.error("Failed to post progress comment to issue:", error);
        }
        lastLogTime = Date.now();
      }
    };

    proc.stdout.on("data", async (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      // Log only recent output to keep console tidy
      console.log(
        "Command stdout:",
        chunk.substring(Math.max(0, chunk.length - 200)).trim()
      );
      await postCombinedUpdate();
    });

    proc.stderr.on("data", async (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.error(
        "Command stderr:",
        chunk.substring(Math.max(0, chunk.length - 200)).trim()
      );
      await postCombinedUpdate();
    });

    proc.on("close", (code) => {
      // Final progress update attempt before resolving/rejecting
      postCombinedUpdate().finally(() => {
        if (code !== 0) {
          const error = new Error(
            `Command exited with code ${code}: ${command}`
          );
          (error as any).stdout = stdoutData;
          (error as any).stderr = stderrData;
          console.error(
            `Command failed with code ${code}. Stderr: ...${stderrData.substring(
              stderrData.length - 500
            )}`
          );
          reject(error);
        } else {
          console.log(`Command finished successfully: ${command}`);
          resolve({ stdout: stdoutData, stderr: stderrData });
        }
      });
    });

    proc.on("error", (error) => {
      (error as any).stdout = stdoutData;
      (error as any).stderr = stderrData;
      console.error(`Command execution error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Runs the Aider tool with a given prompt.
 * @param repoPath Path to the repository.
 * @param prompt The prompt/message to provide to Aider.
 * @param octokit Optional Octokit instance for progress updates.
 * @param repoInfo Optional repository info for progress updates.
 * @param issueInfo Optional issue info for progress updates.
 * @returns Promise<{ stdout: string; stderr: string }> Output from the Aider command.
 */
export async function runAider(
  repoPath: string,
  prompt: string,
  octokit?: Octokit,
  repoInfo?: RepoInfo,
  issueInfo?: IssueInfo
): Promise<{ stdout: string; stderr: string }> {
  setupAiderEnvironment(); // Ensure environment is ready

  const tempFilePath = path.join(
    os.tmpdir(),
    `aider-message-${Date.now()}.txt`
  );

  let output: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

  try {
    console.log(`Writing prompt to temporary file: ${tempFilePath}`);
    await writeFilePromise(tempFilePath, prompt);

    // Construct the Aider command
    // TODO: Make model and other flags configurable if needed
    const aiderCommand =
      `${config.app.aiderHome}/.local/bin/aider --no-gitignore --model ` +
      `gemini/gemini-2.5-pro-preview-03-25 --yes --auto-commits --dirty-commits ` +
      `--message-file "${tempFilePath}"`;

    console.log(`Running Aider command: ${aiderCommand}`);
    output = await executeWithStreaming(
      aiderCommand,
      repoPath,
      octokit,
      repoInfo,
      issueInfo
    );

    console.log("Aider command finished.");
    console.log(
      "Aider stdout snippet:",
      output.stdout.substring(output.stdout.length - 500)
    );
    if (output.stderr) {
      console.error(
        "Aider stderr snippet:",
        output.stderr.substring(output.stderr.length - 500)
      );
    }
  } catch (error) {
    console.error("Error during Aider execution:", error);

    // Add error to stderr output
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorOutput =
      (error as any).stdout || (error as any).stderr
        ? {
            stdout: (error as any).stdout || "",
            stderr: (error as any).stderr || "",
          }
        : {
            stdout: output.stdout,
            stderr:
              output.stderr +
              `\n\nError running Aider command: ${errorMessage}`,
          };

    // Re-throw with the updated command output
    const enhancedError = new Error(
      `Failed to run Aider command: ${errorMessage}`,
      { cause: error }
    );
    (enhancedError as any).output = errorOutput;
    throw enhancedError;
  } finally {
    // Clean up the temporary message file
    try {
      if (fs.existsSync(tempFilePath)) {
        await unlinkPromise(tempFilePath);
        console.log(`Deleted temporary message file: ${tempFilePath}`);
      }
    } catch (cleanupError) {
      console.error(
        `Error deleting temporary file ${tempFilePath}:`,
        cleanupError
      );
    }
  }

  return output;
}
