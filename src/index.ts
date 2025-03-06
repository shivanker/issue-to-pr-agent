import { config } from './config';
import type { LambdaEvent, LambdaResponse } from './types';
// Import AWS X-Ray SDK for Lambda tracing support
import * as AWSXRay from 'aws-xray-sdk';

/**
 * Lambda handler function for GitHub webhook events
 */
export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Add correlation ID for tracking the request
    const correlationId = event.headers['x-github-delivery'] ||
                          event.headers['X-GitHub-Delivery'] ||
                          `manual-${Date.now()}`;

    console.log(`Processing webhook with correlation ID: ${correlationId}`);

    // Get the GitHub event name from the header
    const githubEvent = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

    if (!githubEvent) {
      console.error(`[${correlationId}] No GitHub event header found`);
      return {
        statusCode: 400,
        headers: {
          'X-Correlation-ID': correlationId
        },
        body: JSON.stringify({
          error: 'No GitHub event header found',
          correlationId
        }),
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

          // TODO: verify the signature here
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

    // Dynamic import to avoid top-level await
    const { WebhookService } = await import('./webhook-service');
    const webhookService = new WebhookService();

    // Process the webhook
    await webhookService.handleWebhook(githubEvent, payload);

    // Return a successful response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
    };
  } catch (error) {
    // Get correlation ID if available
    const correlationId = event.headers['x-github-delivery'] ||
                          event.headers['X-GitHub-Delivery'] ||
                          `error-${Date.now()}`;

    console.error(`[${correlationId}] Error processing webhook:`, error);

    // Return an error response with correlation ID
    return {
      statusCode: 500,
      headers: {
        'X-Correlation-ID': correlationId
      },
      body: JSON.stringify({
        error: 'Error processing webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      }),
    };
  }
};