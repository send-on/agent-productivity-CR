export const manifest = {
  type: 'function',
  function: {
    name: 'get-segment-profile',
    description:
      "Retrieves customer details based on the call 'from' information",
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'The phone number of the customer (caller)',
        },
      },
      required: ['from'],
    },
  },
};
