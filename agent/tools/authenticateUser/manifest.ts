import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'authenticate-user',
    description: `Receives the users last name and then compares it to the last name in the mortgage loan record or Segment profile (whichever you hve access to).
      This step must be called when the call is outbound and the customer is not authenticated.
      If the customer is authenticated then you can proceed with the conversation.`,
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The phone number of the customer (caller)',
        },
        lastNameOnProfile: {
          type: 'string',
          description:
            'The last name of the customer (caller) that is stored in the Segment profile or mortgage loan record',
        },
        lastNameProvided: {
          type: 'string',
          description:
            'The last name of the customer (caller) that has just been provided by the customer',
        },
      },
      required: ['lastNameOnProfile', 'lastNameProvided'],
    },
  },
};
