import axios from 'axios';

type MortgageCompletionParams = {
  loan_application_id: string;
  to: string;
};

// https://www.twilio.com/docs/serverless/functions-assets/quickstart/enabling-cors-between-flex-plugins-and-functions
const baseUrl = 'https://twilio-one-api-2734.twil.io';
const sendSmsRoute = '/sendrcs';

export async function mortgageCompletion({
  loan_application_id,
  to,
}: MortgageCompletionParams) {
  console.log({ to, loan_application_id });

  const body = {
    content_sid: 'HX8e3863d462ca7694a8dac86072e4d81e', // SHOULD SWAP THIS TO ENV VAR ONCE WE CREATE THIS IN THE SERVERLESS DEPLOYMENT
    message: 'Your mortgage application is complete.',
    loan_application_id,
    to,
  };

  console.log(body);

  try {
    const response = await axios.post(`${baseUrl}${sendSmsRoute}`, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body,
    });
    return response;
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error in function:', err.message);
    } else {
      console.error('Error in function:', err);
    }
    return null;
  }
}
