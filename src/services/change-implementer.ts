import * as fs from 'fs';
import * as path from 'path';
import { IssueInfo } from '../types';

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
    // Example: Create a text file with issue information in the repository root
    const issueFileName = `issue-${issueInfo.number}.md`;
    const issueFilePath = path.join(repoPath, issueFileName);

    // Create a markdown file with issue details
    const content = `# Issue #${issueInfo.number}: ${issueInfo.title}

Created by automatic PR generator.

## Issue Body
${issueInfo.body || 'No description provided.'}

## Labels
${issueInfo.labels.length > 0 ? issueInfo.labels.join(', ') : 'No labels'}

This file was automatically generated based on issue #${issueInfo.number}.
`;

    fs.writeFileSync(issueFilePath, content);
    changedFiles.push(issueFileName);

    // This is a simple example implementation
    // In a real-world scenario, you would:
    // 1. Parse the issue content for specific instructions
    // 2. Make targeted changes to specific files
    // 3. Add, modify, or remove code based on the issue requirements
    // 4. Update relevant documentation, etc.

    console.log(`Created file: ${issueFileName}`);

    return changedFiles;
  } catch (error) {
    console.error('Error implementing changes:', error);
    return [];
  }
}