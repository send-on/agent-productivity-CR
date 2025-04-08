export const manifest = {
  type: 'function',
  function: {
    name: 'lookup-mortgage-with-phone',
    description:
      'Lookups up existing mortgage details for the customer phone number',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description:
            "The type of identifier to use for the lookup. Can be 'phone' or 'name'.",
        },
        value: {
          type: 'string',
          description:
            'The value of the identifier.  If type is a phone number then value is the phone number of the customer (caller)',
        },
      },
      required: ['type', 'value'],
    },
  },
};
