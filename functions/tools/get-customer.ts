import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const SEGMENT_TOKEN = process.env.SEGMENT_TOKEN || '';
const SEGMENT_SPACE = process.env.SEGMENT_SPACE || '';
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL || '';

// Pull customer data and traits from Segment
async function fetchCustomerProfile(caller) {

  try {
    const URL = `https://profiles.segment.com/v1/spaces/${SEGMENT_SPACE}/collections/users/profiles/phone:${encodeURIComponent(
      caller
    )}/traits?limit=200`;
    console.log('URL:', URL);
    const response = await axios.get(URL, {
      auth: {
        username: SEGMENT_TOKEN,
        password: '',
      },
    });
    console.log(`Fetched segment customer: ${JSON.stringify(response.data)}`);
    const {
      first_name,
      last_name,
      phone,
      email,
      situation_goals,
      checking_acct_last_4
    } = response?.data?.traits;

    const customerData: Record<string, string> = {
      first_name,
      last_name,
      phone,
      email,
      situation_goals,
      checking_acct_last_4
    };

    // axios
    //   .post(
    //     COAST_WEBHOOK_URL,
    //     {
    //       sender: 'system:segment_profile',
    //       type: 'JSON',
    //       message: { ...customerData },
    //     },
    //     { headers: { 'Content-Type': 'application/json' } }
    //   )
    //   .catch((err) => console.log(err));

    console.log('customerData:', JSON.stringify(customerData));

    return customerData;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.log('no profile found for customer, skipping');

      return {};
    } else {
      console.error('error fetching profile', error);
    }
  }
}

export async function getCustomer(caller) {
  if (caller) {
    const customerData = await fetchCustomerProfile(caller);
    // if (customerData?.first_name) {
    //   console.log(`[getCustomer] customer returned:`, customerData);
    // }
    // console.log('******customerData*****:', customerData);
    // return {customerData: customerData};
    return customerData;
  }

  return {};
}
