import twilio, { Twilio } from 'twilio';
import '@twilio-labs/serverless-runtime-types';
import { ServerlessCallback } from '@twilio-labs/serverless-runtime-types/types';
import { Types } from '../../typings';
import dotenv from 'dotenv';

dotenv.config();

/*
    To connect the caller to an outbound cal hit one of the following urls:
    On Twilio:
        https://${context.DOMAIN_NAME}/outbound-connection?to=+1123456789&from=+1123456788
    On ngrok:
        https://${process.env.NGROK_URL}/serverless/outbound-connection?to=+1123456789&from=+1123456788
*/
type TwilioEventOutboundConnection = {
  to: string;
  from: string;
  callReason?: string;
};

exports.handler = async function (
  context: Types.TwilioContext,
  event: TwilioEventOutboundConnection,
  callback: ServerlessCallback
) {
  const { to, from, callReason } = event;

  if (!to || !from) {
    return callback(null, {
      status: 400,
      message:
        'Missing the "to" or "from" call parameter. Provide the query params as so: ?to=+1123456789&from=+1123456788".',
    });
  }

  // process.env.NODE_ENV === 'development' is not working as expected.
  // Keying off ngrok URL to determine if we are in development - shouldn't be in twilio console env var list.
  // Can set this to false here if you want to test production endpoints locally.
  const isDevelopment = !!process.env.NGROK_URL;
  const voiceConnectionRoute = 'voice-connection';
  let url = isDevelopment
    ? `https://${process.env.NGROK_URL}/serverless/${voiceConnectionRoute}`
    : `https://${context.DOMAIN_NAME}/${voiceConnectionRoute}`;

  const client: Twilio = twilio(
    process.env.TWILIO_ACCOUNT_SID || context.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN || context.TWILIO_AUTH_TOKEN
  );

  if (callReason) {
    url = `${url}?callReason=${encodeURIComponent(callReason)}`;
  }

  console.log('Twilio URL:', url);

  try {
    const call = await client.calls.create({
      from,
      to,
      url,
      statusCallbackEvent: ['initiated', 'answered', 'ringing', 'completed'],
    });

    // Return success response
    return callback(null, {
      status: 200,
      message: 'Outbound call initiated successfully',
      messageId: call.sid,
    });
  } catch (error) {
    console.error('Error initiating outbound call:', error);
    callback(error instanceof Error ? error : new Error(String(error)));
  }
};
