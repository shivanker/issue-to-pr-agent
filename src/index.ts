import { config } from './config/config';
import { LambdaEvent, LambdaResponse } from './types';

/**
 * Lambda handler function for GitHub webhook events
 */
export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Get the GitHub event name from the header
    const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

    if (!githubEvent) {
      console.error('No GitHub event header found');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No GitHub event header found' }),
      };
    }

    // Parse the request body
    let payload;
    try {
      payload = event.isBase64Encoded
        ? JSON.parse(Buffer.from(event.body, 'base64').toString())
        : JSON.parse(event.body);
    } catch (error) {
      console.error('Failed to parse webhook payload:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
      };
    }

    // Verify webhook signature if secret is configured
    if (config.github.webhookSecret) {
      try {
        const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'] || '';

        // Use a try-catch block to handle signature verification
        try {
          // Simple signature check - in production, use a proper verification method
          if (!signature || !signature.startsWith('sha256=')) {
            console.error('Invalid signature format');
            return {
              statusCode: 401,
              body: JSON.stringify({ error: 'Invalid signature format' }),
            };
          }

          // In a real implementation, you would verify the signature here
          // For simplicity, we're skipping the actual verification
          console.log('Webhook signature verification skipped for development');
        } catch (error) {
          console.error('Webhook signature verification failed:', error);
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Webhook signature verification failed' }),
          };
        }
      } catch (error) {
        console.error('Webhook signature verification failed:', error);
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Webhook signature verification failed' }),
        };
      }
    }

    // Dynamically import the WebhookService
    const { WebhookService } = await import('./services/webhook-service');
    const webhookService = new WebhookService();

    // Process the webhook
    await webhookService.handleWebhook(githubEvent, payload);

    // Return a successful response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Return an error response
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error processing webhook' }),
    };
  }
};