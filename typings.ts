import { Context as BaseTwilioContext } from '@twilio-labs/serverless-runtime-types/types';

export interface TwilioContext extends BaseTwilioContext {
  [key: string]: any;
}
