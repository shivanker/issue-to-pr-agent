import 'dotenv/config';
import { handler } from './index';
import { sampleIssueOpenedEvent, githubPingEvent } from './test-data';
import { config } from './config';

/**
 * Test the handler with a sample issue opened event
 */
async function testIssueOpened() {
  console.log('Starting local test with sample issue opened event');
  console.log('------------------------------------------------------');

  try {
    // Call the Lambda handler with the sample event
    const response = await handler(sampleIssueOpenedEvent);

    console.log('------------------------------------------------------');
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('Issue opened test completed');
  } catch (error) {
    console.error('Error in issue opened test:', error);
  }
}

/**
 * Test the handler with the GitHub ping event
 */
async function testGitHubPing() {
  console.log('\nStarting local test with GitHub ping event');
  console.log('------------------------------------------------------');

  try {
    // Call the Lambda handler with the ping event
    const response = await handler(githubPingEvent);

    console.log('------------------------------------------------------');
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('GitHub ping test completed');
  } catch (error) {
    console.error('Error in GitHub ping test:', error);
  }
}

/**
 * Main function to run both tests
 */
async function runLocalTests() {
  console.log('Using config:', JSON.stringify(config, null, 2));
  console.log('======================================================');

  // Run the issue opened test
  await testIssueOpened();

  // Run the GitHub ping test
  await testGitHubPing();

  console.log('\nAll tests completed');
}

// Run the tests
runLocalTests();