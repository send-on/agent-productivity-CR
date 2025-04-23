import dotenv from 'dotenv';
import { Types } from '../../../typings';
dotenv.config();

type resolveInitialCallInfoParams = {
  to: string;
  from: string;
  callSid: Types.InitialCallInfo['callSid'];
  direction: Types.InitialCallInfo['direction'];
  callReason?: Types.InitialCallInfo['callReason'];
};

export const resolveInitialCallInfo = ({
  to,
  from,
  callSid,
  direction,
  callReason,
}: resolveInitialCallInfoParams): Types.InitialCallInfo => {
  const initialCallInfo: Types.InitialCallInfo = {
    twilioNumber: direction.includes('outbound') ? from : to,
    customerNumber: direction.includes('outbound') ? to : from,
    callSid,
    direction,
    callReason: callReason || 'unknown',
  };

  return initialCallInfo;
};
