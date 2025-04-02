const Airtable = require('airtable');
// const axios = require('axios');
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;


async function upsertMortgage(loan_application_id, data) {
  try {
    console.log('loan_application_id', loan_application_id)
    console.log('data', data);
    // Validate required configuration
    if (
      !AIRTABLE_API_KEY ||
      !AIRTABLE_BASE_ID 
    ) {
      throw new Error('Missing required configuration');
    }



    // Parse the identity header
    let queryField = 'loan_application_id';
    let queryValue = loan_application_id;

    console.log(`Querying customers for ${queryField}: ${queryValue}`);

    // Airtable setup
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
      AIRTABLE_BASE_ID
    );

    // Query Airtable
    const records = await base('mortgages')
      .select({
        filterByFormula: `{${queryField}} = '${queryValue}'`,
        // fields: airtableConfig.columnNames.filter(
        //   (field) => !airtableConfig.ignoreList.includes(field)
        // ),
      })

      .firstPage();

    const record = records.find(
      (r) => r.fields.has_completed_application === 'false'
    );

    console.log('Airtable records:', records);
    console.log('Airtable record:', record);

    if (!record) {
      return callback(null, { error: 'User record not found' });
    }

    // Extract valid fields (must be in columnNames and NOT in ignoreList)
    const validFields = Object.keys(data)
      // .filter(
      //   (key) =>
      //     airtableConfig.columnNames.includes(key) &&
      //     !airtableConfig.ignoreList.includes(key)
      // )
      .reduce(
        (acc, key) => {
          acc[key] = data[key];
          return acc;
        },
        {}
      );

    if (Object.keys(validFields).length > 0) {
      return await base('mortgages').update([{ id: record.id, fields: validFields }]);
    }

    // return (null, { message: 'Updated missing fields', data });
  } catch (err) {
    console.error('Error in function:', (err).message);
  }
};

module.exports = { upsertMortgage };