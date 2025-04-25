import dotenv from 'dotenv';
import { airtableCols as airtableColsTs } from '../utils/airtableCols.private';
import { getAirtableRecords as getAirtableRecordsTs } from '../utils/getAirtableRecords.private';
import { Types } from '../../../../typings';

type GeMortgageParams = {
  queryField: 'phone' | 'email';
  queryValue: string;
};

const Runtime = globalThis.Runtime as Types.TwilioRuntime;
let airtableCols: typeof airtableColsTs;
let getAirtableRecords: typeof getAirtableRecordsTs;

// For type checking and ability to use in both Twilio functions and the GPT service
if (typeof Runtime !== 'undefined') {
  ({ airtableCols } = require(Runtime.getAssets()[
    '/shared/utils/airtableCols.js'
  ].path) as {
    airtableCols: typeof airtableColsTs;
  });
  ({ getAirtableRecords } = require(Runtime.getAssets()[
    '/shared/utils/getAirtableRecords.js'
  ].path) as {
    getAirtableRecords: typeof getAirtableRecordsTs;
  });
} else {
  // fallback for local development
  airtableCols = require('../utils/airtableCols.private').airtableCols;
  getAirtableRecords =
    require('../utils/getAirtableRecords.private').getAirtableRecords;
}

/*
// Try to clean this up later
const Runtime = globalThis.Runtime as Types.TwilioRuntime | undefined;

const resolveAsset = <T>(path: string, fallback: T): T => {
  if (typeof Runtime !== 'undefined') {
    const mod = require(Runtime.getAssets()[path].path);
    return 'default' in mod ? mod.default : mod;
  }
  return fallback;
};

// Provide both typings and runtime compatibility
export const airtableCols: typeof airtableColsTs = resolveAsset(
  '/shared/utils/airtableCols.js',
  airtableColsTs
);
export const getAirtableRecords: typeof getAirtableRecordsTs = resolveAsset(
  '/shared/utils/getAirtableRecords.js',
  getAirtableRecordsTs
);
*/

dotenv.config();

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
