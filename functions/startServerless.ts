import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const port = process.env.SERVERLESS_PORT || '3000';

const command = `twilio-run --functions-folder dist/functions/serverless --assets-folder dist/functions/assets --port ${port}`;

console.log(`Starting Twilio Functions on port ${port}...`);
execSync(command, { stdio: 'inherit' });
