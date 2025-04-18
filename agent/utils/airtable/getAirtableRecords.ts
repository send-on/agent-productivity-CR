import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

type GetAirtableRecordsParams = {
  tableName: string;
  queryField: 'loan_application_id' | 'phone' | 'email' | 'user_id';
  queryValue: string;
};

export async function getAirtableRecords({
  tableName,
  queryField,
  queryValue,
}: GetAirtableRecordsParams) {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Missing Airtable API key or base ID');
  }

  const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
    AIRTABLE_BASE_ID
  );

  try {
    const records = await base(tableName)
      .select({
        filterByFormula: `{${queryField}} = '${queryValue}'`,
      })
      .firstPage();

    if (!records.length) {
      console.warn(`No records found for ${queryField} = ${queryValue}`);
      return null;
    }

    return records;
  } catch (err) {
    console.error(
      'Airtable fetch error:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
