require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL;

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize express-ws
ExpressWs(app);
// Enable CORS
app.use(cors());

// Import the GptService class
const { GptService } = require('./responseServer/GptService');
const { getCustomer } = require('./agent/tools/get-customer');

// Import static context prompt and tools
const promptContext = fs.readFileSync('./assets/context.md', 'utf-8');
const toolManifest = require('./agent/tools/toolManifest');

let external_messages = '';
let messageWaiting = false;
// Setup WebSocket connection endpoint

app.get('/text', (req, res) => {
  messageWaiting = true;
  external_messages = 'Pull up my loans';
  console.log('external_messages in GET', external_messages);
  res.send('text recieved');
});

app.ws('/conversation-relay', (ws) => {
  console.log('New Conversation Relay websocket established');
  let gptService = null;

  // Handle incoming messages
  ws.on('message', async (data) => {
    let gptResponse = '';
    if (messageWaiting) {
      console.log('external_messages in ws', external_messages);
      messageWaiting = !messageWaiting;
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
      switch (message.type) {
        case 'info':
          console.debug(
            `[Conversation Relay] info: ${JSON.stringify(message, null, 4)}`
          );
          break;
        case 'prompt':
          // OpenAI Model
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
              { 'Content-Type': 'application/json' }
            )
            .catch((err) => console.log(err));

          gptResponse = await gptService.generateResponse(
            'user',
            message.voicePrompt,
            messageWaiting,
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
              { 'Content-Type': 'application/json' }
            )
            .catch((err) => console.log(err));

          // Send the response back to the WebSocket client
          ws.send(JSON.stringify(gptResponse));
          break;
        case 'interrupt':
          // Handle interrupt message
          console.info(
            `[Conversation Relay] Interrupt ...... : ${JSON.stringify(
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
              { 'Content-Type': 'application/json' }
            )
            .catch((err) => console.log(err));

          break;
        case 'dtmf':
          // Handle DTMF digits. We are just logging them out for now.
          console.debug(`[Conversation Relay] DTMF: ${message.digits.digit}`);
          break;
        case 'setup':
          /**
                     * Handle setup message. Just logging sessionId out for now.
                     * This is the object received from Twilio:
                     * {
                            "type": "setup",
                            "sessionId": "VXxxxx",
                            "callSid": "CAxxxx",
                            "parentCallSid": "",
                            "from": "+614nnnn",
                            "to": "+612nnnn",
                            "forwardedFrom": "+612nnnnn",
                            "callerName": "",
                            "direction": "inbound",
                            "callType": "PSTN",
                            "callStatus": "RINGING",
                            "accountSid": "ACxxxxxx",
                            "applicationSid": null
                        }
                     */
          // console.debug(`[Conversation Relay] Setup message received: ${JSON.stringify(message, null, 4)}`);
          // Log out the to and from phone numbers
          //LOG console.log(`4) [Conversation Relay] Setup message. Call from: ${message.from} to: ${message.to} with call SID: ${message.callSid}`);

          // Initialize GptService with context and manifest
          // const { promptContext, toolManifest } = await fetchContextAndManifest();
          console.log('calling', JSON.stringify(toolManifest));
          gptService = new GptService(promptContext, toolManifest);
          console.log('GptService initialized with Context and Manifest');

          // extract the "from" value and pass it to gptService
          gptService.setCallParameters(
            message.to,
            message.from,
            message.callSid
          );

          // Create a greeting message using the person's name
          console.log('get customer data in setup', message.from);
          const customerData = await getCustomer(message.from);
          const customerName = customerData?.firstName;
          let greetingText = '';
          if (customerData) {
            greetingText = `Greet the customer with name ${customerName} in a friendly manner. Do not constantly use their name, but drop it in occasionally. Tell them that you have to first verify their details before you can proceed to ensure confidentiality of the conversation.`;
          } else {
            greetingText = `Greet the customer in a friendly manner. Tell them that you have to first verify their details before you can proceed to ensure confidentiality of the conversation.`;
          }
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
          // Send the response back to the WebSocket client
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

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

////////// SERVER BASICS //////////

// Basic HTTP endpoint
app.get('/', (req, res) => {
  res.send('WebSocket Server Running');
});

// Start the server
app
  .listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  })
  .on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error('Failed to start server:', error);
    }
    process.exit(1);
  });
