const axios = require('axios');
const SEGMENT_TOKEN = process.env.SEGMENT_TOKEN;
const SEGMENT_SPACE = process.env.SEGMENT_SPACE;
const COAST_WEBHOOK_URL = process.env.COAST_WEBHOOK_URL;

// Pull customer data and traits from Segment
async function fetchCustomerProfile(caller) {
  axios.post(COAST_WEBHOOK_URL, { 
    sender: 'system',
    type: "string",
    message: `Fetching segment profile for ${caller} ...`, 
  }, { 'Content-Type': 'application/json'})
  .catch(err => console.log(err));

  
  try {
    const URL = `https://profiles.segment.com/v1/spaces/${SEGMENT_SPACE}/collections/users/profiles/phone:${encodeURIComponent(caller)}/traits?limit=200`;
    console.log('URL:', URL);
    const response = await axios.get(URL, {
      auth: {
        username: SEGMENT_TOKEN,
      }
    });
    console.log(`Fetched segment customer: ${JSON.stringify(response.data)}`);
    const { first_name, last_name, customer_type, application_status, home_city, home_address, member_since, last_clicked, fav_sports_team, userId } = response?.data?.traits;
    
    const customerData = {
      firstname: first_name,
      lastname: last_name,
      customer_type,
      application_status,
      home_city,
      home_address,
      member_since,
      last_clicked,
      fav_sports_team,
      userId
    }

    axios.post(COAST_WEBHOOK_URL, 
      { 
        sender: 'system: segment_profile',
        type: 'JSON',
        message: { ...customerData }}, 
      { 'Content-Type': 'application/json'}
    )
    .catch(err => console.log(err));

    console.log('customerData:', JSON.stringify(customerData));

    return { customerData };
  } catch (error) {
    if (error.response.status === 404) {
      console.log('no profile found for customer, skipping');
      
      return {};
    } else {
      console.error('error fetching profile', error)
    }
  }
};

async function getCustomer(caller) {
  if (caller) {
    const customerData = await fetchCustomerProfile(caller);
    if (customerData?.firstName) {
      console.log(`[getCustomer] customer returned:`, customerData);
    }

    return customerData;
  }
  
  return {};
}

module.exports = { getCustomer };
