export const manifest = {
  type: 'function',
  function: {
    name: 'update-customer-profile',
    description: 'Updates the segment customer profile with new traits',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The userId of the customer',
        },
        home_price: {
          type: 'string',
          description: 'The price of the home',
        },
        home_type: {
          type: 'string',
          description: 'The type of home of the customer is looking to buy',
        },
        home_use: {
          type: 'string',
          description:
            'The intended use of the home - rental, primary_residence or vacation home',
        },
        situation_goals: {
          type: 'string',
          description:
            "An explanation of the customer's situation and what they are trying to achieve.",
        },
      },
      required: ['userId'],
    },
  },
};
