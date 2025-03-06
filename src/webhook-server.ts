import 'dotenv/config';
import express, { Request, Response } from 'express';
import { handler } from './index';
import { LambdaEvent } from './types';

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('Received webhook request');

    // Convert Express request to Lambda event format
    const lambdaEvent: LambdaEvent = {
      headers: req.headers as Record<string, string>,
      body: JSON.stringify(req.body),
      isBase64Encoded: false
    };

    // Process the webhook using the Lambda handler
    const response = await handler(lambdaEvent);

    // Return the response
    res.status(response.statusCode).send(JSON.parse(response.body));
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
  console.log(`Webhook server running at http://localhost:${port}`);
  console.log(`Webhook endpoint: http://localhost:${port}/webhook`);
  console.log(`Use ngrok to expose this endpoint to the internet: ngrok http ${port}`);
});