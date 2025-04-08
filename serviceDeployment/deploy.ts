import { TwilioServerlessApiClient } from '@twilio-labs/serverless-api';
import twilio, { Twilio } from 'twilio';
import deployFunctions from './lib/deployFunctions';
import { createTaskRouterService } from './lib/createTaskRouter';
import { assignPhoneNumber } from './lib/assignPhoneNumber';

/**
 * Main deployment script that orchestrates the creation of the assistant,
 * its tools, knowledge bases, and optionally Voice Intelligence Service
 */
async function deploy() {
  // Validate environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error(
      'Missing required environment variables. Please check .env file.'
    );
  }

  console.log('Starting Service deployment...\n');

  const client: Twilio = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const serverlessClient = new TwilioServerlessApiClient({
    username: process.env.TWILIO_ACCOUNT_SID,
    password: process.env.TWILIO_AUTH_TOKEN,
  });

  try {
    console.log('Step 1: Deploy Task Router Service...');
    const taskRouterService = await createTaskRouterService(client);

    console.log('Step 2: Deploy Serverless Functions...');
    const result = await deployFunctions(serverlessClient);

    console.log('Step 3: Assign Phone Number...');
    await assignPhoneNumber(client);

    const variables = {
      TWILIO_SMS_FROM_NUMBER: process.env.TWILIO_SMS_FROM_NUMBER,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_WORKFLOW_SID: taskRouterService.workflow.sid,
      LIVE_HOST_URL: process.env.LIVE_HOST_URL,
    };

    await serverlessClient.setEnvironmentVariables({
      username: process.env.TWILIO_ACCOUNT_SID!,
      password: process.env.TWILIO_AUTH_TOKEN!,
      serviceSid: result.serviceSid,
      environment: result.environmentSid,
      env: variables,
      append: true,
    });
    console.log('✓ Deployment configuration completed successfully');

    // Deployment summary
    console.log('\n=== Deployment Summary ===');
    console.log('Functions Domain:', result.domain);
    console.log('Functions Service SID:', result.serviceSid);
    console.log('Functions Environment SID:', result.environmentSid);
    console.log('TaskRouter Workspace SID:', taskRouterService.workspace.sid);
    console.log('TaskRouter TaskQueue SID:', taskRouterService.taskQueue.sid);
    console.log('TaskRouter Workflow SID:', taskRouterService.workflow.sid);

    console.log('\nDeployment completed successfully! 🎉');
  } catch (error: any) {
    console.error('\n❌ Deployment failed:');
    console.error('Error:', error.message);

    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.status) {
      console.error('Status Code:', error.status);
    }

    console.log('\nTroubleshooting suggestions:');
    console.log('1. Check your Twilio credentials');
    console.log('2. Verify your account has AI Assistant access');
    console.log('3. Ensure all webhook URLs are valid');
    console.log('4. Check for any duplicate resource names');

    // Close readline interface
    throw error;
  }
}

// Add cleanup function for handling interruptions
process.on('SIGINT', async () => {
  console.log('\n\nReceived interrupt signal. Cleaning up...');
  process.exit(0);
});

// Run the deployment if this script is executed directly
if (require.main === module) {
  deploy()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nDeployment failed. See error details above.');
      process.exit(1);
    });
}

export default deploy;
