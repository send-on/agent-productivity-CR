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

    const agentHandoff = 'agent-handoff';
    const actionUrl = `https://${context.DOMAIN_NAME}/${agentHandoff}`;
    /*
    // Would need 2 ngork tunnels to test this locally
      ? `http://localhost:3000/${agentHandoff}`
      : `https://${context.DOMAIN_NAME}/${agentHandoff}`;
    */

    const connect = response.connect({
      // action endpoint will be executed when an 'end' action is dispatched to the ConversationRelay websocket
      // https://www.twilio.com/docs/voice/twiml/connect/conversationrelay#end-session-message
      // In this implementation, we use the action for transferring conversations to a human agent
      action: actionUrl,
    });

    const conversationRelay = 'conversation-relay';
    const relayUrl = `wss://${context.LIVE_HOST_URL}/${conversationRelay}`;
    /*
    // Would need 2 ngork tunnels to test this locally
      ? `wss://${process.env.WEBSOCKET_URL}/${conversationRelay}`
      : `https://${context.LIVE_HOST_URL}/${conversationRelay}`;
    */

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
