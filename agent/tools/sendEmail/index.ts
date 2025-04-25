import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

const sendgridKey = process.env.SENDGRID_API_KEY || '';

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
    if (!sendgridKey) {
      throw new Error(
        'Sendgrid credentials are not set in environment variables.'
      );
    }

    sgMail.setApiKey(sendgridKey);

    let msg = {} as sgMail.MailDataRequired;

    if (templateId) {
      msg = {
        to,
        from: 'nemery@twilio.com',
        templateId,
        dynamicTemplateData: { content },
      };
    } else {
      msg = {
        to,
        from: 'nemery@twilio.com',
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

// sendEmail({
//   to: 'nemery@twilio.com',
//   subject: 'Test Email',
//   content: 'This is a test email from SendGrid.',
// });
