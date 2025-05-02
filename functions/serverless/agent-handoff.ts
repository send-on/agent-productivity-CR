import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { ServerlessCallback } from '@twilio-labs/serverless-runtime-types/types';
import { Types } from '../../typings';

type TwilioEventAgentHandoff = {
  AccountSid: string;
  CallSid: string;
  From: string;
  To: string;
  HandoffData?: string;
  Direction: string;
  SessionId?: string;
  SessionStatus?: string;
  SessionDuration?: string;
};

// Twilio Function signature for TypeScript
exports.handler = function (
  context: Types.TwilioContext,
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
    Direction: direction,
  } = event;

  console.log('Raw HandoffData:', handoffData);
  console.log('Full Event:', JSON.stringify(event, null, 2));

  const customerNumber = direction.includes('outbound') ? to : from;
  const agentNumber = direction.includes('outbound') ? from : to;

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
    from: agentNumber,
    to: customerNumber,
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
