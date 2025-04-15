import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

type UpsertAirtableRecordParams = {
  tableName: string;
  queryField: 'loan_application_id' | 'phone' | 'email' | 'user_id';
  queryValue: string;
  data: Record<string, string>;
};

export async function upsertAirtableRecord({
  tableName,
  queryField,
  queryValue,
  data,
}: UpsertAirtableRecordParams) {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Missing Airtable API key or base ID');
  }

  const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
    AIRTABLE_BASE_ID
  );

  console.log(data);

  try {
    const records = await base(tableName)
      .select({
        filterByFormula: `{${queryField}} = '${queryValue}'`,
        maxRecords: 1,
      })
      .firstPage();

    const record = records[0] ?? null;

    if (record) {
      console.log(`Updating existing record for ${queryField} = ${queryValue}`);
      return base(tableName).update([{ id: record.id, fields: data }]);
    } else {
      console.log(
        `No record found — creating new record for ${queryField} = ${queryValue}`
      );
      return base(tableName).create([
        { fields: { [queryField]: queryValue, ...data } },
      ]);
    }
  } catch (err) {
    console.error(
      'Airtable upsert error:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
