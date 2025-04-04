import Airtable from 'airtable';
// const axios = require('axios');
import dotenv from 'dotenv';
dotenv.config();
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// const AIRTABLE_API_KEY = 'patJhmdZ59HComv8H.fb359bb34db44f0c9d013720ccd47468fa5ee74eaa2cec8a30f48e8319f59048';
// const AIRTABLE_BASE_ID = 'appTcHrCxmXTiOqcD';

export async function lookupMortgageWithPhone(type, value) {
  try {
    // Validate Airtable configuration
    console.log('AIRTABLE_API_KEY:', AIRTABLE_API_KEY);
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return (
        // @ts-expect-error
        null,
        {
          status: 500,
          message:
            'Airtable configuration error. Please check environment variables.',
        }
      );
    }

    // Airtable setup
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
      AIRTABLE_BASE_ID
    );

    // Extract and validate the x-identity header
    // const identityHeader = event.request.headers['x-identity'];
    // if (!identityHeader) {
    //   return (null, {
    //     status: 400,
    //     message:
    //       'Missing x-identity header. Provide email or phone in the format: "email:<email>" or "phone:<phone>".',
    //   });
    // }

    // Parse the identity header
    let queryField = type;
    let queryValue = value;
    console.log('queryField:', queryField);
    console.log('queryValue:', queryValue);
    // console.log('phone:', phone);

    // if (identityHeader.startsWith('user_id:')) {
    //   const userIdValue = identityHeader.replace(/^user_id:/, '').trim();
    //   queryField = userIdValue.includes('@') ? 'email' : 'phone';
    //   queryValue = userIdValue;
    // } else if (identityHeader.startsWith('email:')) {
    //   queryField = 'email';
    //   queryValue = identityHeader.replace(/^email:/, '').trim();
    // } else if (identityHeader.startsWith('phone:')) {
    //   queryField = 'phone';
    //   queryValue = identityHeader.replace(/^phone:/, '').trim();
    // } else if (identityHeader.startsWith('whatsapp:')) {
    //   queryField = 'phone';
    //   queryValue = identityHeader.replace(/^whatsapp:/, '').trim();
    // } // Cases where we are using the simulator and it doesn't have the prefix
    // else if (identityHeader.includes('@')) {
    //   queryField = 'email';
    //   queryValue = identityHeader.trim();
    // } else if (identityHeader.startsWith('+')) {
    //   queryField = 'phone';
    //   queryValue = identityHeader.trim();
    // } else {
    //   return (null, {
    //     status: 400,
    //     message:
    //       'Invalid x-identity format. Use "email:<email>", "user_id:<email or phone>" or "phone:<phone>".',
    //   });
    // }

    console.log(`Querying customers for ${queryField}: ${queryValue}`);

    // Query Airtable
    const records = await base('mortgages')
      .select({
        filterByFormula: `{${queryField}} = '${queryValue}'`,
        maxRecords: 5,
      })
      .firstPage();

    if (!records || records.length === 0) {
      console.log(`No customer found for ${queryField}: ${queryValue}`);
      return (
        // @ts-expect-error
        null,
        {
          status: 404,
          message: `No customer found for ${queryField}: ${queryValue}`,
        }
      );
    }
    let mortgageRecords = records.map((record) => record.fields);

    return mortgageRecords;
  } catch (err) {
    if (err instanceof Error) {
      console.error('Unexpected error:', err.message);
    } else {
      console.error('Unexpected error:', err);
    }
    return (
      // @ts-expect-error
      null,
      {
        status: 500,
        message: 'An unexpected error occurred. Please try again later.',
      }
    );
  }
}
