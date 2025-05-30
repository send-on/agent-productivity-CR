# Conversation Relay

This is a node server that uses websockets to run a conversation relay with a caller. The open AI model will converse with the customer, and tell the node server to call "tools" (which are essentially just functions) as needed before continuing the conversation with the caller. This is so that various things can happen like looking up the customer's details, updating the customer's profile once the necessary information is gathered, or handing the caller off to a live agent at the right time.

## Prerequisites

- Node.js v18
- pnpm
- ngrok
- Segment Account
- OpenAI Account

## Local Development Configuration

1. Create a `.env` file in this directory by copying the variables in the `.env.example` file
2. Fill out the variables in your new `.env` file with all of your keys

### Personal Twilio Services Setup

If you plan to develop on your own Twilio account and not the primary one associated with this app (meaning your Twilio env keys point elsewhere), you will need to spin up the service in that targeted location.   
At the root of the package run `npm run deploy` which will add all your content to the targeted Twilio account. Afterwards do all the steps in Twilio Configuration below.  


### Twilio Configuration
1. Get a new Toll Free number for yourself and validate it following [this](https://wiki.hq.twilio.com/pages/viewpage.action?spaceKey=SALESENG&title=Employee+Guide+to+Registering+US+SMS+Toll+Free+and+A2P+10DLC+Senders).
2. Get a static ngrok url from [here](https://ngrok.com/blog-post/free-static-domains-ngrok-users) and add it to the `.env` file
3. Point the newly acquired phone number to the `voice-connection.ts` file by setting the following on the Voice Configuration:
   1. `A call comes in` to a `webhook`.
   2. `URL` to `https://<your-ngrok-domain>/serverless/voice-connection`. 
   3. `HTTP` to `HTTP GET`.   
   *We add the /serverless route to the voice connection because we are proxying the twilio serverless functions to the express app. in dev.*
4. Spin up the dev server by doing `npm run dev`, it will:
   1. Start the typescript hot reload.
   2. Start the Twilio serverless functions (default port 3000).
   3. Start the express server for the conversation relay (default port 3001).
5. Start forwarding via ngrok `ngrok http --domain <your-ngrok-domain> 3001`
6. You can start an outbound call by triggering the serverless function found at `functions/serverless/outbound-connection.ts`, just make a post request to this as instructed in the file (to simulate the agent calling you).
7. You can optionally open up `http://localhost:4040/inspect/http` to see any ngrok requests made.


### WebSocket Connection Flow

1. When a call is received, Twilio initiates a WebSocket connection to `wss://<your-ngrok-domain>/conversation-relay` via the `voice-connection` serverless function.
2. The server receives a 'setup' message containing call details:
   - Caller's phone number (`from`)
   - Called number (`to`)
   - Call SID
   - Other call metadata

3. The server then:
   - Stores the call parameters for the session
   - Makes a request to the `get-segment-profile` function with the caller's phone number
   - Receives customer details (including first name)
   - Uses this information to generate a personalized greeting
   - Initiates the instructions from context.md

4. The `get-segment-profile` function:
   - Receives the caller's phone number
   - Looks up customer information
   - Returns customer details for personalization

5. The `get-mortgages` function:
   - Receives the caller's phone number or email as the query field and value
   - Looks up customer information
   - Returns customer details for any loans found

## GPT Context Configuration

The server uses two key files to configure the GPT conversation context:

### Context / Instructions

Located in `agent/instructions/**/*`, this file defines:
- The AI assistant's persona
- Conversation style guidelines
- Response formatting rules
- Conversation instructions

Key sections to configure:
1. Objective - Define the AI's role and primary tasks
2. Style Guardrails - Set conversation tone and behavior rules
3. Response Guidelines - Specify formatting and delivery rules
4. Instructions - Detail specific process steps and when one of tools below should be used

This all then gets merged using the merge function found in `agent/utils/instructions/merge.ts`.

### Tools

Located in `agent/tools/tooFunctions.ts`, this file defines the functions used in the tools for the GPT service:
Located in `agent/tools/toolManifest.ts`, this file defines the json schema for tools set on the GPT service:


### Running the Server

1. Ensure you are in the conversation-relay folder and then install the dependencies

```bash
pnpm install
```

2. Start the local server:
```bash
pnpm dev
```

3. Open a new terminal window and expose the local server to the internet using ngrok:
```bash
ngrok http --domain <your-ngrok-domain> 3001

```

## Deployment
This site is currently hosted using heroku for the express app, ours is found [here](https://dashboard.heroku.com/apps/owl-homes-conversational-relay).   
While the serverless functions are on Twilio under the corresponding account sid.

### Heroku 
Heroku requires specific env variables to run as expected. These can be found in the .env.local file marked as such.
Once the server is hosted and running if you need to see the live logs, running `heroku logs --tail -a APP_NAME` will result in a live look. In this case we called ours `owl-homes-conversational-relay` for the app name. 