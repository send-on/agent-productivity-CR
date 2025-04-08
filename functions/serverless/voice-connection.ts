import twilio from 'twilio';
import { ServerlessCallback } from '@twilio-labs/serverless-runtime-types/types';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { TwilioContext } from 'typings';

exports.handler = async function (
  context: TwilioContext,
  _event: Record<string, unknown>,
  callback: ServerlessCallback
) {
  try {
    // Create TwiML response
    const response = new twilio.twiml.VoiceResponse();

    // process.env.NODE_ENV === 'development' is not working as expected.
    // Keying off ngrok URL to determine if we are in development - shouldn't be in twilio console env var list.
    // Can set this to false here if you want to test production endpoints locally.
    const isDevelopment = !!process.env.NGROK_URL;

    const agentHandoff = 'agent-handoff';
    let actionUrl = isDevelopment
      ? `https://${process.env.NGROK_URL}/serverless/${agentHandoff}`
      : `https://${context.DOMAIN_NAME}/${agentHandoff}`;

    const conversationRelay = 'conversation-relay';
    const relayUrl = isDevelopment
      ? `wss://${process.env.NGROK_URL}/${conversationRelay}`
      : `wss://${context.LIVE_HOST_URL}/${conversationRelay}`;

    console.log('actionUrl', actionUrl);
    console.log('relayUrl', relayUrl);

    // action endpoint will be executed when an 'end' action is dispatched to the ConversationRelay websocket
    // https://www.twilio.com/docs/voice/twiml/connect/conversationrelay#end-session-message
    // In this implementation, we use the action for transferring conversations to a human agent
    const connect = response.connect({
      action: actionUrl,
    });

    // Define parameters for the ConversationRelay
    const conversationRelayParams: VoiceResponse.ConversationRelayAttributes = {
      url: relayUrl, // Your WebSocket URL
      voice: 'g6xIsTj2HwM6VR4iXFCw', // Twilio voice ID
      transcriptionProvider: 'deepgram', // Transcription provider
      ttsProvider: 'Elevenlabs', // Text-to-Speech provider
      dtmfDetection: true, // DTMF detection enabled
      interruptByDtmf: true, // Interrupt by DTMF enabled
      debug: true, // Debugging enabled
    };

    // Add the <ConversationRelay> element within <Connect>
    connect.conversationRelay(conversationRelayParams);

    // Return the generated TwiML response
    callback(null, response.toString());
  } catch (error) {
    console.error('Error generating TwiML:', error);
    callback(error instanceof Error ? error : new Error(String(error)));
  }
};
