const Airtable = require('airtable');
// const axios = require('axios');
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

export async function lookupMortgage(identifier, value) {
  try {
    // Validate Airtable configuration
    console.log('AIRTABLE_API_KEY:', AIRTABLE_API_KEY);
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return (
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
    let queryField = identifier;
    let queryValue = value;
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
        maxRecords: 1,
      })
      .firstPage();

    if (!records || records.length === 0) {
      console.log(`No customer found for ${queryField}: ${queryValue}`);
      return (
        null,
        {
          status: 404,
          message: `No customer found for ${queryField}: ${queryValue}`,
        }
      );
    }
    let mortgageData = records.map((record) => record.fields);
    console.log('mortgageData', mortgageData);
    return (
      null,
      {
        status: 200,
        customer: records.map((record) => record.fields),
      }
    );
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return (
      null,
      {
        status: 500,
        message: 'An unexpected error occurred. Please try again later.',
      }
    );
  }
}

lookupMortgage('name', 'Srinivas Shipchandler');
