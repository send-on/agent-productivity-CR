import { Context as BaseTwilioContext } from '@twilio-labs/serverless-runtime-types/types';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import OpenAI from 'openai';

export namespace Types {
  /* ---------------- Twilio ---------------- */
  export interface TwilioContext extends BaseTwilioContext {
    [key: string]: any;
  }

  export type IncomingExternalMessage = {
    body: string;
    from: string;
  };

  export type InitialCallInfo = {
    twilioNumber: string;
    customerNumber: string;
    callSid: string;
    direction: 'inbound' | 'outbound' | 'unknown';
    inReference: 'loan' | 'banking' | 'unknown';
  };

  export type CallerContext = {
    startDate?: Date | null;
    reason?: 'loan' | 'banking' | null;
    loanApps?: Record<string, unknown>[] | null;
    banking?: Record<string, unknown> | null;
    segment?: SegmentTraits | null;
  };

  /* ---------------- GPT ---------------- */
  export type GptToolManifest = {
    tools: ChatCompletionTool[];
  };

  export type GptServiceConstructorProps = {
    promptContext: string;
    toolManifest: GptToolManifest;
    initialCallInfo: InitialCallInfo;
  };

  export type GptGenerateResponse = {
    role: OpenAI.Chat.Completions.ChatCompletionMessageParam['role'];
    prompt: string;
    externalMessage?: IncomingExternalMessage;
  };

  export type GptReturnResponse = {
    type: string;
    handoffData?: string;
    last?: boolean;
    token?: string;
  };

  export type GptMessageHandlerInput =
    | {
        role: 'system' | 'user' | 'assistant';
        content: string;
      }
    | {
        role: 'tool';
        content: string;
        toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
      };

  /* ---------------- Segment ---------------- */
  export type SegmentTraits = {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    user_id?: string;
    [key: string]: any;
  };

  export type SegmentResponse = {
    traits: SegmentTraits;
  };

  /* ---------------- Coast ---------------- */
  export type SendToCoastParams = {
    sender:
      | 'system:tool'
      | 'begin'
      | 'system:ai_summary'
      | 'system:mortgage_records'
      | 'system:updated_traits'
      | 'system:customer_profile'
      | 'Conversation Relay Assistant';
    type: 'string' | 'JSON';
    message: unknown;
  };
}
