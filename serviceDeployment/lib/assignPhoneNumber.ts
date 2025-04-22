import { Twilio } from 'twilio';
import { updateEnvFile } from '../helpers/updateEnvFile';
import dotenv from 'dotenv';
dotenv.config();

export async function assignPhoneNumber(client: Twilio, domain?: string) {
  const functionsDomain = domain ?? process.env.FUNCTIONS_DOMAIN;
  let conversationNumber = process.env.TWILIO_CONVERSATION_NUMBER;

  try {
    if (!functionsDomain) {
      throw new Error(
        'FUNCTIONS_DOMAIN is not set in the environment variables.'
      );
    }

    // Check if we need to purchase a new number or use the existing one
    if (!conversationNumber) {
      console.log(
        'No TWILIO_CONVERSATION_NUMBER found. Searching for toll-free number...'
      );

      // Get available toll-free numbers and purchase one if available
      const availableNumbers = await client
        .availablePhoneNumbers('US')
        .tollFree.list({ limit: 1 });
      if (!availableNumbers.length)
        throw new Error('No toll-free numbers available.');

      const newNumber = availableNumbers[0].phoneNumber;
      console.log(`Purchasing toll-free number: ${newNumber}`);

      const purchased = await client.incomingPhoneNumbers.create({
        phoneNumber: newNumber,
        voiceUrl: `https://${functionsDomain}/voice-connection`,
        voiceMethod: 'GET',
      });

      console.log(
        ' Successfully purchased number and configured:',
        purchased.phoneNumber
      );
      conversationNumber = purchased.phoneNumber;
    } else {
      console.log(`Using existing number: ${conversationNumber}`);

      // Ensure the number exists in Twilio account
      const incomingNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: conversationNumber,
      });
      if (!incomingNumbers.length)
        throw new Error(
          `Could not find configured number ${conversationNumber} in your Twilio account.`
        );

      // Update the existing number's voice URL and method
      const numberSid = incomingNumbers[0].sid;
      await client.incomingPhoneNumbers(numberSid).update({
        voiceUrl: `https://${functionsDomain}/voice-connection`,
        voiceMethod: 'GET',
      });

      console.log(
        `Successfully updated ${conversationNumber} to use voiceUrl ${functionsDomain}`
      );
    }

    // Save the assigned phone number to the .env file
    updateEnvFile('TWILIO_CONVERSATION_NUMBER', conversationNumber);
  } catch (error) {
    console.error('Error assigning phone number:', error);
    throw error;
  }
}
