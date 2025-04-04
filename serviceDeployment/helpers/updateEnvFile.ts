import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

export const updateEnvFile = (key: string, value: string): void => {
  const envFilePath = '.env';
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  const envLines = envContent.split('\n');

  // Check if key already exists
  const keyIndex = envLines.findIndex((line) => line.startsWith(`${key}=`));

  if (keyIndex !== -1) {
    // Update existing key
    envLines[keyIndex] = `${key}=${value}`;
  } else {
    // Add new key
    envLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFilePath, envLines.join('\n'));
  console.log(`✓ Updated .env file with ${key}`);
};
