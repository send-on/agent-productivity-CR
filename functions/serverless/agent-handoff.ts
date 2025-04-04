import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { ServerlessCallback } from '@twilio-labs/serverless-runtime-types/types';
import { TwilioContext } from '../../typings';

type TwilioEventAgentHandoff = {
  AccountSid: string;
  CallSid: string;
  From: string;
  To: string;
  SessionId?: string;
  SessionStatus?: string;
  SessionDuration?: string;
  HandoffData?: string;
};

// Twilio Function signature for TypeScript
exports.handler = function (
  context: TwilioContext,
  event: TwilioEventAgentHandoff,
  callback: ServerlessCallback
) {
  const {
    AccountSid: accountSid,
    CallSid: callSid,
    From: from,
    To: to,
    SessionId: sessionId,
    SessionStatus: sessionStatus,
    SessionDuration: sessionDuration,
    HandoffData: handoffData,
  } = event;

  console.log('Raw HandoffData:', handoffData);
  console.log('Full Event:', JSON.stringify(event, null, 2));

  let parsedHandoffData: Record<string, unknown> = {};
  try {
    parsedHandoffData = handoffData ? JSON.parse(handoffData) : {};
  } catch (error) {
    console.error('Failed to parse the handoffData:', error);
    return callback(null, {
      status: 500,
      message: error,
    });
  }

  const taskAttributes = {
    accountSid,
    callSid,
    from,
    to,
    sessionId,
    sessionStatus,
    sessionDuration,
    handoffReason: parsedHandoffData.reason || 'No reason provided',
    reasonCode: parsedHandoffData.reasonCode || 'No reason code',
    conversationSummary:
      parsedHandoffData.conversationSummary || 'No conversation summary',
  };

  console.log('Enqueuing call with attributes:', taskAttributes);

  const twiml = new VoiceResponse();
  twiml
    .enqueue({
      workflowSid:
        process.env.TWILIO_WORKFLOW_SID || context.TWILIO_WORKFLOW_SID,
    })
    .task({ priority: 1000 }, JSON.stringify(taskAttributes));

  console.log('Generated TwiML:', twiml.toString());

  return callback(null, twiml);
};
