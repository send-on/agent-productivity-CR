import dotenv from 'dotenv';
import { Types } from '../../../typings';
dotenv.config();

const twilioNumberLoans = process.env.TWILIO_CONVERSATION_NUMBER;

const twilioNumbers = [twilioNumberLoans];

type resolveInitialCallInfoParams = {
  to: string;
  from: string;
  callSid: Types.InitialCallInfo['callSid'];
};

export const resolveInitialCallInfo = ({
  to,
  from,
  callSid,
}: resolveInitialCallInfoParams): Types.InitialCallInfo => {
  const initialCallInfo: Types.InitialCallInfo = {
    twilioNumber: '',
    customerNumber: '',
    callSid,
    direction: 'unknown',
    inReference: 'unknown',
  };

  // A call was made by performing a call function on the twilio side.
  if (twilioNumbers.includes(from)) {
    initialCallInfo.direction = 'outbound';
    initialCallInfo.twilioNumber = from;
    initialCallInfo.customerNumber = to;
  }
  // A call was made by the customer.
  else {
    initialCallInfo.direction = 'inbound';
    initialCallInfo.twilioNumber = to;
    initialCallInfo.customerNumber = from;
  }

  // This can be used to determine the type of call based on the number
  // Example would be a directory of numbers that are assigned to different things -
  // such as loans, or banking so the Agent will know what the call is about.
  switch (initialCallInfo.twilioNumber) {
    case twilioNumberLoans:
      initialCallInfo.inReference = 'loan';
      break;
    default:
      initialCallInfo.inReference = 'unknown';
      break;
  }

  return initialCallInfo;
};
