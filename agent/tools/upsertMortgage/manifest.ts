import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'upsert-mortgage',
    description: `Upserts mortgage details into database and is used when customer provides new information about their loan application. 
      ALWAYS Make sure to pass the data object to the function otherwise it wont know what to update!
      Try to use the loan_application_id as the queryField and queryValue if you have it.`,
    parameters: {
      type: 'object',
      properties: {
        queryField: {
          type: 'string',
          description:
            'The field to query the database with. Can be loan_application_id, phone, email or user_id. If you have the loan_application_id use that.',
        },
        queryValue: {
          type: 'string',
          description:
            'The value to query the database with. This is the value of the field you are querying with. If you have the loan_application_id use that',
        },
        data: {
          type: 'object',
          description:
            'Object containing the mortgage data to be upserted where the key is the column name in the table and the value is the value to be upserted. It is required to pass this object otherwise it wont know what to update!',
        },
      },
      required: ['queryField', 'queryValue', 'data'],
    },
  },
};
