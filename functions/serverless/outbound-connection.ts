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
};

exports.handler = async function (
  context: Types.TwilioContext,
  event: TwilioEventOutboundConnection,
  callback: ServerlessCallback
) {
  const url =
    'https://handler.twilio.com/twiml/EH71de11425970236bf7c4d850fb46f82c';
  const client: Twilio = twilio(
    process.env.TWILIO_ACCOUNT_SID || context.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN || context.TWILIO_AUTH_TOKEN
  );

  const { to, from } = event;

  if (!to || !from) {
    return callback(null, {
      status: 400,
      message:
        'Missing the "to" or "from" call parameter. Provide the query params as so: ?to=+1123456789&from=+1123456788".',
    });
  }

  try {
    const call = await client.calls.create({
      from: event.from,
      to: event.to,
      url,
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
