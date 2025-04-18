import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get-mortgages',
    description:
      'Lookups up existing mortgage details for the customer phone number or email address.',
    parameters: {
      type: 'object',
      properties: {
        queryField: {
          type: 'string',
          description:
            "The type of identifier to use for the lookup. Can be 'phone' or 'email'.",
        },
        queryValue: {
          type: 'string',
          description:
            'The value of the identifier.  If type is a phone number then value is the phone number of the customer (caller)',
        },
      },
      required: ['queryField', 'queryValue'],
    },
  },
};
