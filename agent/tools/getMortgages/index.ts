import dotenv from 'dotenv';
import { getAirtableRecords, airtableCols } from '../../utils';

dotenv.config();

type GeMortgageParams = {
  queryField: 'phone' | 'email';
  queryValue: string;
};

export async function getMortgages({
  queryField,
  queryValue,
}: GeMortgageParams) {
  console.log(arguments);
  try {
    const records = await getAirtableRecords({
      tableName: 'mortgages',
      queryField,
      queryValue,
    });

    if (records) {
      const extractedRecords = records.map((record) => {
        const fields = record.fields;
        // create new object with only the fields we want from airtableCols as the keys
        const extractedFields = airtableCols.reduce((acc, col) => {
          if (fields[col.name] !== undefined) {
            acc[col.name] = fields[col.name];
          }
          return acc;
        }, {} as Record<string, unknown>);

        // Add the has_completed_application field and loan_application_id
        extractedFields.has_completed_application =
          fields.has_completed_application;
        extractedFields.loan_application_id = fields.loan_application_id;
        return extractedFields;
      });

      console.log('Mortgage records:', extractedRecords);
      return extractedRecords;
    }

    return null;
  } catch (err) {
    console.error(
      'Error fetching Mortgage records:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
