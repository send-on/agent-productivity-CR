import twilio, { Twilio } from 'twilio';
import { updateEnvFile } from '../helpers/updateEnvFile';
import dotenv from 'dotenv';
dotenv.config();

const serviceName = process.env.SERVICE_NAME;
const conversationNumber = process.env.TWILIO_CONVERSATION_NUMBER;

// MIGHT NEED TO MAKE A NEW NUMBER AS IT SEEMS TO BLOCK THE TEXTS GOING TO THE CONVERSATION NUMBER
export async function createMessagingService(client: Twilio) {
  try {
    if (!serviceName || !conversationNumber) {
      throw new Error(
        'SERVICE_NAME or TWILIO_CONVERSATION_NUMBER is not set in the environment variables.'
      );
    }
    const messagingServiceName = `${serviceName} Messaging Service`;
    // Step 1: Check if a Messaging Service already exists with the same name
    const services = await client.messaging.v1.services.list({ limit: 50 });

    let messagingService = services.find(
      (service) => service.friendlyName === messagingServiceName
    );

    // Step 2: Create a new Messaging Service using the v1 namespace
    if (!messagingService) {
      messagingService = await client.messaging.v1.services.create({
        friendlyName: messagingServiceName,
      });
      console.log(`New messaging service created: ${messagingService.sid}`);
    } else {
      console.log(
        `Existing messaging service found: ${messagingService.sid} aka ${messagingService.friendlyName}`
      );
    }
    if (messagingService) {
      // Save the assigned messaging to the .env file
      updateEnvFile('TWILIO_MESSAGING_SERVICE', messagingService.sid);
    }

    // Step 3: Attach conversation number to sender pool (if not already added)
    const phoneNumbers = await client.messaging.v1
      .services(messagingService.sid)
      .phoneNumbers.list();

    const isNumberAttached = phoneNumbers.some(
      (pn) => pn.phoneNumber === conversationNumber
    );

    if (!isNumberAttached) {
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: conversationNumber,
      });

      if (incomingPhoneNumbers.length === 0) {
        throw new Error(
          `Phone number ${conversationNumber} not found in your Twilio account.`
        );
      }

      await client.messaging.v1
        .services(messagingService.sid)
        .phoneNumbers.create({
          phoneNumberSid: incomingPhoneNumbers[0].sid,
        });

      console.log(
        `Attached phone number ${conversationNumber} to messaging service`
      );
    }

    // Step 4: Attach RCS to sender pool manually.
    console.warn(`RCS is not yet available in the API documentation. 
        It's also only enabled by direct request from Twilio,
        Therefore, it is suggested to use the Twilio Console to create the RCS sender and add to this service sender pool manually`);
  } catch (error) {
    console.error('Error assigning phone number:', error);
    throw error;
  }
}
const client: Twilio = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

createMessagingService(client);

/*
export async function createMessagingServices(client: Twilio) {
  try {
    // Step 1: Check if a Messaging Service already exists with the same name
    const services = await client.messaging.services.list({ limit: 50 });
    let messagingService = services.find(
      (service) => service.friendlyName === serviceName
    );

    if (messagingService) {
      console.log(`Existing messaging service found: ${messagingService.sid}`);
    } else {
      // Step 2: Create a new Messaging Service
      messagingService = await client.messaging.services.create({
        friendlyName: serviceName,
      });
      console.log(`New messaging service created: ${messagingService.sid}`);
    }

    // Step 3: Attach conversation number to sender pool (if not already added)
    const phoneNumbers = await client.messaging
      .services(messagingService.sid)
      .phoneNumbers.list();

    const isNumberAttached = phoneNumbers.some(
      (pn) => pn.phoneNumber === conversationNumber
    );

    if (!isNumberAttached) {
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: conversationNumber,
      });
      if (incomingPhoneNumbers.length === 0) {
        throw new Error(
          `Phone number ${conversationNumber} not found in your Twilio account.`
        );
      }

      await client.messaging
        .services(messagingService.sid)
        .phoneNumbers.create({ phoneNumberSid: incomingPhoneNumbers[0].sid });

      console.log(
        `Attached phone number ${conversationNumber} to messaging service`
      );
    }

    // Step 4: Attach or reuse RCS sender
    const existingRcsSenders = await client.messaging.rcsSenders.list({
      limit: 20,
    });

    const usableRcsSenders = existingRcsSenders.filter((sender) => {
      const isAttachedToAnotherService =
        sender.messagingServiceSid &&
        sender.messagingServiceSid !== messagingService.sid;
      const supportsRcs = sender.capabilities?.includes('rcs');
      return !isAttachedToAnotherService && supportsRcs;
    });

    let rcsSender = existingRcsSenders.find(
      (sender) => sender.messagingServiceSid === messagingService.sid
    );

    if (!rcsSender) {
      if (usableRcsSenders.length > 0) {
        rcsSender = usableRcsSenders[0];
        console.log(`Reusing eligible RCS sender: ${rcsSender.sid}`);
      } else {
        // You need to have a verified RCS Sender ID already
        rcsSender = await client.messaging.rcsSenders.create({
          rcsSenderId: 'your-approved-rcs-id', // << Replace with your actual approved ID
          capabilities: ['sms', 'rcs'],
        });
        console.log(`Created new RCS sender: ${rcsSender.sid}`);
      }

      // Attach to messaging service
      await client.messaging
        .services(messagingService.sid)
        .rcsSenders.create({ rcsSenderSid: rcsSender.sid });

      console.log(`Attached RCS sender to service: ${rcsSender.sid}`);
    } else {
      console.log(
        `RCS sender already attached to this service: ${rcsSender.sid}`
      );
    }

    updateEnvFile('MESSAGING_SERVICE_SID', messagingService.sid);
    updateEnvFile('TWILIO_RCS_SENDER_SID', rcsSender.sid);

    console.log('Messaging service setup complete!');
    return messagingService;
  } catch (error) {
    console.error('Error creating messaging service:', error);
    throw error;
  }
}

*/
