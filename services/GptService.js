const OpenAI = require('openai');
const EventEmitter = require('events');
const axios = require('axios');
require('dotenv').config();
const { getCustomer } = require('../functions/tools/get-customer');

const { OPENAI_API_KEY } = process.env;
const { OPENAI_MODEL } = process.env;
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL;
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY;
const SEGMENT_WRITE_KEY_EVENTS = process.env.SEGMENT_WRITE_KEY_EVENTS

class GptService extends EventEmitter {
    constructor(promptContext, toolManifest) {
        super();
        this.openai = new OpenAI(); // Implicitly uses OPENAI_API_KEY
        this.model = OPENAI_MODEL;
        this.messages = [
            { role: "system", content: promptContext },
        ];
        // Ensure toolManifest is in the correct format
        console.log("constructed toolManifest", JSON.stringify(toolManifest));
        this.toolManifest = toolManifest.toolManifest.tools || [];
    }

    // Helper function to set the calling related parameters
    setCallParameters(to, from, callSid) {
        this.twilioNumber = to;
        this.customerNumber = from;
        this.callSid = callSid;

        // Update this.messages with the phone "to" and the "from" numbers
        console.log(`[GptService] Call to: ${this.twilioNumber} from: ${this.customerNumber} with call SID: ${this.callSid}`);
        this.messages.push({ role: 'system', content: `The customer phone number or "from" number is ${this.customerNumber}, the callSid is ${this.callSid} and the number to send SMSs from is: ${this.twilioNumber}. Use this information throughout as the reference when calling any of the tools. Specifically use the callSid when you use the "transfer-to-agent" tool to transfer the call to the agent` });
    }

    async generateResponse(role = 'user', prompt) {
        // console.log(`[GptService] Generating response for role: ${role} with prompt: ${prompt}`);
        // Add the prompt as role user to the existing this.messages array
        this.messages.push({ role: role, content: prompt });
        // console.log(`[GptService] Messages: ${JSON.stringify(this.messages, null, 4)}`);

        // Call the OpenAI API to generate a response
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                tools: this.toolManifest,
                messages: this.messages,
                stream: false,
            });

            // Get the Content or toolCalls array from the response
            const assistantMessage = response.choices[0]?.message;
            const toolCalls = assistantMessage?.tool_calls;

            // Add the assistant's message to this.messages
            this.messages.push(assistantMessage);

            // The response will be the use of a Tool or just a Response. If the toolCalls array is empty, then it is just a response
            if (toolCalls && toolCalls.length > 0) {

                // The toolCalls array will contain the tool name and the response content
                for (const toolCall of toolCalls) {
                    // Make the fetch request to the Twilio Functions URL with the tool name as the path and the tool arguments as the body
                    console.log(`[GptService] Fetching Function tool: ${toolCall.function.name}`);

                    // Check if the tool call is for the 'liveAgentHandoff' function which happens right here.

                    if (toolCall.function.name === "live-agent-handoff") {
                        console.log(`[GptService] Live Agent Handoff tool call: ${toolCall.function.name}`);

                        axios.post(COAST_WEBHOOK_URL, { log: 'live agent handoff ready, creating summary of call......'}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));
                        
                        // Complete the live-agent-handoff
                        this.messages.push({
                            role: "tool",
                            content: 'agent handoff ready, creating summary of call',
                            tool_call_id: toolCall.id,
                        });

                        const summaryPrompt = 'Summarize the previous messages in the thread for the purpose of handing the call off to a live call-center agent. Include suggestions for how to engage the customer.';
                        
                        this.messages.push({ role: 'user', content: summaryPrompt })

                        // Get the summary from the model
                        const summaryResponse = await this.openai.chat.completions.create({
                            model: this.model,
                            messages: this.messages,
                            stream: false,
                        });

                        const summary = summaryResponse.choices[0]?.message?.content || "";
                        axios.post(COAST_WEBHOOK_URL, { ai_summary: summary}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));

                        let user = null;
                        console.log('Summary of Convo:', summary);
                        async function updateSituationGoals(caller, goals) {
                            const res = await getCustomer(caller);
                            user = res?.customerData?.userId;
                            if (user) {
                                const segmentBody = {
                                    userId: user,
                                    traits: { "situation_goals": goals },
                                    writeKey: SEGMENT_WRITE_KEY
                                }
    
                                console.log("updating segment profile with summary:", JSON.stringify(segmentBody));
    
                                axios.post(
                                    'https://api.segment.io/v1/identify',
                                    segmentBody,
                                    { 'Content-Type': 'application/json'})
                                    .catch(err => console.log(err));
                                
                                    return res?.customerData?.userId;
                            }

                            return null;
                        }

                        const userId = updateSituationGoals(this.customerNumber, summary);

                        // After getting the summary, we'll extract the primary topic
                        const topicPrompt = `Based on the conversation, what is the primary topic being discussed? Respond with a single phrase or word.`

                        this.messages.push({ role: 'user', content: topicPrompt });


                        const topicResponse = await this.openai.chat.completions.create({
                            model: this.model,
                            messages: this.messages,
                            stream: false,
                        });

                        const primaryTopic = topicResponse.choices[0]?.message?.content.trim() || "General Inquiry";

                        // After getting the summary, we’ll analyze its sentiment using GPT-4.
                        const sentimentPrompt = `Analyze the sentiment of the following text and return one of the following values: Positive, Neutral, or Negative.`

                        this.messages.push({ role: 'user', content: sentimentPrompt });

                        const sentimentResponse = await this.openai.chat.completions.create({
                            model: this.model,
                            messages: this.messages,
                            stream: false,
                        });

                        const sentiment = sentimentResponse.choices[0]?.message?.content.trim() || "Neutral";

                        // Generate Prequal Call event and associated properties
                        const prequalEvent = {
                            event: "Prequal Call",
                            userId: user,
                            properties: {
                                primary_topic: primaryTopic,  // Dynamic topic extracted from the conversation
                                sentiment: sentiment,  // Dynamic sentiment analysis
                                // handle_time: conversationLengthInMinutes.toFixed(2),  // Length of the conversation in minutes
                                // timestamp: conversationStartTimeISO,  // Timestamp of the start of the conversation
                            },
                            writeKey: SEGMENT_WRITE_KEY_EVENTS
                        };

                        console.log('prequalEvent:', JSON.stringify(prequalEvent));

                        if (user) {
                            // Send the Prequal Call event to Segment
                            axios.post(
                                'https://api.segment.io/v1/track',
                                prequalEvent,
                                { 'Content-Type': 'application/json' }
                            ).catch(err => console.log("Error posting Prequal Call event:", err));
                        }

                        const responseContent = {
                            type: "end",
                            handoffData: JSON.stringify({
                                reasonCode: "live-agent-handoff",
                                reason: "Basic information gathered",
                                conversationSummary: summary
                            })
                        };

                        console.log(`[GptService] Transfer to agent response: ${JSON.stringify(responseContent, null, 4)}`);
                        axios.post(COAST_WEBHOOK_URL, { log: 'live agent handoff complete... initiating...'}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));

                        return responseContent;
                    } else if (toolCall.function.name === "get-customer") {
                        const customerData = await getCustomer(this.customerNumber);
                        console.log(`[GptService] getCustomer Tool response: ${JSON.stringify(customerData)}`);

                        this.messages.push({
                            role: "tool",
                            content: JSON.stringify(customerData),
                            tool_call_id: toolCall.id,
                        });
                    } else if (toolCall.function.name === "update-customer-profile") {
                        axios.post(COAST_WEBHOOK_URL, { log: `Updating segment customer profile...`}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));
                        console.log('updating customer profile with:', toolCall.function.arguments);
                        const args = JSON.parse(toolCall.function.arguments);
                        let newTraits = {...args};
                        delete newTraits.userId;

                        if (args.userId) {
                            const segmentBody = {
                                userId: args.userId,
                                traits: newTraits,
                                writeKey: SEGMENT_WRITE_KEY
                            }
                            
                            const res = await axios.post(
                                'https://api.segment.io/v1/identify',
                                segmentBody,
                                { 'Content-Type': 'application/json'})
                                .catch(err => console.log(err));

                            axios.post(COAST_WEBHOOK_URL, { log: `Segment profile updated with: ${JSON.stringify(newTraits)}`}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));
                            console.log('segment profile updated with:', JSON.stringify(newTraits));

                            this.messages.push({
                                role: "tool",
                                content: JSON.stringify(newTraits),
                                tool_call_id: toolCall.id,
                            })
                        } else {
                            console.log('no userId in arguments, skipping...')
                            this.messages.push({
                                role: "tool",
                                content: "",
                                tool_call_id: toolCall.id
                            })
                        }


                    } else {
                        this.messages.push({
                            role: "tool",
                            content: 'Unrecognized Tool Called',
                            tool_call_id: toolCall.id,
                        });
                    }

                // After processing all tool calls, we need to get the final response from the model
                const finalResponse = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: this.messages,
                    stream: false,
                });

                const content = finalResponse.choices[0]?.message?.content || "";
                this.messages.push({ role: 'assistant', content: content });

                const responseContent =
                    {
                        type: "text",
                        token: content,
                        last: true
                    };

                    axios.post(COAST_WEBHOOK_URL, { conversation_relay: `Assistant Says: ${content}`}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));

                    // console.log(`[GptService] Text Response: ${JSON.stringify(responseContent, null, 4)}`);
                    return responseContent;
                }
            } else {
                // If the toolCalls array is empty, then it is just a response so we keep the convo going.
                const content = assistantMessage?.content || "";

                // Get the role of the response
                // Add the response to the this.messages array
                this.messages.push({
                    role: "assistant",
                    content: content
                });

                const responseContent =
                {
                    type: "text",
                    token: content,
                    last: true
                };

                axios.post(COAST_WEBHOOK_URL, { conversation_relay: `Assistant Says: ${content}`}, { 'Content-Type': 'application/json'}).catch(err => console.log(err));

                return responseContent
            }
        } catch (error) {
            console.error('Error in GptService:', error);
            throw error;
        }
    };
}

module.exports = { GptService };
