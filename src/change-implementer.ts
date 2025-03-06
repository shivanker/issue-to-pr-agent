import * as fs from 'fs';
import * as path from 'path';
import { IssueInfo } from './types';

/**
 * Parses issue body to extract structured information
 * @param body Issue body text
 * @returns Object with extracted information
 */
function parseIssueBody(body: string | null): Record<string, string> {
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
 * @returns Array of paths to files that were modified
 */
export async function defaultChangeImplementer(repoPath: string, issueInfo: IssueInfo): Promise<string[]> {
  console.log(`Implementing changes for issue #${issueInfo.number} in ${repoPath}`);

  const changedFiles: string[] = [];

  try {
    // Parse the issue body for structured information
    const parsedInfo = parseIssueBody(issueInfo.body);

    // Create a markdown file with issue details (default action)
    const issueFileName = `issue-${issueInfo.number}.md`;
    const issueFilePath = path.join(repoPath, issueFileName);

    // Create a markdown file with issue details
    const content = `# Issue #${issueInfo.number}: ${issueInfo.title}

Created by automatic PR generator.

## Issue Body
${issueInfo.body || 'No description provided.'}

## Labels
${issueInfo.labels.length > 0 ? issueInfo.labels.join(', ') : 'No labels'}

## Parsed Information
${Object.entries(parsedInfo).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

This file was automatically generated based on issue #${issueInfo.number}.
`;

    fs.writeFileSync(issueFilePath, content);
    changedFiles.push(issueFileName);

    // If specific files were mentioned in the issue, try to modify them
    if (parsedInfo.files) {
      const filesToModify = parsedInfo.files.split(',').map(f => f.trim());

      for (const file of filesToModify) {
        const filePath = path.join(repoPath, file);

        // Check if file exists
        if (fs.existsSync(filePath)) {
          // Read the file content
          let fileContent = fs.readFileSync(filePath, 'utf8');

          // Add a comment to the file about the issue
          const comment = `\n// Modified by issue-to-pr-agent for issue #${issueInfo.number}\n`;
          fileContent += comment;

          // Write the modified content back
          fs.writeFileSync(filePath, fileContent);
          changedFiles.push(file);
        } else {
          console.log(`File ${file} specified in issue does not exist in the repository`);
        }
      }
    }

    console.log(`Modified ${changedFiles.length} files`);

    return changedFiles;
  } catch (error) {
    console.error('Error implementing changes:', error);
    return [];
  }
}