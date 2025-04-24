import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

const sendgridKey = process.env.SENDGRID_API_KEY || '';

type sendEmailProps = {
  to: string;
  subject: string;
  content: string;
};

export async function sendEmail({ to, subject, content }: sendEmailProps) {
  try {
    console.log({
      to,
      subject,
      content,
    });
    return;
    if (!sendgridKey) {
      throw new Error(
        'Sedngrid credentials are not set in environment variables.'
      );
    }

    sgMail.setApiKey(sendgridKey);

    const msg = {
      to,
      from: 'test@example.com',
      subject,
      html: `<strong>${content}</strong>`,
    };

    const result = await sgMail.send(msg);
    console.log(`✓ Message sent to ${to}}`);
    return result;
  } catch (error) {
    console.error('✗ Failed to send message:', error);
    throw error;
  }
}
