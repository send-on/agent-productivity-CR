import axios from 'axios';

type MortgageCompletionParams = {
  loan_application_id: string;
  to: string;
};

const baseUrl = 'https://twilio-one-api-2734.twil.io';
const sendSmsRoute = '/sendsms';

export async function mortgageCompletion({
  loan_application_id,
  to,
}: MortgageCompletionParams) {
  console.log({ to, loan_application_id });

  const body = {
    message: 'Your mortgage application is complete.',
    loan_application_id,
    to,
  };

  console.log(body);

  try {
    const response = await axios.post(`${baseUrl}${sendSmsRoute}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    console.log('response', response);
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error in function:', err.message);
    } else {
      console.error('Error in function:', err);
    }
    return null;
  }
}
