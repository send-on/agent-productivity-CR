import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

const sendGridKey = process.env.SENDGRID_API_KEY;
const sendGridDomain = process.env.SENDGRID_DOMAIN;

type sendEmailProps = {
  to: string;
  subject: string;
  content: string;
  templateId?: string;
};

export async function sendEmail({
  to,
  subject,
  content,
  templateId,
}: sendEmailProps) {
  try {
    if (!sendGridKey || !sendGridDomain) {
      throw new Error(
        'Sendgrid credentials are not set in environment variables.'
      );
    }

    sgMail.setApiKey(sendGridKey);

    let msg = {} as sgMail.MailDataRequired;

    if (templateId && !to.includes('@twilio.com')) {
      msg = {
        to,
        from: sendGridDomain,
        templateId,
        dynamicTemplateData: {
          content,
          subject,
        },
      };
    } else {
      msg = {
        to,
        from: sendGridDomain,
        subject,
        html: `<div>${content}</div>`,
      };
    }

    const result = await sgMail.send(msg);
    console.log(`✓ Message sent to ${to}`);
    return result;
  } catch (error) {
    console.error('✗ Failed to send message:', error);
    throw error;
  }
}
