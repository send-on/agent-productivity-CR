export const manifest = {
  type: 'function',
  function: {
    name: 'upsert-mortgage',
    description:
      'Upserts mortgage details into database and is used when customer provides new information about their loan application',
    parameters: {
      type: 'object',
      properties: {
        loan_application_id: {
          type: 'string',
          description: 'The loan application id that is incomplete',
        },
        data: {
          type: 'object',
          description:
            'Object containing the mortgage data to be upserted where the key is the column name in the table and the value is the value to be upserted.',
        },
      },
      required: ['loan_application_id', 'data'],
    },
  },
};
