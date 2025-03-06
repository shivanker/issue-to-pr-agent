# GitHub App Authentication

This document explains how authentication works in this application and how installation IDs are used.

## Authentication Flow

The application uses GitHub App authentication to interact with GitHub repositories. Here's how it works:

1. **App-Level Authentication**: When the app starts, it authenticates using the GitHub App ID and private key.
2. **Installation-Level Authentication**: When handling webhook events, it extracts the installation ID from the payload and uses it to get a token scoped to that specific installation.

## Installation IDs

An installation ID represents a specific installation of your GitHub App in a user or organization account. It's required for:

- Creating pull requests
- Adding comments to issues
- Accessing repository contents
- Any other repository-specific operations

### How Installation IDs Are Used

1. When a webhook event is received, the application extracts the installation ID from the payload:

   ```typescript
   const installationId = getInstallationIdFromPayload(payload);
   ```

2. It then uses this ID to create an authenticated Octokit instance:

   ```typescript
   const octokit = await createOctokitApp(installationId);
   ```

3. This Octokit instance is now authorized to perform actions on repositories within that specific installation.

## Testing Authentication

For local testing:

1. You can use the sample webhook events in `src/test-data.ts` which include mock installation IDs.
2. For real testing with a specific installation, find your installation ID:
   - Go to your GitHub profile → Settings → Applications → Installed GitHub Apps
   - Click Configure next to your app
   - Check the URL - it will contain `/installations/{installation_id}`
   - Add this ID to your `.env` file as `GITHUB_INSTALLATION_ID`

## Environment Variables

- `GITHUB_APP_ID`: ID of your GitHub App
- `GITHUB_PRIVATE_KEY`: Private key for your GitHub App (with newlines)
- `GITHUB_CLIENT_SECRET`: Client secret (for OAuth flows if needed)
- `GITHUB_INSTALLATION_ID`: Optional fallback installation ID for testing

## References

- [GitHub Apps Authentication Documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Octokit GitHub App Authentication](https://github.com/octokit/auth-app.js)
