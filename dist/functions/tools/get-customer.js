"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomer = getCustomer;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const SEGMENT_TOKEN = process.env.SEGMENT_TOKEN || '';
const SEGMENT_SPACE = process.env.SEGMENT_SPACE || '';
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL || '';
// Pull customer data and traits from Segment
async function fetchCustomerProfile(caller) {
    var _a, _b;
    axios_1.default
        .post(COAST_WEBHOOK_URL, {
        sender: 'system',
        type: 'string',
        message: `Fetching segment profile for ${caller} ...`,
    }, { headers: { 'Content-Type': 'application/json' } })
        .catch((err) => console.log(err));
    try {
        const URL = `https://profiles.segment.com/v1/spaces/${SEGMENT_SPACE}/collections/users/profiles/phone:${encodeURIComponent(caller)}/traits?limit=200`;
        console.log('URL:', URL);
        const response = await axios_1.default.get(URL, {
            auth: {
                username: SEGMENT_TOKEN,
                password: '',
            },
        });
        console.log(`Fetched segment customer: ${JSON.stringify(response.data)}`);
        const { first_name, last_name, customer_type, application_status, home_city, home_address, member_since, last_clicked, fav_sports_team, userId, } = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.traits;
        const customerData = {
            firstName: first_name,
            lastName: last_name,
            customer_type,
            application_status,
            home_city,
            home_address,
            member_since,
            last_clicked,
            fav_sports_team,
            userId,
        };
        axios_1.default
            .post(COAST_WEBHOOK_URL, {
            sender: 'system:segment_profile',
            type: 'JSON',
            message: { ...customerData },
        }, { headers: { 'Content-Type': 'application/json' } })
            .catch((err) => console.log(err));
        console.log('customerData:', JSON.stringify(customerData));
        return customerData;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error) && ((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
            console.log('no profile found for customer, skipping');
            return {};
        }
        else {
            console.error('error fetching profile', error);
        }
    }
}
async function getCustomer(caller) {
    if (caller) {
        const customerData = await fetchCustomerProfile(caller);
        if (customerData === null || customerData === void 0 ? void 0 : customerData.firstName) {
            console.log(`[getCustomer] customer returned:`, customerData);
        }
        return customerData;
    }
    return {};
}
