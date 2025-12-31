const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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

// Parse URI for display
const uriMatch = mongodbUri.match(/mongodb\+srv?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
const username = uriMatch ? uriMatch[1] : 'unknown';
const database = uriMatch ? uriMatch[4] : 'unknown';

console.log('\n=== Updating .env.local and Testing Connection ===\n');

// Step 1: Read existing .env.local or create new
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('✅ Found existing .env.local');
} else {
  envContent = `NEXT_PUBLIC_APP_NAME=Job Application Copilot
NEXTAUTH_SECRET=changeme-in-prod
MONGODB_URI=
JWT_SECRET=replace-with-strong-secret
JWT_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_CHROMIUM_PATH=
`;
  console.log('📝 Created new .env.local template');
}

// Step 2: Update MONGODB_URI
const jwtSecret = require('crypto').randomBytes(32).toString('base64');
envContent = envContent.replace(/MONGODB_URI=.*/m, `MONGODB_URI=${mongodbUri}`);
envContent = envContent.replace(/JWT_SECRET=.*/m, `JWT_SECRET=${jwtSecret}`);

// Step 3: Write updated .env.local
fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ Updated .env.local with MongoDB connection string');
console.log(`   Username: ${username}`);
console.log(`   Password: ***`);
console.log(`   Database: ${database}`);
console.log('');

// Step 4: Test connection
console.log('🔄 Testing MongoDB connection...\n');

mongoose.connect(mongodbUri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('✅ CONNECTION SUCCESSFUL!\n');
    console.log(`Database: ${mongoose.connection.db.databaseName}`);
    console.log(`Ready State: ${mongoose.connection.readyState}`);
    
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`Collections: ${collections.length} found`);
    } catch (err) {
      // Ignore
    }
    
    console.log('\n🎉 Everything is working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your dev server: pnpm dev');
    console.log('   2. Try logging in');
    console.log('   3. Authentication should work now!\n');
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ CONNECTION TEST FAILED\n');
    const errorMsg = error.message || String(error);
    
    console.error('Error:', errorMsg);
    console.error('');
    
    if (errorMsg.includes('authentication failed') || errorMsg.includes('bad auth')) {
      console.error('🔍 DIAGNOSIS: Authentication Failed');
      console.error('');
      console.error('The password is incorrect. Please:');
      console.error('');
      console.error('1. Go to MongoDB Atlas → Database Access');
      console.error('2. Verify your database user exists');
      console.error('3. Update MONGODB_URI with correct credentials');
      console.error('4. Run this script again: node scripts/update-password-and-test.js');
      console.error('');
    } else if (errorMsg.includes('timeout')) {
      console.error('🔍 Connection timeout (IP should be whitelisted already)');
      console.error('   Try again in a moment');
    } else {
      console.error('Full error:', error);
    }
    
    console.error('\n⚠️  .env.local was updated, but connection failed.');
    console.error('   Please reset the password in MongoDB Atlas and try again.\n');
    process.exit(1);
  });














