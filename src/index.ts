import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Webhooks } from '@octokit/webhooks';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { processIssue } from './github';
import { config } from './config';

// Initialize the GitHub webhooks handler
const webhooks = new Webhooks({
  secret: config.webhookSecret,
});

// Register the issue opened event handler
webhooks.on('issues.opened', async ({ payload }) => {
  console.log(`Issue opened: ${payload.issue.title}`);
  
  try {
    // Create an authenticated Octokit instance
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: payload.installation?.id,
      },
    });

    // Process the issue and create a PR
    await processIssue(octokit, payload);
    
    console.log(`Successfully processed issue #${payload.issue.number}`);
  } catch (error) {
    console.error('Error processing issue:', error);
    throw error;
  }
});

// Lambda handler function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Verify and process the webhook
    const signature = event.headers['x-hub-signature-256'] || '';
    const id = event.headers['x-github-delivery'] || '';
    const name = event.headers['x-github-event'] || '';
    const payload = JSON.parse(event.body || '{}');
    
    await webhooks.verifyAndReceive({
      id,
      name,
      payload,
      signature,
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error processing webhook',
        error: (error as Error).message 
      }),
    };
  }
};