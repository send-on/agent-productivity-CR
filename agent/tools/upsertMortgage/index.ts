import dotenv from 'dotenv';
import { upsertAirtableRecord } from '../../utils';
dotenv.config();

type UpsertMortgageParams = {
  queryField: 'loan_application_id' | 'phone' | 'email' | 'user_id';
  queryValue: string;
  data: Record<string, string>;
};

export async function upsertMortgage({
  queryField,
  queryValue,
  data = {},
}: UpsertMortgageParams) {
  try {
    return await upsertAirtableRecord({
      tableName: 'mortgages',
      queryField,
      queryValue,
      data,
    });
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error in function:', err.message);
    } else {
      console.error('Error in function:', err);
    }
    return null;
  }
}
