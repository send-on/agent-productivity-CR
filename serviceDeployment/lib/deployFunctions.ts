import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import pkgJson from '../../package.json';
import {
  TwilioServerlessApiClient,
  DeployResult,
} from '@twilio-labs/serverless-api';
import { updateEnvFile } from '../helpers/updateEnvFile';
import { kebab } from '../helpers/kebab';

/**
 * Get the environment variables from the project
 * @returns {Promise<Record<string, string>>}
 */
async function getEnvironmentVariables(): Promise<Record<string, string>> {
  const envContents = await fs.readFile(
    path.resolve(process.cwd(), '.env'),
    'utf-8'
  );
  const variables = dotenv.parse(envContents);

  // removing these variables since Functions will automatically insert them
  delete variables.TWILIO_ACCOUNT_SID;
  delete variables.TWILIO_AUTH_TOKEN;

  // removing because it's not necessary for the deployed functions
  if (variables.NGROK_URL) {
    delete variables.NGROK_URL;
  }

  if (variables.SERVICE_NAME) {
    delete variables.NGROK_URL;
  }

  // removing because it's not necessary for the deployed functions
  if (variables.FUNCTIONS_DOMAIN) {
    delete variables.FUNCTIONS_DOMAIN;
  }

  for (const key in variables) {
    if (!variables[key]) {
      delete variables[key];
    }
  }

  return variables;
}

/**
 * Deploys the Twilio Functions backend
 * @param {TwilioServerlessApiClient} serverlessClient
 * @returns {Promise<DeployResult>}
 */
async function deployFunctions(
  serverlessClient: TwilioServerlessApiClient
): Promise<DeployResult> {
  serverlessClient.on('status-update', (evt) => {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`  ${evt.message}`);
  });

  console.log('Deploying Serverless Functions...');

  const result = await serverlessClient.deployLocalProject({
    cwd: process.cwd(),
    serviceName: kebab(process.env.SERVICE_NAME || 'Placeholder Service Name'),
    functionsEnv: 'dev',
    username: process.env.TWILIO_ACCOUNT_SID || '',
    password: process.env.TWILIO_AUTH_TOKEN || '',
    env: await getEnvironmentVariables(),
    uiEditable: true,
    overrideExistingService: true,
    pkgJson: {
      dependencies: pkgJson.dependencies,
    },
    envPath: '',
    functionsFolderName: 'dist/functions/serverless',
  });

  // Save Functions domain to .env
  updateEnvFile('FUNCTIONS_DOMAIN', result.domain);

  console.log('Deploying Serverless Functions Finished Successfully');

  return result;
}

export default deployFunctions;
