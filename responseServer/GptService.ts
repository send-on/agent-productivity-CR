import OpenAI from 'openai';
import EventEmitter from 'events';
import axios from 'axios';
import dotenv from 'dotenv';
import {
  getSegmentProfile,
  upsertMortgage,
  sendText,
  getMortgages,
  upsertSegmentProfile,
  mortgageCompletion,
  setSegmentProfile,
} from '../agent/tools/toolFunctions';
import { identifyMissingCols } from '../agent/utils/airtable/identifyMissingCols';
import { airtableCols } from '../agent/utils/airtable/airtableCols';
import { SegmentTraits } from '../agent/tools/getSegmentProfile';
import { getFormattedDate } from '../agent/utils/helpers/getFormattedDate';
import { FieldSet, Records } from 'airtable';
dotenv.config();

type CoastPost = {
  sender:
    | 'system:tool'
    | 'begin'
    | 'system:ai_summary'
    | 'system:mortgage_records'
    | 'system:updated_traits'
    | 'system:mortgage_records'
    | 'system:customer_profile'
    | 'Conversation Relay Assistant';
  type: string;
  message: unknown;
};

type GptGenerateResponse = {
  role?: string;
  prompt: string;
  externalMessage?: {
    body: string;
    from: string;
  };
};

export type GptReturnResponse =
  | {
      type: string;
      handoffData?: string;
      last: boolean;
      token: string;
    }
  | undefined;

type GptIncomingCallParams = {
  to: string;
  from: string;
  callSid: string;
};

type MessageHandlerInput =
  | {
      role: 'system' | 'user' | 'assistant';
      content: string;
    }
  | {
      role: 'tool';
      content: string;
      toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
    };

const { OPENAI_MODEL } = process.env;
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL || '';
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';
const SEGMENT_WRITE_KEY_EVENTS = process.env.SEGMENT_WRITE_KEY_EVENTS || '';

dotenv.config();

export const sendToCoast = async ({ sender, type, message }: CoastPost) => {
  return axios.post(
    COAST_WEBHOOK_URL,
    { sender, type, message },
    { headers: { 'Content-Type': 'application/json' } }
  );
};

export class GptService extends EventEmitter {
  openai: OpenAI;
  model: string | undefined;
  temperature: number;
  messages: { role: string; content: any; tool_call_id?: string }[];
  toolManifest: any;
  twilioNumber: any;
  customerNumber: any;
  callSid: any;
  // Setting things to null means we tried to look for it initially and its not found.
  callerContext: {
    startDate?: Date | null;
    reason?: 'loan' | 'banking' | null;
    loanApps?: Record<string, unknown>[] | null;
    banking?: Record<string, unknown> | null;
    segment?: SegmentTraits | null;
  };
  constructor(promptContext, toolManifest) {
    super();
    this.openai = new OpenAI(); // Implicitly uses OPENAI_API_KEY
    this.model = OPENAI_MODEL;
    this.temperature = 0.1;
    this.messages = [{ role: 'system', content: promptContext }];
    // Ensure toolManifest is in the correct format
    console.log('constructed toolManifest', JSON.stringify(toolManifest));
    this.toolManifest = toolManifest.tools || [];
    this.callerContext = {};
  }

  public async setCallParameters({ to, from, callSid }: GptIncomingCallParams) {
    this.twilioNumber = to;
    this.customerNumber = from;
    this.callSid = callSid;

    await sendToCoast({
      sender: 'begin',
      type: 'string',
      message: this.customerNumber,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    console.log(
      `[GptService] Call to: ${this.twilioNumber} 
      from: ${this.customerNumber} 
      with call SID: ${this.callSid}`
    );

    const content = `The customer phone number or "from" number is ${this.customerNumber}, 
    the callSid is ${this.callSid} and the number to send SMSs from is: ${this.twilioNumber}. 
    Use this information throughout as the reference when calling any of the tools. 
    Specifically use the callSid when you use the "transfer-to-agent" tool to transfer the call to the agent`;

    this.messageHandler({
      role: 'system',
      content,
    });
  }

  private messageHandler(input: MessageHandlerInput) {
    if (input.role === 'tool') {
      this.messages.push({
        role: input.role,
        content: input.content,
        tool_call_id: input.toolCall.id,
      });
    } else {
      this.messages.push({
        role: input.role,
        content: input.content,
      });
    }
  }

  private async handleToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    assistantMessage: any
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      console.log(
        `[GptService] Fetching Function tool: ${toolCall.function.name}`
      );

      switch (toolCall.function.name) {
        case 'get-segment-profile':
          await this.getSegmentProfile(toolCall);
          break;
        case 'set-segment-profile':
          await this.setSegmentProfile(toolCall);
          break;
        case 'update-customer-profile':
          await this.upsertSegmentProfile(toolCall);
          break;
        case 'get-mortgages':
          await this.getMortgages(toolCall);
          break;
        case 'upsert-mortgage':
          await this.upsertMortgage(toolCall);
          break;
        case 'live-agent-handoff':
          await this.liveAgentHandoff(toolCall, assistantMessage);
          break;
        case 'send-text':
          await this.sendText(toolCall);
          break;
        case 'mortgage-completion':
          await this.mortgageCompletion(toolCall);
          break;
        default:
          this.messages.push({
            role: 'tool',
            content: 'Unrecognized Tool Called',
            tool_call_id: toolCall.id,
          });
      }
    }
  }

  private async getSegmentProfile(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling tool get-segment-profile on ${JSON.stringify(
        this.customerNumber
      )}`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    const customerData = await getSegmentProfile(this.customerNumber);

    this.callerContext.segment ??= customerData;

    console.log(
      `[GptService] getCustomer Tool response: ${JSON.stringify(customerData)}`
    );

    await sendToCoast({
      sender: 'system:customer_profile',
      type: 'JSON',
      message: { customerData: customerData },
    }).catch((err) => console.error('Failed to send to Coast:', err));

    this.messageHandler({
      role: 'tool',
      content: `Segment profile trait data: ${JSON.stringify(customerData)}`,
      toolCall,
    });
  }

  private async upsertSegmentProfile(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling update-segment-profile to update Segment customer profile with ${JSON.stringify(
        args
      )}`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    let newTraits = args.traits || {};
    delete newTraits.userId;

    if (args.userId) {
      await upsertSegmentProfile(args);

      await sendToCoast({
        sender: 'system:updated_traits',
        type: 'JSON',
        message: newTraits,
      }).catch((err) => console.error('Failed to send to Coast:', err));

      this.messageHandler({
        role: 'tool',
        content: JSON.stringify(newTraits),
        toolCall,
      });
    } else {
      console.log('no userId in arguments, skipping...');
      this.messageHandler({
        role: 'tool',
        content: `No userId in arguments, skipping upsert-segment-profile tool call`,
        toolCall,
      });
    }
  }

  private async getMortgages(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling get-mortgages to fetch records for ${JSON.stringify(
        args
      )}...`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    const mortgages = await getMortgages(args);

    // Set null to the missing columns so the assistant knows explicity which values to ask for.
    if (mortgages) {
      mortgages.forEach(
        (mortgage, index) => (mortgages[index] = identifyMissingCols(mortgage))
      );
    }

    this.callerContext.loanApps ??= mortgages;

    console.log('updates:', mortgages);

    await sendToCoast({
      sender: 'system:mortgage_records',
      type: 'JSON',
      message: JSON.stringify(mortgages),
    }).catch((err) => console.error('Failed to send to Coast:', err));

    this.messages.push({
      role: 'tool',
      content: `## Loan Application Field Definitions\n\n\`\`\`json\n${JSON.stringify(
        airtableCols,
        null,
        2
      )}\n\`\`\`\n\nOnly ask for fields that are \`null\`. Do not ask for fields that are already filled in.
      For any type that is not set to 'text' in the field definitions, when you ask for the value, 
      make sure you user lowercase letters when you upsert the value with 'upsert-mortgage'.
      If the email field is set to null, ask for that item first.
      ## Loan Applications found: ${JSON.stringify(mortgages)}
      ## Segment Connection - if segment profile was not set yet and if the airtable record has an email, 
      immediately call 'set-segment-profile' to set the segment profile. If email is not found ask for it first and then call 'set-segment-profile'.`,
      tool_call_id: toolCall.id,
    });
  }

  private async upsertMortgage(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for upsert mortgage:', args);
    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling upsert-mortgage to upsert records on ${JSON.stringify(
        args
      )}...`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    let updatedRecord: Records<FieldSet> | null;

    if (this.callerContext.loanApps !== null) {
      updatedRecord = await upsertMortgage(args);
    }
    // This is the first time we are setting the loanApps, so we need to init it with additional values.
    // We cant ask the the AI to do this as the date object is locked in at october 2023 due to when it was trained.
    else {
      const currentDate = getFormattedDate();
      const initMortgageVals = {
        user_id: args.data.email,
        has_completed_application: 'false',
        application_start_date: currentDate,
        loan_application_id: `${args.data.first_name}_${Date.now()}`,
      };

      updatedRecord = await upsertMortgage({
        queryField: 'phone',
        queryValue: this.customerNumber,
        data: { ...args.data, ...initMortgageVals },
      });

      if (updatedRecord) {
        this.callerContext.loanApps = [updatedRecord[0].fields];
      }
    }

    const updatedRecordFields = updatedRecord?.[0]?.fields || {};
    const missingCols = identifyMissingCols(updatedRecordFields);

    const nullFields = Object.fromEntries(
      Object.entries(missingCols).filter(([_, value]) => value === null)
    );
    const hasNulls = Object.keys(nullFields).length > 0;

    console.log(nullFields);
    console.log('hasNulls:', hasNulls);

    await sendToCoast({
      sender: 'system:mortgage_records',
      type: 'JSON',
      message: updatedRecord,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    let content = '';

    if (hasNulls) {
      content = `## Loan Application Updates ${JSON.stringify(updatedRecord)}
      The customer has the following Missing values: ${JSON.stringify(
        missingCols
      )} that we still need to ask for.
      `;
    } else {
      content = `## Loan Application Updates ${JSON.stringify(updatedRecord)}
      The customer has completed the loan application and we can proceed to the next step.
      You MUST now call the 'mortgage-completion' tool to complete the application.
      `;
    }

    this.messageHandler({
      role: 'tool',
      content,
      toolCall,
    });
  }

  private async setSegmentProfile(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);

    const segmentProfile = {
      email: args.email.replace(/\s+/g, ''),
      phone: this.customerNumber,
      first_name: args.first_name,
      last_name: args.last_name,
      user_id: args.email.replace(/\s+/g, ''),
    };

    await setSegmentProfile({
      email: args.email.replace(/\s+/g, ''),
      phone: this.customerNumber,
      first_name: args.first_name,
      last_name: args.last_name,
    });

    this.callerContext.segment ??= segmentProfile;

    this.messageHandler({
      role: 'tool',
      content: `Segment profile: ${JSON.stringify(segmentProfile)}`,
      toolCall,
    });
  }

  // This should be refactored!
  private async liveAgentHandoff(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessage
  ) {
    console.log(
      `[GptService] Live Agent Handoff tool call: ${toolCall.function.name}`
    );

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: 'Calling live-agent-handoff and creating summary of call...',
    }).catch((err) => console.error('Failed to send to Coast:', err));

    // Complete the live-agent-handoff
    this.messageHandler({
      role: 'tool',
      content: 'agent handoff ready, creating summary of call',
      toolCall: toolCall,
    });

    const summaryPrompt =
      'Summarize the previous messages in the thread for the purpose of handing the call off to a live call-center agent. Include suggestions for how to engage the customer.';

    this.messageHandler({
      role: 'user',
      content: summaryPrompt,
    });

    // Get the summary from the model
    // @ts-expect-error
    const summaryResponse = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: this.messages,
      stream: false,
    });

    const summary = summaryResponse.choices[0]?.message?.content || '';

    await sendToCoast({
      sender: 'system:ai_summary',
      type: 'string',
      message: summary,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    let user: string | undefined;
    console.log('Summary of Convo:', summary);

    async function updateSituationGoals(caller, goals) {
      const res = await getSegmentProfile(caller);

      user = res?.userId;
      if (user) {
        const segmentBody = {
          userId: user,
          traits: { situation_goals: goals },
          writeKey: SEGMENT_WRITE_KEY,
        };

        console.log(
          'updating segment profile with summary:',
          JSON.stringify(segmentBody)
        );

        axios
          .post('https://api.segment.io/v1/identify', segmentBody, {
            headers: { 'Content-Type': 'application/json' },
          })
          .catch((err) => console.log(err));

        return res?.userId;
      }

      return null;
    }

    const userId = updateSituationGoals(this.customerNumber, summary);

    // After getting the summary, we'll extract the primary topic
    const topicPrompt = `Based on the conversation, what is the primary topic being discussed? Respond with a single phrase or word.`;

    this.messages.push({ role: 'user', content: topicPrompt });

    // @ts-ignore
    const topicResponse = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: this.messages,
      stream: false,
    });

    const primaryTopic =
      (topicResponse.choices[0]?.message?.content?.trim() ?? '') ||
      'General Inquiry';

    // After getting the summary, we’ll analyze its sentiment using GPT-4.
    const sentimentPrompt = `Analyze the sentiment of the following text and return one of the following values: Positive, Neutral, or Negative.`;

    this.messages.push({ role: 'user', content: sentimentPrompt });

    // @ts-expect-error
    const sentimentResponse = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: this.messages,
      stream: false,
    });

    const sentiment =
      (sentimentResponse.choices[0]?.message?.content?.trim() ?? '') ||
      'Neutral';

    // Generate Prequal Call event and associated properties
    const prequalEvent = {
      event: 'Prequal Call',
      userId: user,
      properties: {
        primary_topic: primaryTopic, // Dynamic topic extracted from the conversation
        sentiment: sentiment, // Dynamic sentiment analysis
        // handle_time: conversationLengthInMinutes.toFixed(2),  // Length of the conversation in minutes
        // timestamp: conversationStartTimeISO,  // Timestamp of the start of the conversation
      },
      writeKey: SEGMENT_WRITE_KEY_EVENTS,
    };

    console.log('prequalEvent:', JSON.stringify(prequalEvent));

    if (user) {
      // Send the Prequal Call event to Segment
      axios
        .post('https://api.segment.io/v1/track', prequalEvent, {
          headers: { 'Content-Type': 'application/json' },
        })
        .catch((err) => console.log('Error posting Prequal Call event:', err));
    }

    const responseContent = {
      type: 'end',
      handoffData: JSON.stringify({
        reasonCode: 'live-agent-handoff',
        reason: 'Basic information gathered',
        conversationSummary: summary,
      }),
      last: true,
      token: assistantMessage?.content || '',
    };

    console.log(
      `[GptService] Transfer to agent response: ${JSON.stringify(
        responseContent,
        null,
        4
      )}`
    );

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: 'Live agent handoff complete... initiating...',
    }).catch((err) => console.error('Failed to send to Coast:', err));

    return responseContent;
  }

  private async sendText(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for send text is here:', args);

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling send-text to capture data from the user ${JSON.stringify(
        args
      )}`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    await sendText(args.to, args.missing);

    this.messageHandler({
      role: 'tool',
      content: `Message sent to customer, let customer know and wait for response`,
      toolCall,
    });
  }

  private async mortgageCompletion(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for send text is here:', args);

    await sendToCoast({
      sender: 'system:tool',
      type: 'string',
      message: `Calling mortgage-completion to capture data from the user ${JSON.stringify(
        args
      )}`,
    }).catch((err) => console.error('Failed to send to Coast:', err));

    await mortgageCompletion(args);

    this.messageHandler({
      role: 'tool',
      content:
        'Message sent to customer, let customer know they must validate validate the loan information on the website and submit the application there.',
      toolCall,
    });
  }

  async generateResponse({
    role = 'user',
    prompt,
    externalMessage,
  }: GptGenerateResponse): Promise<GptReturnResponse> {
    try {
      console.log({ role, prompt, externalMessage });

      if (externalMessage) {
        console.log('external_messages in gptService:', externalMessage);
        this.messages.push({
          role: 'user',
          content: JSON.stringify(externalMessage),
        });
      }

      this.messages.push({ role, content: prompt });

      // @ts-expect-error
      const initialResponse = await this.openai.chat.completions.create({
        model: this.model,
        tools: this.toolManifest,
        messages: this.messages,
        temperature: this.temperature,
        stream: false,
      });

      const assistantMessage = initialResponse.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('No message received from OpenAI.');
      }

      this.messages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length > 0) {
        await this.handleToolCalls(toolCalls, assistantMessage);

        // @ts-expect-error
        const finalResponse = await this.openai.chat.completions.create({
          model: this.model,
          messages: this.messages,
          temperature: this.temperature,
          stream: false,
        });

        const content = finalResponse.choices[0]?.message?.content ?? '';
        this.messages.push({ role: 'assistant', content });

        await sendToCoast({
          sender: 'Conversation Relay Assistant',
          type: 'string',
          message: content,
        }).catch((err) => console.error('Failed to send to Coast:', err));
        return {
          type: 'text',
          token: content,
          last: true,
        };
      }

      // No tools: just return assistant response
      const content = assistantMessage.content ?? '';
      this.messages.push({ role: 'assistant', content });

      await sendToCoast({
        sender: 'Conversation Relay Assistant',
        type: 'string',
        message: JSON.stringify(content),
      }).catch((err) => console.error('Failed to send to Coast:', err));

      return {
        type: 'text',
        token: content,
        last: true,
      };
    } catch (error) {
      console.error('Error in GptService:', error);
      throw error;
    }
  }
}
