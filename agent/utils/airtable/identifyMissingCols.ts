import { airtableCols } from './airtableCols';

export function identifyMissingCols(airtableRecord: Record<string, unknown>) {
  const normalizedFields: Record<string, unknown> = { ...airtableRecord };

  // Add any missing fields from airtableCols
  airtableCols.forEach((col) => {
    if (!normalizedFields.hasOwnProperty(col.name)) {
      normalizedFields[col.name] = null;
    }
  });

  console.log('Normalized fields:', normalizedFields);
  return normalizedFields;
}
