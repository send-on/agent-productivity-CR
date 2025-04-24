import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'send-text',
    description: `Sends a text to the user based on the 'from' information of the caller. 
      It will also include any of the information that needs to be gathered. 
      Use this when a customer asks to have there responses texted to them instead of doing a verbal response.
      Remove any underscores from the missing information items.
      Once you receive a response then you can start the conversation with the customer again.`,
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The phone number of the customer (caller)',
        },
        missing: {
          type: 'array',
          items: { type: 'string' },
          description:
            'The missing information that needs to be gathered from the user, ensure to remove any underscores from the items.',
        },
      },
      required: ['to', 'missing'],
    },
  },
};
