"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GptService = void 0;
const openai_1 = __importDefault(require("openai"));
const events_1 = __importDefault(require("events"));
const axios_1 = __importDefault(require("axios"));
const get_customer_1 = require("../functions/tools/get-customer");
const lookup_mortgage_with_phone_1 = require("../functions/tools/lookup-mortgage-with-phone");
const upsert_mortgage_1 = require("../functions/tools/upsert-mortgage");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const { OPENAI_API_KEY } = process.env;
const { OPENAI_MODEL } = process.env;
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL || '';
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';
const SEGMENT_WRITE_KEY_EVENTS = process.env.SEGMENT_WRITE_KEY_EVENTS || '';
dotenv_1.default.config();
class GptService extends events_1.default {
    constructor(promptContext, toolManifest) {
        super();
        this.openai = new openai_1.default(); // Implicitly uses OPENAI_API_KEY
        this.model = OPENAI_MODEL;
        this.temperature = 0.1;
        this.messages = [{ role: 'system', content: promptContext }];
        // Ensure toolManifest is in the correct format
        console.log('constructed toolManifest', JSON.stringify(toolManifest));
        this.toolManifest = toolManifest.tools || [];
    }
    // Helper function to set the calling related parameters
    setCallParameters(to, from, callSid) {
        this.twilioNumber = to;
        this.customerNumber = from;
        this.callSid = callSid;
        axios_1.default
            .post(COAST_WEBHOOK_URL, {
            sender: 'begin',
            type: 'string',
            message: this.customerNumber,
        }, { headers: { 'Content-Type': 'application/json' } })
            .catch((err) => console.log(err));
        // Update this.messages with the phone "to" and the "from" numbers
        console.log(`[GptService] Call to: ${this.twilioNumber} from: ${this.customerNumber} with call SID: ${this.callSid}`);
        this.messages.push({
            role: 'system',
            content: `The customer phone number or "from" number is ${this.customerNumber}, the callSid is ${this.callSid} and the number to send SMSs from is: ${this.twilioNumber}. Use this information throughout as the reference when calling any of the tools. Specifically use the callSid when you use the "transfer-to-agent" tool to transfer the call to the agent`,
        });
    }
    async generateResponse(role = 'user', prompt, external_messages) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        // console.log(`[GptService] Generating response for role: ${role} with prompt: ${prompt}`);
        // Add the prompt as role user to the existing this.messages array
        this.messages.push({ role: role, content: prompt });
        // console.log(`[GptService] Messages: ${JSON.stringify(this.messages, null, 4)}`);
        // Call the OpenAI API to generate a response
        try {
            // @ts-expect-error
            const response = await this.openai.chat.completions.create({
                model: this.model,
                tools: this.toolManifest,
                messages: this.messages,
                temperature: this.temperature,
                stream: false,
            });
            // Get the Content or toolCalls array from the response
            const assistantMessage = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message;
            const toolCalls = assistantMessage === null || assistantMessage === void 0 ? void 0 : assistantMessage.tool_calls;
            console.log('toolCalls:', toolCalls);
            // Add the assistant's message to this.messages
            this.messages.push(assistantMessage);
            // The response will be the use of a Tool or just a Response. If the toolCalls array is empty, then it is just a response
            if (toolCalls && toolCalls.length > 0) {
                // The toolCalls array will contain the tool name and the response content
                for (const toolCall of toolCalls) {
                    // Make the fetch request to the Twilio Functions URL with the tool name as the path and the tool arguments as the body
                    console.log(`[GptService] Fetching Function tool: ${toolCall.function.name}`);
                    // Check if the tool call is for the 'liveAgentHandoff' function which happens right here.
                    if (toolCall.function.name === 'live-agent-handoff') {
                        console.log(`[GptService] Live Agent Handoff tool call: ${toolCall.function.name}`);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:tool',
                            type: 'string',
                            message: 'Calling live-agent-handoff and creating summary of call...',
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        // Complete the live-agent-handoff
                        this.messages.push({
                            role: 'tool',
                            content: 'agent handoff ready, creating summary of call',
                            // @ts-expect-error
                            tool_call_id: toolCall.id,
                        });
                        const summaryPrompt = 'Summarize the previous messages in the thread for the purpose of handing the call off to a live call-center agent. Include suggestions for how to engage the customer.';
                        this.messages.push({ role: 'user', content: summaryPrompt });
                        // Get the summary from the model
                        // @ts-expect-error
                        const summaryResponse = await this.openai.chat.completions.create({
                            model: this.model,
                            temperature: this.temperature,
                            messages: this.messages,
                            stream: false,
                        });
                        const summary = ((_c = (_b = summaryResponse.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '';
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:ai_summary',
                            type: 'string',
                            message: summary,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        let user = null;
                        console.log('Summary of Convo:', summary);
                        async function updateSituationGoals(caller, goals) {
                            var _a, _b;
                            const res = await (0, get_customer_1.getCustomer)(caller);
                            // @ts-expect-error
                            user = (_a = res === null || res === void 0 ? void 0 : res.customerData) === null || _a === void 0 ? void 0 : _a.userId;
                            if (user) {
                                const segmentBody = {
                                    userId: user,
                                    traits: { situation_goals: goals },
                                    writeKey: SEGMENT_WRITE_KEY,
                                };
                                console.log('updating segment profile with summary:', JSON.stringify(segmentBody));
                                axios_1.default
                                    .post('https://api.segment.io/v1/identify', segmentBody, {
                                    headers: { 'Content-Type': 'application/json' },
                                })
                                    .catch((err) => console.log(err));
                                // @ts-expect-error
                                return (_b = res === null || res === void 0 ? void 0 : res.customerData) === null || _b === void 0 ? void 0 : _b.userId;
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
                        const primaryTopic = ((_g = (_f = (_e = (_d = topicResponse.choices[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) === null || _f === void 0 ? void 0 : _f.trim()) !== null && _g !== void 0 ? _g : '') ||
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
                        const sentiment = ((_l = (_k = (_j = (_h = sentimentResponse.choices[0]) === null || _h === void 0 ? void 0 : _h.message) === null || _j === void 0 ? void 0 : _j.content) === null || _k === void 0 ? void 0 : _k.trim()) !== null && _l !== void 0 ? _l : '') ||
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
                            axios_1.default
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
                        };
                        console.log(`[GptService] Transfer to agent response: ${JSON.stringify(responseContent, null, 4)}`);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:tool',
                            type: 'string',
                            message: 'Live agent handoff complete... initiating...',
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        return responseContent;
                    }
                    else if (toolCall.function.name === 'lookup-mortgage-with-phone') {
                        let args = JSON.parse(toolCalls[0].function.arguments);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:tool',
                            type: 'string',
                            message: `Calling lookup-mortgage-with-phone to fetch records for ${JSON.stringify(args)}...`,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        const mortgageData = await (0, lookup_mortgage_with_phone_1.lookupMortgageWithPhone)(args.type, args.value);
                        console.log('Fetched mortgage records:', mortgageData);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:mortgage_records',
                            type: 'JSON',
                            message: mortgageData,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        this.messages.push({
                            role: 'tool',
                            content: JSON.stringify(mortgageData),
                            // @ts-expect-error
                            tool_call_id: toolCall.id,
                        });
                    }
                    else if (toolCall.function.name === 'upsert-mortgage') {
                        let args = JSON.parse(toolCalls[0].function.arguments);
                        // arguments: '{"type":"phone","value":"+15623389588"}
                        console.log('args:', args);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:tool',
                            type: 'string',
                            message: `Calling upsert-mortgage to upsert records on ${JSON.stringify(args)}...`,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        const updatedRecord = await (0, upsert_mortgage_1.upsertMortgage)(args.loan_application_id, args.data);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:ortgage_records',
                            type: 'JSON',
                            // @ts-expect-error
                            message: updatedRecord.fields,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        console.log('Upserted data into mortgage records:', 
                        // @ts-expect-error
                        updatedRecord.fields);
                        this.messages.push({
                            role: 'tool',
                            content: JSON.stringify(updatedRecord),
                            // @ts-expect-error
                            tool_call_id: toolCall.id,
                        });
                    }
                    else if (toolCall.function.name === 'get-customer') {
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:tool',
                            type: 'string',
                            message: `Calling tool get-customer on ${JSON.stringify(this.customerNumber)}`,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        const customerData = await (0, get_customer_1.getCustomer)(this.customerNumber);
                        console.log(`[GptService] getCustomer Tool response: ${JSON.stringify(customerData)}`);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:custemer_profile',
                            type: 'JSON',
                            message: customerData,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        this.messages.push({
                            role: 'tool',
                            content: JSON.stringify(customerData),
                            // @ts-expect-error
                            tool_call_id: toolCall.id,
                        });
                    }
                    else if (toolCall.function.name === 'update-customer-profile') {
                        console.log('updating customer profile with:', toolCall.function.arguments);
                        let args = JSON.parse(toolCall.function.arguments);
                        axios_1.default
                            .post(COAST_WEBHOOK_URL, {
                            sender: 'system:tool',
                            type: 'string',
                            message: `Calling update-customer-profile top update Segment customer profile with ${JSON.stringify(args)}`,
                        }, { headers: { 'Content-Type': 'application/json' } })
                            .catch((err) => console.log(err));
                        let newTraits = { ...args };
                        delete newTraits.userId;
                        if (args.userId) {
                            const segmentBody = {
                                userId: args.userId,
                                traits: newTraits,
                                writeKey: SEGMENT_WRITE_KEY,
                            };
                            const res = await axios_1.default
                                .post('https://api.segment.io/v1/identify', segmentBody, {
                                headers: { 'Content-Type': 'application/json' },
                            })
                                .catch((err) => console.log(err));
                            axios_1.default
                                .post(COAST_WEBHOOK_URL, {
                                sender: 'system:updated_traits',
                                type: 'JSON',
                                message: newTraits,
                            }, { headers: { 'Content-Type': 'application/json' } })
                                .catch((err) => console.log(err));
                            console.log('segment profile updated with:', JSON.stringify(newTraits));
                            this.messages.push({
                                role: 'tool',
                                content: JSON.stringify(newTraits),
                                // @ts-expect-error
                                tool_call_id: toolCall.id,
                            });
                        }
                        else {
                            console.log('no userId in arguments, skipping...');
                            this.messages.push({
                                role: 'tool',
                                content: '',
                                // @ts-expect-error
                                tool_call_id: toolCall.id,
                            });
                        }
                    }
                    else {
                        this.messages.push({
                            role: 'tool',
                            content: 'Unrecognized Tool Called',
                            // @ts-expect-error
                            tool_call_id: toolCall.id,
                        });
                    }
                    // After processing all tool calls, we need to get the final response from the model
                    // @ts-expect-error
                    const finalResponse = await this.openai.chat.completions.create({
                        model: this.model,
                        temperature: this.temperature,
                        messages: this.messages,
                        stream: false,
                    });
                    const content = ((_o = (_m = finalResponse.choices[0]) === null || _m === void 0 ? void 0 : _m.message) === null || _o === void 0 ? void 0 : _o.content) || '';
                    this.messages.push({ role: 'assistant', content: content });
                    const responseContent = {
                        type: 'text',
                        token: content,
                        last: true,
                    };
                    axios_1.default
                        .post(COAST_WEBHOOK_URL, {
                        sender: 'Conversation Relay Assistant',
                        type: 'string',
                        message: content,
                    }, { headers: { 'Content-Type': 'application/json' } })
                        .catch((err) => console.log(err));
                    // console.log(`[GptService] Text Response: ${JSON.stringify(responseContent, null, 4)}`);
                    return responseContent;
                }
            }
            else {
                // If the toolCalls array is empty, then it is just a response so we keep the convo going.
                const content = (assistantMessage === null || assistantMessage === void 0 ? void 0 : assistantMessage.content) || '';
                // Get the role of the response
                // Add the response to the this.messages array
                this.messages.push({
                    role: 'assistant',
                    content: content,
                });
                const responseContent = {
                    type: 'text',
                    token: content,
                    last: true,
                };
                axios_1.default
                    .post(COAST_WEBHOOK_URL, {
                    sender: 'Conversation Relay Assistant',
                    type: 'string',
                    message: content,
                }, { headers: { 'Content-Type': 'application/json' } })
                    .catch((err) => console.log(err));
                return responseContent;
            }
        }
        catch (error) {
            console.error('Error in GptService:', error);
            throw error;
        }
    }
}
exports.GptService = GptService;
