import dotenv from 'dotenv';
import fs from 'fs';
import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import ExpressWs from 'express-ws';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocket } from 'ws';
import axios from 'axios';
import cors from 'cors';
import { toolManifest } from './agent/tools/toolManifest';
import { GptReturnResponse, GptService } from './responseServer/GptService';
import { merge as mergeInstructions } from './agent/utils/instructions/merge';

dotenv.config();

const promptContext = mergeInstructions('./agent/instructions');

const PORT: number = parseInt(process.env.PORT || '3001', 10);
const SERVERLESS_PORT = parseInt(process.env.SERVERLESS_PORT || '3000', 10);
const COAST_WEBHOOK_URL: string = process.env.COAST_WEBHOOK_URL || '';

let externalMessage: {
  body: string;
  from: string;
} | null = null;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

// Initialize express-ws
expressWs(app);

// Enable CORS
app.use(cors());

app.get('/', (req: Request, res: Response): void => {
  res.send('WebSocket Server Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Only in dev, Proxy the twilio serverless functions
// so that they can be ran via ngrok as well via a single port and domain.
if (process.env.NODE_ENV === 'development') {
  app.use(
    '/serverless',
    createProxyMiddleware({
      target: `http://localhost:${SERVERLESS_PORT}`,
      changeOrigin: true,
      pathRewrite: {
        '^/serverless': '',
      },
    })
  );
}

// Used to receive text messages from Twilio about the conversation
app.get('/text', (req, res) => {
  const from = req.query.From as string;
  const bodyMessage = req.query.Body as string;

  if (from && bodyMessage) {
    console.log('Received message:', bodyMessage);
    console.log('From:', from);
    externalMessage = {
      body: bodyMessage,
      from: from,
    };
    res.send('text received');
  } else {
    res.send('Invalid message received');
  }
});

app.ws('/conversation-relay', (ws: WebSocket) => {
  console.log('New Conversation Relay websocket established');
  let gptService: GptService | null = null;

  ws.on('message', async (data: string) => {
    try {
      const message = JSON.parse(data);
      console.log(
        `[Conversation Relay] Message received: ${JSON.stringify(
          message,
          null,
          4
        )}`
      );
      let gptResponse: GptReturnResponse;
      console.log(message.type);
      switch (message.type) {
        case 'info':
          console.debug(
            `[Conversation Relay] info: ${JSON.stringify(message, null, 4)}`
          );
          // A text message is received from the user
          if (externalMessage && gptService) {
            const message = JSON.parse(data);
            console.log('message in text', message);
            console.log('external_messages in ws', externalMessage);

            gptResponse = await gptService.generateResponse({
              role: 'user',
              prompt:
                'Received text message with content, upsert the customer mortgage with the appropriate values',
              externalMessage,
            });
            externalMessage = null;
            ws.send(JSON.stringify(gptResponse));
          }
          break;
        case 'prompt':
          console.info(
            `[Conversation Relay] Caller Message: ${message.voicePrompt}`
          );

          axios
            .post(
              COAST_WEBHOOK_URL,
              {
                sender: 'Customer',
                type: 'string',
                message: message.voicePrompt,
              },
              { headers: { 'Content-Type': 'application/json' } }
            )
            .catch((err) => console.log(err));

          if (gptService) {
            gptResponse = await gptService.generateResponse({
              role: 'user',
              prompt: message.voicePrompt,
            });

            console.info(
              `[Conversation Relay] Bot Response: ${JSON.stringify(
                gptResponse,
                null,
                4
              )}`
            );

            axios
              .post(
                COAST_WEBHOOK_URL,
                {
                  sender: 'Conversation Relay Assistant',
                  type: 'string',
                  message: gptResponse?.token ?? '',
                },
                { headers: { 'Content-Type': 'application/json' } }
              )
              .catch((err) => console.log(err));
            ws.send(JSON.stringify(gptResponse));
          }
          break;
        case 'interrupt':
          console.info(
            `[Conversation Relay] Interrupt: ${JSON.stringify(
              message,
              null,
              4
            )}`
          );

          axios
            .post(
              COAST_WEBHOOK_URL,
              {
                sender: 'interruption',
                type: 'string',
                message: 'Interrupted',
              },
              { headers: { 'Content-Type': 'application/json' } }
            )
            .catch((err) => console.log(err));

          break;
        case 'dtmf':
          console.debug(`[Conversation Relay] DTMF: ${message.digits?.digit}`);
          break;
        case 'setup':
          console.log('Initializing GptService with Context and Manifest');
          gptService = new GptService(promptContext, toolManifest);

          await gptService.setCallParameters({
            to: message.to,
            from: message.from,
            callSid: message.callSid,
          });

          gptResponse = await gptService.generateResponse({
            role: 'system',
            prompt:
              'Using the get-segment-profile tool, get the customer and greet them by name if possible.',
          });

          ws.send(JSON.stringify(gptResponse));
          break;
        default:
          console.log(
            `[Conversation Relay] Unknown message type: ${message.type}`
          );
      }
    } catch (error) {
      console.error('[Conversation Relay] Error in message handling:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
