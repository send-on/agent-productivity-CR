import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'send-recap',
    description: `If the user asks to have a recap of the conversation sent to them call this tool.
    Sends an email to the user based on the conversation that was had with the them.
    The tool itself will handle the summary content of the email`,
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description:
            'The email of the customer (caller) either found on the Segment profile or the loan application.',
        },
        subject: {
          type: 'string',
          description:
            'The email header for the recap email. Something along the lines of A recap of your most recent call.',
        },
      },
      required: ['to', 'subject'],
    },
  },
};
