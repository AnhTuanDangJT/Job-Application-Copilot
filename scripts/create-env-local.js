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
  console.error('  export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/database"');
  console.error('  (Windows: set MONGODB_URI=...)');
  console.error('');
  process.exit(1);
}

// Generate secure JWT secret
const jwtSecret = crypto.randomBytes(32).toString('base64');

// Create .env.local content
const envContent = `NEXT_PUBLIC_APP_NAME=Job Application Copilot
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
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ SUCCESS: .env.local file created!');
  console.log('');
  console.log('📋 Configuration:');
  console.log('   ✅ MongoDB Atlas URI configured');
  console.log('   ✅ JWT_SECRET generated');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Make sure your IP is whitelisted in MongoDB Atlas');
  console.log('      → Go to Network Access in MongoDB Atlas');
  console.log('      → Add your IP address (or 0.0.0.0/0 for development)');
  console.log('');
  console.log('   2. Restart your dev server:');
  console.log('      → Stop the current server (Ctrl+C)');
  console.log('      → Run: pnpm dev');
  console.log('');
  console.log('   3. Test the login again');
  console.log('');
  process.exit(0);
} catch (error) {
  console.error('❌ ERROR creating .env.local:', error.message);
  console.log('');
  console.log('Please manually create .env.local with this content:');
  console.log('');
  console.log(envContent);
  process.exit(1);
}














