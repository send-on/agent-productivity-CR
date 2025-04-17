import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'mortgage-completion',
    description: `Posts a message to a serverless function that will trigger an RCS message to the user. 
      This is used when a mortgage application is complete. 
      The message will be sent to the user's phone number.
      This must be called when a mortgage application is completed.`,
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The phone number of the customer (caller)',
        },
        loan_application_id: {
          type: 'string',
          description:
            'The loan_application_id of the customer (caller) found in Airtable',
        },
      },
      required: ['to', 'loan_application_id'],
    },
  },
};
