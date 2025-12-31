const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(process.cwd(), '.env.local');

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

const jwtSecret = crypto.randomBytes(32).toString('base64');

const content = `NEXT_PUBLIC_APP_NAME=Job Application Copilot
NEXTAUTH_SECRET=changeme-in-prod
MONGODB_URI=${mongodbUri}
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_CHROMIUM_PATH=
`;

try {
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('✅ .env.local file created/updated successfully!');
  console.log(`✅ MongoDB URI: ${mongodbUri.substring(0, 50)}...`);
  console.log(`✅ JWT_SECRET generated`);
  console.log('\n📋 Please restart your dev server now:');
  console.log('   1. Stop current server (Ctrl+C)');
  console.log('   2. Run: pnpm dev');
  console.log('   3. Test login again\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}














