const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

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

// Generate JWT secret
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

console.log('\n=== Setting Up MongoDB Connection ===\n');

// Step 1: Update .env.local
try {
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ Step 1: .env.local file updated');
  console.log(`   MongoDB URI configured from environment variable`);
  console.log(`   JWT_SECRET generated`);
} catch (error) {
  console.error('❌ Error updating .env.local:', error.message);
  process.exit(1);
}

// Step 2: Test connection
console.log('\n🔄 Step 2: Testing MongoDB connection...\n');

mongoose.connect(mongodbUri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ Step 2: Connection successful!');
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log(`   Ready State: ${mongoose.connection.readyState}`);
    console.log('\n🎉 SUCCESS! Everything is configured correctly!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart your dev server: pnpm dev');
    console.log('   2. Try logging in again');
    console.log('   3. The authentication error should be fixed!\n');
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.log('⚠️  Step 2: Connection test failed\n');
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('authentication failed') || errorMsg.includes('bad auth')) {
      console.log('🔍 Issue: Authentication Failed');
      console.log('\nThe username or password might be incorrect.');
      console.log('Please verify in MongoDB Atlas:');
      console.log('   1. Go to https://cloud.mongodb.com/');
      console.log('   2. Click "Database Access"');
      console.log('   3. Verify your database user exists and password is correct');
      console.log('   4. Update MONGODB_URI in your environment if needed\n');
    } else if (errorMsg.includes('timeout') || errorMsg.includes('serverSelectionTimeoutMS')) {
      console.log('🔍 Issue: Connection Timeout');
      console.log('\nYour IP address is likely not whitelisted.');
      console.log('\nFix:');
      console.log('   1. Go to MongoDB Atlas → Network Access');
      console.log('   2. Click "Add IP Address"');
      console.log('   3. Add your IP or use 0.0.0.0/0 (development only)');
      console.log('   4. Wait 1-2 minutes, then restart server\n');
    } else {
      console.log('Error:', errorMsg);
      console.log('\nFull error:', error);
    }
    
    console.log('\n✅ .env.local was updated successfully');
    console.log('   The connection test failed, but the file is configured correctly.');
    console.log('   Please check the issues above and restart your server.\n');
    process.exit(1);
  });














