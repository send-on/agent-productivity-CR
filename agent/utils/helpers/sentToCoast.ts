import axios from 'axios';
import { Types } from '../../../typings';

const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL || '';

export const sendToCoast = async ({
  sender,
  type,
  message,
}: Types.SendToCoastParams) => {
  return axios.post(
    COAST_WEBHOOK_URL,
    { sender, type, message },
    { headers: { 'Content-Type': 'application/json' } }
  );
};
