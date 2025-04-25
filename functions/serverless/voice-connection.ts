import twilio from 'twilio';
import { ServerlessCallback } from '@twilio-labs/serverless-runtime-types/types';
import dotenv from 'dotenv';
import { Types } from '../../typings';

// Try to clean this up later
// For type checking and ability to use in both Twilio functions and the GPT service
import { sendToCoast as sendToCoastTs } from '../assets/shared/utils/sendToCoast.private';
const { sendToCoast } = require(Runtime.getAssets()[
  '/shared/utils/sendToCoast.js'
].path) as {
  sendToCoast: typeof sendToCoastTs;
};

import { getSegmentProfile as getSegmentProfileTs } from '../assets/shared/tools/getSegmentProfile.private';
const { getSegmentProfile } = require(Runtime.getAssets()[
  '/shared/tools/getSegmentProfile.js'
].path) as {
  getSegmentProfile: typeof getSegmentProfileTs;
};

import { getMortgages as getMortgagesTs } from '../assets/shared/tools/getMortgages.private';
const { getMortgages } = require(Runtime.getAssets()[
  '/shared/tools/getMortgages.js'
].path) as {
  getMortgages: typeof getMortgagesTs;
};

dotenv.config();

type TwilioEventVoiceConnection = {
  To: string;
  From: string;
  callReason?: string;
  Direction: string;
};

exports.handler = async function (
  context: Types.TwilioContext,
  event: TwilioEventVoiceConnection,
  callback: ServerlessCallback
) {
  try {
    const { To, From, Direction, callReason } = event;

    const customerNumber = Direction.includes('outbound') ? To : From;
    // Get segment profile to try and have their name found for the agent

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling tool get-segment-profile on ${JSON.stringify(
        customerNumber
      )}`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    const segmentProfile = await getSegmentProfile(customerNumber);

    await sendToCoast({
      sender: 'system:customer_profile',
      type: 'JSON',
      message: { customerData: segmentProfile },
    }).catch((err) => console.error('Failed to send to Coast:', err));

    // Create TwiML response
    const response = new twilio.twiml.VoiceResponse();

    // process.env.NODE_ENV === 'development' is not working as expected.
    // Keying off ngrok URL to determine if we are in development - shouldn't be in twilio console env var list.
    // Can set this to false here if you want to test production endpoints locally.
    const isDevelopment = !!process.env.NGROK_URL;

    const agentHandoffRoute = 'agent-handoff';
    let actionUrl = isDevelopment
      ? `https://${process.env.NGROK_URL}/serverless/${agentHandoffRoute}`
      : `https://${context.DOMAIN_NAME}/${agentHandoffRoute}`;

    const conversationRelayRoute = 'conversation-relay';
    const relayUrl = isDevelopment
      ? `wss://${process.env.NGROK_URL}/${conversationRelayRoute}`
      : `wss://${context.LIVE_HOST_URL}/${conversationRelayRoute}`;

    console.log('actionUrl', actionUrl);
    console.log('relayUrl', relayUrl);

    // action endpoint will be executed when an 'end' action is dispatched to the ConversationRelay websocket
    // https://www.twilio.com/docs/voice/twiml/connect/conversationrelay#end-session-message
    // In this implementation, we use the action for transferring conversations to a human agent
    const connect = response.connect({
      action: actionUrl,
    });

    // Define parameters for the ConversationRelay
    const conversationRelay = connect.conversationRelay({
      voice: 'g6xIsTj2HwM6VR4iXFCw', // Twilio voice ID
      transcriptionProvider: 'deepgram', // Transcription provider
      ttsProvider: 'Elevenlabs', // Text-to-Speech provider
      dtmfDetection: true, // DTMF detection enabled
      interruptByDtmf: true, // Interrupt by DTMF enabled
      debug: true, // Debugging enabled
      url: relayUrl, // Your WebSocket URL
    });

    if (segmentProfile) {
      conversationRelay.parameter({
        name: 'segmentProfile',
        value: JSON.stringify(segmentProfile),
      });
    }

    if (callReason) {
      conversationRelay.parameter({
        name: 'callReason',
        value: callReason,
      });
    }

    const loans = await getMortgages({
      queryField: 'phone',
      queryValue: customerNumber,
    });

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling get-mortgages to fetch records for ${JSON.stringify(
        customerNumber
      )}...`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    await sendToCoast({
      sender: 'system:mortgage_records',
      type: 'JSON',
      message: loans,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    if (loans) {
      conversationRelay.parameter({
        name: 'loans',
        value: JSON.stringify(loans),
      });
    }

    console.log('RESP: ', response.toString());
    // Return the generated TwiML response
    callback(null, response.toString());
  } catch (error) {
    console.error('Error generating TwiML:', error);
    callback(error instanceof Error ? error : new Error(String(error)));
  }
};
