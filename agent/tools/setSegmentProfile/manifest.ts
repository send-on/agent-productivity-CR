export const manifest = {
  type: 'function',
  function: {
    name: 'set-segment-profile',
    description:
      'Sets up the segment customer profile by calling the identify route in Segments Api. Make sure you capture the email from the customer if it is not found in the Airtable record',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description:
            'The email of the customer we are about to identify in Segment',
        },
        phone: {
          type: 'string',
          description:
            'The phone of the customer we are about to identify in Segment',
        },
        first_name: {
          type: 'string',
          description:
            'The first name of the customer we are about to identify in Segment',
        },
        last_name: {
          type: 'string',
          description:
            'The last name of the customer we are about to identify in Segment',
        },
      },
      required: ['email', 'phone', 'first_name', 'last_name'],
    },
  },
};
