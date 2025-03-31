# Conversation Relay

This is a node server that uses websockets to run a conversation relay with a caller. The open AI model will converse with the customer, and tell the node server to call "tools" (which are essentially just functions) as needed before continuing the conversation with the caller. This is so that various things can happen like looking up the customer's details, updating the customer's profile once the necessary information is gathered, or handing the caller off to a live agent at the right time.

## Prerequisites

- Node.js v18
- pnpm
- ngrok
- Segment Account
- OpenAI Account

## Local Environment Configuration

1. Create a `.env` file in this directory by copying the variables in the `.env.example` file
2. Fill out the variables in your new `.env` file with all of your keys

## Twilio Configuration

### TwiML Bin Setup

1. Create a new TwiML Bin in your Twilio console
2. Add the following TwiML code:
```xml
<Response>
   <Connect>
      <ConversationRelay 
         url="wss://<your-ngrok-domain>/conversation-relay" 
         voice="en-AU-Neural2-A" 
         transcriptionProvider="deepgram"
         ttsProvider="Elevenlabs"
         voice="g6xIsTj2HwM6VR4iXFCw"
         dtmfDetection="true" 
         interruptByDtmf="true" 
         debug="true"
      />
   </Connect>
</Response>
```
3. Configure your Twilio phone number to use this TwiML Bin for incoming voice calls

### WebSocket Connection Flow

1. When a call is received, Twilio initiates a WebSocket connection to `wss://<your-ngrok-domain>/conversation-relay`
2. The server receives a 'setup' message containing call details:
   - Caller's phone number (`from`)
   - Called number (`to`)
   - Call SID
   - Other call metadata

3. The server then:
   - Stores the call parameters for the session
   - Makes a request to the `get-customer` function with the caller's phone number
   - Receives customer details (including first name)
   - Uses this information to generate a personalized greeting
   - Initiates the instructions from context.md

4. The `get-customer` function:
   - Receives the caller's phone number
   - Looks up customer information
   - Returns customer details for personalization

## GPT Context Configuration

The server uses two key files to configure the GPT conversation context:

### context.md

Located in `/assets/context.md`, this file defines:
- The AI assistant's persona
- Conversation style guidelines
- Response formatting rules
- Conversation instructions

Key sections to configure:
1. Objective - Define the AI's role and primary tasks
2. Style Guardrails - Set conversation tone and behavior rules
3. Response Guidelines - Specify formatting and delivery rules
4. Instructions - Detail specific process steps and when one of tools below should be used

### toolManifest.json

Located in `assets/toolManifest.json`, this file defines the available tools for the GPT service:

1. `get-customer`
   - Retrieves customer details using caller's phone number
   - Required parameter: `from` (phone number)

2. `update-customer-profile`
   - Updates the customer's profile in Segment with properties that can be customized for your use case and gathered by the gpt
   - Required parameters: `userId`

3. `live-agent-handoff`
   - Transfers call to human agent
   - Required parameter: `callSid`

The server fetches both files during initialization to hydrate the GPT context and enable tool usage during conversations.

### Running the Server

1. Ensure you are in the conversation-relay folder and then install the depencencies

```bash
pnpm install
```

3. Start the local server:
```bash
pnpm dev
```

4. Open a new terminal window and expose the local server to the internet using ngrok:
```bash
ngrok http --domain <your-ngrok-domain> 3001
```