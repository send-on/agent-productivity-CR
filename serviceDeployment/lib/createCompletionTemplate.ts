import twilio, { Twilio } from 'twilio';
import { updateEnvFile } from '../helpers/updateEnvFile';
import dotenv from 'dotenv';
dotenv.config();

const serviceName = process.env.SERVICE_NAME;

async function createCompletionTemplate(client: Twilio) {
  try {
    if (!serviceName) {
      throw new Error('SERVICE_NAME is not set in the environment variables.');
    }

    const templateServiceName = `${serviceName} Completion Template`;

    // Step 1: List existing templates
    const existingContents = await client.content.v1.contents.list({
      limit: 50,
    });
    let content = existingContents.find(
      (c) => c.friendlyName === templateServiceName
    );

    // Step 2: If found, reuse it
    if (content) {
      console.log(`Found existing content template: ${content.sid}`);
      return content.sid;
    }

    // Step 3: Otherwise, create it
    content = await client.content.v1.contents.create({
      friendly_name: templateServiceName,
      language: 'en',
      variables: { '1': '3453443' },
      types: {
        'twilio/card': {
          title: 'Application is ready to submit',
          subtitle: 'Loan application almost complete',
          media: ['https://static-assets-2391.twil.io/homebanner.jpg'],
          actions: [
            {
              type: 'URL',
              title: 'Application',
              url: 'https://owl-homes.com/application/summary?loan_application_id={{1}}',
            },
            {
              type: 'PHONE_NUMBER',
              title: 'Call Us',
              phone: '+18889815175',
            },
          ],
        },
        'twilio/text': {
          body: 'Congratulations, your loan application {{1}} for your new home is almost complete. https://owl-homes.com/application/summary?loan_application_id={{1}}',
        },
      },
    });

    console.log(`Created new content template: ${content.sid}`);

    // Save the assigned phone number to the .env file
    updateEnvFile('MESSAGE_COMPLETION_TEMPLATE', content.sid);

    return content.sid;
  } catch (error) {
    console.error('Error assigning phone number:', error);
    throw error;
  }
}

const client: Twilio = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

createCompletionTemplate(client);
