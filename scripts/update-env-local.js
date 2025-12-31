#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(process.cwd(), '.env.local');
const examplePath = path.join(process.cwd(), 'config', 'env.example');

// Get MongoDB URI from environment variable
const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set');
  console.error('');
  console.error('Please set MONGODB_URI before running this script:');
  console.error('  export MONGODB_URI="<YOUR_MONGODB_URI>"');
  console.error('  (Windows: set MONGODB_URI=<YOUR_MONGODB_URI>)');
  console.error('');
  process.exit(1);
}

// Generate a secure JWT secret
const jwtSecret = crypto.randomBytes(32).toString('base64');

let content = '';

// Read example file or create default content
if (fs.existsSync(examplePath)) {
  content = fs.readFileSync(examplePath, 'utf8');
} else {
  content = `NEXT_PUBLIC_APP_NAME=Job Application Copilot
NEXTAUTH_SECRET=changeme-in-prod
MONGODB_URI=mongodb://localhost:27017/job_app_copilot
JWT_SECRET=replace-with-strong-secret
JWT_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_CHROMIUM_PATH=
`;
}

// Update MONGODB_URI
if (content.includes('MONGODB_URI=')) {
  content = content.replace(/MONGODB_URI=.*/m, `MONGODB_URI=${mongodbUri}`);
} else {
  content = `MONGODB_URI=${mongodbUri}\n${content}`;
}

// Update JWT_SECRET if it's still the default
if (content.includes('JWT_SECRET=replace-with-strong-secret')) {
  content = content.replace(/JWT_SECRET=.*/m, `JWT_SECRET=${jwtSecret}`);
}

// Write .env.local file
fs.writeFileSync(envPath, content, 'utf8');

console.log('✅ .env.local file created/updated successfully!');
console.log(`✅ MongoDB Atlas URI configured`);
console.log(`✅ JWT_SECRET generated: ${jwtSecret.substring(0, 20)}...`);
console.log('\nNext steps:');
console.log('1. Make sure your IP is whitelisted in MongoDB Atlas (Network Access)');
console.log('2. Restart your dev server: pnpm dev');
console.log('3. Test login again\n');














