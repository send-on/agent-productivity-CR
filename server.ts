import dotenv from 'dotenv';
import fs from 'fs';
import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import ExpressWs from 'express-ws';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocket } from 'ws';
import axios from 'axios';
import cors from 'cors';
import { toolManifest } from './assets/toolManifest';
import { GptService } from './services/GptService';
import { getCustomer } from './functions/tools/get-customer';

dotenv.config();

const promptContext: string = fs.readFileSync('./assets/context.md', 'utf-8');

const PORT: number = parseInt(process.env.PORT || '3001', 10);
const SERVERLESS_PORT = parseInt(process.env.SERVERLESS_PORT || '3000', 10);
const COAST_WEBHOOK_URL: string = process.env.COAST_WEBHOOK_URL || '';

let external_messages = '';
let messageWaiting = false;

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

app.get('/text', (req, res) => {
  messageWaiting = true;
  external_messages = 'Pull up my loans';
  console.log('external_messages in GET', external_messages);
  res.send('text recieved');
});

app.ws('/conversation-relay', (ws: WebSocket) => {
  console.log('New Conversation Relay websocket established');
  let gptService: GptService | null = null;

  ws.on('message', async (data: string) => {
    let gptResponse = '';
    if (messageWaiting) {
      console.log('external_messages in ws', external_messages);
      messageWaiting = !messageWaiting;
      // @ts-expect-error
      gptResponse = await gptService.generateResponse(
        'user',
        external_messages
      );
      ws.send(JSON.stringify(gptResponse));
    }

    try {
      const message = JSON.parse(data);
      console.log(
        `[Conversation Relay] Message received: ${JSON.stringify(
          message,
          null,
          4
        )}`
      );
      let gptResponse: any = '';

      switch (message.type) {
        case 'info':
          console.debug(
            `[Conversation Relay] info: ${JSON.stringify(message, null, 4)}`
          );
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
            gptResponse = await gptService.generateResponse(
              'user',
              message.voicePrompt,
              messageWaiting,
              // @ts-expect-error
              external_messages
            );

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
                  sender: 'Concversation Relay Assistant',
                  type: 'string',
                  message: gptResponse.token,
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
          console.log('TOOOOOL MANIFEST:', toolManifest);
          gptService = new GptService(promptContext, toolManifest);

          gptService.setCallParameters(
            message.to,
            message.from,
            message.callSid
          );

          console.log('Fetching customer data for:', message.from);
          const customerData = await getCustomer(message.from);
          const customerName = customerData?.first_name;
          console.log('*****customerData:', customerData);

          let greetingText = customerName
            ? `Greet the customer with name ${customerName} in a friendly manner. Do not constantly use their name, but drop it in occasionally. Tell them that you have to first verify their details before you can proceed to ensure confidentiality of the conversation.`
            : `Greet the customer in a friendly manner. Tell them that you have to first verify their details before you can proceed to ensure confidentiality of the conversation.`;

          // @ts-expect-error
          gptResponse = await gptService.generateResponse(
            'system',
            greetingText
          );
          console.info(
            `[Conversation Relay] Setup <<<<<<: ${JSON.stringify(
              gptResponse,
              null,
              4
            )}`
          );

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
