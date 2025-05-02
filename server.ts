import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import ExpressWs from 'express-ws';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocket } from 'ws';
import axios from 'axios';
import cors from 'cors';
import { toolManifest } from './agent/tools/toolManifest';
import { GptService } from './responseServer/GptService';
import { identifyMissingCols, resolveInitialCallInfo } from './agent/utils';
import { Types } from './typings';
import { mergeInstructions, sendToCoast } from './agent/utils';

dotenv.config();

const promptContext = mergeInstructions('./agent/instructionsv2');

const PORT: number = parseInt(process.env.PORT || '3001', 10);
const SERVERLESS_PORT = parseInt(process.env.SERVERLESS_PORT || '3000', 10);

const gptSessions = new Map<string, GptService>();
const phoneToCallSid = new Map<string, string>();
const wsMap = new Map<string, WebSocket>();

const { app } = ExpressWs(express());
expressWs(app);

if (process.env.NODE_ENV === 'development') {
  console.log('Proxying serverless functions');
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

app.use(cors());
app.use(express.urlencoded({ extended: true })).use(express.json());

app.get('/', (_req: Request, res: Response): void => {
  res.send('WebSocket Server Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/text', async (req, res) => {
  const from = req.query.From as string;
  const bodyMessage = req.query.Body as string;

  if (from && bodyMessage) {
    console.log('Received message:', bodyMessage);
    console.log('From:', from);

    console.log('phoneToCallSid:', phoneToCallSid);
    const callSid = phoneToCallSid.get(from);
    if (!callSid) {
      console.warn('No active GPT session found for phone number:', from);
      res.send('No matching call session found');
      return;
    }

    const gptService = gptSessions.get(callSid);
    if (!gptService) {
      console.warn('No GPT service found for callSid:', callSid);
      res.send('No GPT service found');
      return;
    }

    const prompt = gptService.callerContext.validation.isRequired
      ? 'Received text message for user authentication'
      : 'Received text message with content, upsert the customer mortgage with the appropriate values';

    const gptResponse = await gptService.generateResponse({
      role: 'user',
      prompt,
      externalMessage: {
        body: bodyMessage,
        from: from,
      },
    });

    const ws = wsMap.get(callSid);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(gptResponse));
    }

    res.send('Text processed');
  } else {
    res.send('Invalid message received');
  }
});

app.ws('/conversation-relay', (ws: WebSocket) => {
  console.log('New Conversation Relay websocket established');
  let gptService: GptService | null = null;
  let currentCallSid: string | null = null;

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

      let gptResponse: Types.GptReturnResponse;

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

          if (gptService) {
            await sendToCoast({
              sender: 'Customer',
              type: 'string',
              message: message.voicePrompt,
              phoneNumber: gptService.customerNumber,
            }).catch((err) => console.error('Failed to send to Coast:', err));

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
            ws.send(JSON.stringify(gptResponse));
          }
          break;
        case 'interrupt':
          gptService?.abort();

          console.info(
            `[Conversation Relay] Interrupt: ${JSON.stringify(
              message,
              null,
              4
            )}`
          );

          if (gptService) {
            await sendToCoast({
              sender: 'interruption',
              type: 'string',
              message: 'Interrupted',
              phoneNumber: gptService?.customerNumber,
            }).catch((err) => console.error('Failed to send to Coast:', err));
          }

          break;
        case 'dtmf':
          console.debug(`[Conversation Relay] DTMF: ${message.digits?.digit}`);
          break;
        case 'setup': {
          const { to, from, callSid, direction, customParameters } = message;

          //Prevent generating GPT service if it's a self-call (loop)
          if (from === to) {
            console.warn(
              `[Conversation Relay] Skipping setup for self-call (from === to): ${from}`
            );
            // Clean up only this WebSocket connection if it's a self-call
            ws.close(1000, 'Self-call detected, closing connection');
            return;
          }

          const segmentProfile =
            customParameters['segmentProfile'] ?? 'unknown';
          let loans = customParameters['loans'] ?? 'unknown';

          const initialCallInfo = resolveInitialCallInfo({
            to,
            from,
            callSid,
            direction,
            callReason: customParameters['callReason'],
          });

          gptService = new GptService({
            promptContext,
            toolManifest,
            initialCallInfo,
          });

          // if (initialCallInfo.direction.includes('outbound')) {
          //   gptService.callerContext.validation.isRequired = true;
          // }

          await gptService.notifyInitialCallParams();

          if (loans !== 'unknown') {
            loans = JSON.parse(loans);
            loans = loans.map((loan: any) => identifyMissingCols(loan));
          }

          let prompt = `use the ### Instructions to guide the call.
          The call direction is ${
            initialCallInfo.direction
          } call with the customer.
          The call reference is ${initialCallInfo.callReason}.
          The caller's segment profile is ${JSON.stringify(segmentProfile)}.
          The customer has the following mortgage loan applications: ${JSON.stringify(
            loans
          )}`;

          gptResponse = await gptService.generateResponse({
            role: 'system',
            prompt,
          });

          currentCallSid = callSid;
          gptSessions.set(callSid, gptService);
          phoneToCallSid.set(gptService.customerNumber, callSid);
          wsMap.set(callSid, ws);

          ws.send(JSON.stringify(gptResponse));
          break;
        }
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
    if (currentCallSid) {
      gptSessions.delete(currentCallSid);
      wsMap.delete(currentCallSid);
      for (const [phone, sid] of phoneToCallSid.entries()) {
        if (sid === currentCallSid) {
          phoneToCallSid.delete(phone);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
