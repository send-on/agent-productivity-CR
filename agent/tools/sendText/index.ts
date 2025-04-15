import { Twilio } from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const from = process.env.TWILIO_CONVERSATION_NUMBER || '';

/**
 * Sends an SMS message using Twilio
 * @param to - The recipient's phone number (E.164 format, e.g., +15555555555)
 * @param message - The text content of the SMS
 */
export async function sendText(to: string, missing: []) {
  try {
    if (!accountSid || !authToken || !from) {
      throw new Error(
        'Twilio credentials are not set in environment variables.'
      );
    }

    const client = new Twilio(accountSid, authToken);

    console.log(missing);

    const result = await client.messages.create({
      body: `Hello! We are missing the following information from you: ${missing.join(
        ', '
      )}. Please provide this information at your earliest convenience. Thank you!`,
      from,
      to,
    });

    console.log(`✓ Message sent to ${to}: SID ${result.sid}`);
    return result;
  } catch (error) {
    console.error('✗ Failed to send message:', error);
    throw error;
  }
}
