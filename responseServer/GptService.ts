import OpenAI from 'openai';
import EventEmitter from 'events';
import dotenv from 'dotenv';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { FieldSet, Records } from 'airtable';
import { toolFunctions, utils, Types } from './imports';
dotenv.config();

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const SENDGRID_TEMPLATE_ID_COMPLETION =
  process.env.SENDGRID_TEMPLATE_ID_COMPLETION;

export class GptService extends EventEmitter {
  openai: OpenAI;
  model: string;
  temperature: number;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  toolManifest: Types.GptToolManifest;
  twilioNumber!: string;
  customerNumber!: string;
  callSid!: string;
  direction!: Types.InitialCallInfo['direction'];
  callReason!: Types.InitialCallInfo['callReason'];
  // Setting things to null in caller context means we tried to look for it initially and its not found.
  callerContext: Types.CallerContext;
  activeCompletionId: string | undefined;
  constructor({
    promptContext,
    toolManifest,
    initialCallInfo,
  }: Types.GptServiceConstructorProps) {
    super();
    this.openai = new OpenAI();
    this.model = OPENAI_MODEL;
    this.temperature = 0.1;
    this.messages = [{ role: 'system', content: promptContext }];
    this.toolManifest = toolManifest;
    this.callerContext = {
      validation: {
        isRequired: false,
        isValidated: false,
      },
    };

    this.activeCompletionId = undefined;
    Object.assign(this, initialCallInfo);
  }

  public async notifyInitialCallParams() {
    await utils
      .sendToCoast({
        sender: 'begin',
        type: 'string',
        message: this.customerNumber,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const content = `The customer phone number or "from" number is ${this.customerNumber}, 
    the callSid is ${this.callSid} and the number to send SMSs from is: ${this.twilioNumber}. 
    Use this information throughout as the reference when calling any of the tools. 
    Specifically use the callSid when you use the "transfer-to-agent" tool to transfer the call to the agent.
    Do not forget to include the + in the phone number!.
    `;

    console.log(
      `[GptService] Call to: notifyInitialCallParams
      ${content}`
    );

    this.messageHandler({
      role: 'system',
      content,
    });
  }

  private messageHandler(input: Types.GptMessageHandlerInput) {
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

  private async createConversationSummary() {
    const summaryPrompt: ChatCompletionMessageParam = {
      role: 'user',
      content: `Can you please summarize this conversation in a clear and friendly way for the customer? 
      Include any key information they provided or that was discussed. 
      Don't tell me this is a summary, just give me the summary.`,
    };

    const summaryResponse = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: [...this.messages, summaryPrompt],
      stream: false,
    });

    return summaryResponse.choices[0]?.message?.content || '';
  }

  private async handleToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      console.log(
        `[GptService] Fetching Function tool: ${toolCall.function.name}`
      );

      switch (toolCall.function.name) {
        case 'authenticate-user':
          await this.authenticateUser(toolCall);
          break;
        case 'get-segment-profile':
          await this.getSegmentProfile(toolCall);
          break;
        case 'set-segment-profile':
          await this.setSegmentProfile(toolCall);
          break;
        case 'upsert-segment-profile':
          await this.upsertSegmentProfile(toolCall);
          break;
        case 'get-mortgages':
          await this.getMortgages(toolCall);
          break;
        case 'upsert-mortgage':
          await this.upsertMortgage(toolCall);
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

  private async authenticateUser(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for authenticate user:', args);

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling authenticate-user to validate the user ${JSON.stringify(
          args
        )}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const isValidated = await toolFunctions.authenticateUser(args);
    this.callerContext.validation.isValidated = isValidated;

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `User validation status: ${isValidated}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    this.messageHandler({
      role: 'tool',
      content: `User validation status: ${isValidated}`,
      toolCall,
    });
  }

  private async getSegmentProfile(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling tool get-segment-profile on ${JSON.stringify(
          this.customerNumber
        )}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const customerData = await toolFunctions.getSegmentProfile(
      this.customerNumber
    );

    // this.callerContext.segment ??= customerData;

    console.log(
      `[GptService] getCustomer Tool response: ${JSON.stringify(customerData)}`
    );

    await utils
      .sendToCoast({
        sender: 'system:customer_profile',
        type: 'JSON',
        message: { customerData: customerData },
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

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

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling update-segment-profile to update Segment customer profile with ${JSON.stringify(
          args
        )}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    let newTraits = args.traits || {};
    delete newTraits.userId;

    if (args.userId) {
      await toolFunctions.upsertSegmentProfile(args);

      await utils
        .sendToCoast({
          sender: 'system:updated_traits',
          type: 'JSON',
          message: newTraits,
        })
        .catch((err) => console.error('Failed to send to Coast:', err));

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

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling get-mortgages to fetch records for ${JSON.stringify(
          args
        )}...`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const mortgages = await toolFunctions.getMortgages(args);

    // Set null to the missing columns so the assistant knows explicity which values to ask for.
    if (mortgages) {
      mortgages.forEach(
        (mortgage, index) =>
          (mortgages[index] = utils.identifyMissingCols(mortgage))
      );
    }

    this.callerContext.loanApps ??= mortgages;

    console.log('updates:', mortgages);

    await utils
      .sendToCoast({
        sender: 'system:mortgage_records',
        type: 'JSON',
        message: mortgages,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    this.messages.push({
      role: 'tool',
      content: `## Loan Application Field Definitions\n\n\`\`\`json\n${JSON.stringify(
        utils.airtableCols,
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
    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling upsert-mortgage to upsert records on ${JSON.stringify(
          args
        )}...`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    let updatedRecord: Records<FieldSet> | null;

    if (this.callerContext.loanApps !== null) {
      updatedRecord = await toolFunctions.upsertMortgage(args);
    }
    // This is the first time we are setting the loanApps, so we need to init it with additional values.
    // We cant ask the the AI to do this as the date object is locked in at october 2023 due to when it was trained.
    else {
      const currentDate = utils.getFormattedDate();
      const initMortgageVals = {
        user_id: args.data.email,
        has_completed_application: 'false',
        application_start_date: currentDate,
        loan_application_id: `${args.data.first_name}_${Date.now()}`,
      };

      updatedRecord = await toolFunctions.upsertMortgage({
        queryField: 'phone',
        queryValue: this.customerNumber,
        data: { ...args.data, ...initMortgageVals },
      });

      if (updatedRecord) {
        this.callerContext.loanApps = [updatedRecord[0].fields];
      }
    }

    const updatedRecordFields = updatedRecord?.[0]?.fields || {};
    const missingCols = utils.identifyMissingCols(updatedRecordFields);

    const nullFields = Object.fromEntries(
      Object.entries(missingCols).filter(([_, value]) => value === null)
    );
    const hasNulls = Object.keys(nullFields).length > 0;

    console.log(nullFields);
    console.log('hasNulls:', hasNulls);

    await utils
      .sendToCoast({
        sender: 'system:mortgage_records',
        type: 'JSON',
        message: updatedRecord,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

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
      Ask the customer if they would like you to submit the loan application for them 
      or send them a link to review everything online by calling the tool 'mortgage-completion'.
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
    const { email, first_name, last_name } = JSON.parse(
      toolCall.function.arguments
    );
    const cleanedEmail = email.replace(/\s+/g, '');

    const segmentProfile = {
      email: cleanedEmail,
      phone: this.customerNumber,
      first_name,
      last_name,
      user_id: cleanedEmail,
    };

    await toolFunctions.setSegmentProfile({
      ...segmentProfile,
    });

    //this.callerContext.segment ??= segmentProfile;

    this.messageHandler({
      role: 'tool',
      content: `Segment profile: ${JSON.stringify(segmentProfile)}`,
      toolCall,
    });
  }

  private async liveAgentHandoff(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    _assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessage
  ) {
    // Complete the live-agent-handoff
    this.messageHandler({
      role: 'tool',
      content: 'Agent handoff ready',
      toolCall: toolCall,
    });

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: 'Calling live-agent-handoff and creating summary of call...',
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const summaryPrompt =
      'Summarize the previous messages in the thread for the purpose of handing the call off to a live call-center agent. Include suggestions for how to engage the customer.';
    this.messageHandler({
      role: 'user',
      content: summaryPrompt,
    });

    const conversationSummary = await this.createConversationSummary();

    await utils
      .sendToCoast({
        sender: 'system:ai_summary',
        type: 'string',
        message: conversationSummary,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const responseContent = {
      type: 'end',
      handoffData: JSON.stringify({
        reasonCode: 'live-agent-handoff',
        reason: 'Basic information gathered',
        conversationSummary,
      }),
    };

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: 'Live agent handoff complete... initiating...',
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    return responseContent;
  }

  private async sendText(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for send text are here:', args);

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling send-text to capture data from the user ${JSON.stringify(
          args
        )}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    await toolFunctions.sendText(args.to, args.missing);

    this.messageHandler({
      role: 'tool',
      content: `Message sent to customer, let customer know and wait for response`,
      toolCall,
    });
  }

  private async sendRecap(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    this.messageHandler({
      role: 'tool',
      content: `Message sent to customer, let customer know and wait for response`,
      toolCall,
    });

    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for send recap are here:', args);

    const conversationSummary = await this.createConversationSummary();

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling send-recap to deliver email to the user ${JSON.stringify(
          args
        )} with the following summary: ${conversationSummary}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    await toolFunctions.sendEmail({
      to: args.to,
      subject: args.subject,
      content: conversationSummary,
      templateId: SENDGRID_TEMPLATE_ID_COMPLETION,
    });

    const responseContent = {
      type: 'text',
      last: true,
      token: `I have sent you an email recap, is there anything else I can help you with, or will that be all for today?`,
    };

    return responseContent;
  }

  private async mortgageCompletion(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log('args for send text are here:', args);

    await utils
      .sendToCoast({
        sender: 'system:tool',
        type: 'string',
        message: `Calling mortgage-completion to capture data from the user ${JSON.stringify(
          args
        )}`,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

    const response = await toolFunctions.mortgageCompletion(args);

    await utils
      .sendToCoast({
        sender: 'system:message',
        type: 'JSON',
        message: response?.data,
      })
      .catch((err) => console.error('Failed to send to Coast:', err));

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
  }: Types.GptGenerateResponse): Promise<Types.GptReturnResponse> {
    try {
      console.log({ role, prompt, externalMessage });

      const currentCompletionId = Math.random().toString();
      this.activeCompletionId = currentCompletionId;

      if (externalMessage) {
        console.log('external_messages in gptService:', externalMessage);
        this.messages.push({
          role: 'user',
          content: JSON.stringify(externalMessage),
        });
      }

      if (role === 'user' || role === 'system' || role === 'assistant') {
        this.messages.push({ role, content: prompt });
      }

      const initialResponse = await this.openai.chat.completions.create({
        model: this.model,
        tools: this.toolManifest.tools,
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
        // Send the caller to the live agent which requires an end call event afterwards.
        if (toolCalls[0].function.name === 'live-agent-handoff') {
          return await this.liveAgentHandoff(toolCalls[0], assistantMessage);
        }
        // Sending recap requires a returned value to the assistant.
        else if (toolCalls[0].function.name === 'send-recap') {
          return await this.sendRecap(toolCalls[0]);
        }

        await this.handleToolCalls(toolCalls);

        const finalResponse = await this.openai.chat.completions.create({
          model: this.model,
          messages: this.messages,
          temperature: this.temperature,
          stream: false,
        });

        if (currentCompletionId !== this.activeCompletionId) {
          console.log('Aborting response due to new completion ID');
          return {
            type: 'text',
            token: '',
            last: true,
          };
        }

        const content = finalResponse.choices[0]?.message?.content ?? '';
        this.messages.push({ role: 'assistant', content });

        await utils
          .sendToCoast({
            sender: 'Conversation Relay Assistant',
            type: 'string',
            message: content,
          })
          .catch((err) => console.error('Failed to send to Coast:', err));

        return {
          type: 'text',
          token: content,
          last: true,
        };
      }

      // No tools: just return assistant response
      const content = assistantMessage.content ?? '';
      this.messages.push({ role: 'assistant', content });

      await utils
        .sendToCoast({
          sender: 'Conversation Relay Assistant',
          type: 'string',
          message: content,
        })
        .catch((err) => console.error('Failed to send to Coast:', err));

      if (currentCompletionId !== this.activeCompletionId) {
        console.log('Aborting response due to new completion ID');
        return {
          type: 'text',
          token: '',
          last: true,
        };
      }

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

  abort = () => {
    this.activeCompletionId = undefined;
  };
}
