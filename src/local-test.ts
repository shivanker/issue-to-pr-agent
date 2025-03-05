import 'dotenv/config';
import { handler } from './index';
import { sampleIssueOpenedEvent } from './test-data';
import { config } from './config';

/**
 * Main function to run the local test
 */
async function runLocalTest() {
  console.log('Starting local test with sample issue opened event');
  console.log('Using config:', JSON.stringify(config, null, 2));
  console.log('------------------------------------------------------');

  try {
    // Call the Lambda handler with the sample event
    const response = await handler(sampleIssueOpenedEvent);

    console.log('------------------------------------------------------');
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('Local test completed');
  } catch (error) {
    console.error('Error in local test:', error);
  }
}

// Run the test
runLocalTest();