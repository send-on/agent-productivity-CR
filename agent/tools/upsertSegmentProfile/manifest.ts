import { ChatCompletionTool } from 'openai/resources/chat/completions';
export const manifest: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'upsert-segment-profile',
    description: `Upserts the segment customer profile with new traits using either their email, phone or userId.
    Use this as well if the customer ever mentions wanting to set preferences on their profile.
    An example would be if they say "I want to be contacted via RCS" you would then send via the traits object {traits: {preferred_channel: RCS}}.
    Let the customer know when you have completed this task.`,
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The userId of the customer in Segment',
        },
        traits: {
          type: 'object',
          description:
            'Object containing the traits data to be upserted. Traits should contain any number of characteristics such as preferred_name or preferred_channel. For example, traits:{preferred_name: Bob}.  Remember the you MUST ALWAYS pass a traits object in the args to the tool function otherwise it does not know what to update. ',
        },
      },
      required: ['email', 'traits'],
    },
  },
};
