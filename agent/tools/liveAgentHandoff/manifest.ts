import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'live-agent-handoff',
    description: 'Hands the call to a live agent',
    parameters: {
      type: 'object',
      properties: {
        callSid: {
          type: 'string',
          description: 'The unique identifier of the call to be transferred',
        },
      },
      required: ['callSid'],
    },
  },
};
