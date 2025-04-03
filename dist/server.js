"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const express_ws_1 = __importDefault(require("express-ws"));
const express_ws_2 = __importDefault(require("express-ws"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const toolManifest_1 = require("./assets/toolManifest");
const GptService_1 = require("./services/GptService");
const get_customer_1 = require("./functions/tools/get-customer");
dotenv_1.default.config();
const promptContext = fs_1.default.readFileSync('./assets/context.md', 'utf-8');
const PORT = parseInt(process.env.PORT || '3001', 10);
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL || '';
const { app } = (0, express_ws_2.default)((0, express_1.default)());
app.use(express_1.default.urlencoded({ extended: true })).use(express_1.default.json());
// Initialize express-ws
(0, express_ws_1.default)(app);
// Enable CORS
app.use((0, cors_1.default)());
app.get('/', (req, res) => {
    res.send('WebSocket Server Running');
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
app.ws('/conversation-relay', (ws) => {
    console.log('New Conversation Relay websocket established');
    let gptService = null;
    ws.on('message', async (data) => {
        var _a;
        try {
            const message = JSON.parse(data);
            console.log(`[Conversation Relay] Message received: ${JSON.stringify(message, null, 4)}`);
            let gptResponse = '';
            switch (message.type) {
                case 'info':
                    console.debug(`[Conversation Relay] info: ${JSON.stringify(message, null, 4)}`);
                    break;
                case 'prompt':
                    console.info(`[Conversation Relay] Caller Message: ${message.voicePrompt}`);
                    axios_1.default
                        .post(COAST_WEBHOOK_URL, {
                        sender: 'Customer',
                        type: 'string',
                        message: message.voicePrompt,
                    }, { headers: { 'Content-Type': 'application/json' } })
                        .catch((err) => console.log(err));
                    if (gptService) {
                        // @ts-expect-error
                        gptResponse = await gptService.generateResponse('user', message.voicePrompt);
                        console.info(`[Conversation Relay] Bot Response: ${JSON.stringify(gptResponse, null, 4)}`);
                        ws.send(JSON.stringify(gptResponse));
                    }
                    break;
                case 'interrupt':
                    console.info(`[Conversation Relay] Interrupt: ${JSON.stringify(message, null, 4)}`);
                    axios_1.default
                        .post(COAST_WEBHOOK_URL, { sender: 'system', type: 'string', message: 'Interrupted' }, { headers: { 'Content-Type': 'application/json' } })
                        .catch((err) => console.log(err));
                    break;
                case 'dtmf':
                    console.debug(`[Conversation Relay] DTMF: ${(_a = message.digits) === null || _a === void 0 ? void 0 : _a.digit}`);
                    break;
                case 'setup':
                    console.log('Initializing GptService with Context and Manifest');
                    console.log('TOOOOOL MANIFEST:', toolManifest_1.toolManifest);
                    gptService = new GptService_1.GptService(promptContext, toolManifest_1.toolManifest);
                    gptService.setCallParameters(message.to, message.from, message.callSid);
                    console.log('Fetching customer data for:', message.from);
                    const customerData = await (0, get_customer_1.getCustomer)(message.from);
                    const customerName = customerData === null || customerData === void 0 ? void 0 : customerData.firstName;
                    let greetingText = customerName
                        ? `Greet the customer with name ${customerName} in a friendly manner. Do not constantly use their name, but drop it in occasionally. Tell them that you have to first verify their details before you can proceed to ensure confidentiality of the conversation.`
                        : `Greet the customer in a friendly manner. Tell them that you have to first verify their details before you can proceed to ensure confidentiality of the conversation.`;
                    // @ts-expect-error
                    gptResponse = await gptService.generateResponse('system', greetingText);
                    console.info(`[Conversation Relay] Setup <<<<<<: ${JSON.stringify(gptResponse, null, 4)}`);
                    ws.send(JSON.stringify(gptResponse));
                    break;
                default:
                    console.log(`[Conversation Relay] Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            console.error('[Conversation Relay] Error in message handling:', error);
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});
