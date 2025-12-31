const mongoose = require('mongoose');

// Get MongoDB URI from environment variable
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set');
  console.error('');
  console.error('Please set MONGODB_URI before running this script:');
  console.error('  export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/database"');
  console.error('  (Windows: set MONGODB_URI=...)');
  console.error('');
  process.exit(1);
}

// Parse URI for display
const uriMatch = uri.match(/mongodb\+srv?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
const username = uriMatch ? uriMatch[1] : 'unknown';
const cluster = uriMatch ? uriMatch[3] : 'unknown';
const database = uriMatch ? uriMatch[4] : 'unknown';

console.log('\n=== Testing MongoDB Atlas Connection ===\n');
console.log('Username:', username);
console.log('Password:', '***');
console.log('Cluster:', cluster);
console.log('Database:', database);
console.log('\nConnecting...\n');

mongoose.connect(uri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('Database:', mongoose.connection.db.databaseName);
    console.log('Ready State:', mongoose.connection.readyState);
    console.log('\n🎉 Your credentials are CORRECT!');
    console.log('\nThe connection string is working. The issue might be:');
    console.log('  1. IP address not whitelisted in MongoDB Atlas');
    console.log('  2. Server needs to be restarted to pick up new .env.local');
    console.log('\nNext steps:');
    console.log('  1. Make sure your IP is whitelisted in MongoDB Atlas');
    console.log('  2. Restart your dev server: pnpm dev');
    console.log('  3. Try logging in again\n');
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ CONNECTION FAILED\n');
    const errorMsg = error.message || String(error);
    console.error('Error:', errorMsg);
    console.error('');
    
    if (errorMsg.includes('authentication failed') || errorMsg.includes('bad auth')) {
      console.error('🔍 DIAGNOSIS: Authentication Failed');
      console.error('');
      console.error('This means:');
      console.error('  ❌ Username or password is incorrect');
      console.error('  ❌ OR database user doesn\'t exist');
      console.error('  ❌ OR password was changed in MongoDB Atlas');
      console.error('');
      console.error('🔧 HOW TO FIX:');
      console.error('  1. Go to https://cloud.mongodb.com/');
      console.error('  2. Click "Database Access"');
      console.error('  3. Verify your database user exists and password is correct');
      console.error('  4. Update MONGODB_URI with correct credentials');
      console.error('');
    } else if (errorMsg.includes('timeout') || errorMsg.includes('serverSelectionTimeoutMS')) {
      console.error('🔍 DIAGNOSIS: Connection Timeout');
      console.error('');
      console.error('Your IP address is likely not whitelisted.');
      console.error('');
      console.error('🔧 HOW TO FIX:');
      console.error('  1. Go to https://cloud.mongodb.com/');
      console.error('  2. Click "Network Access"');
      console.error('  3. Click "Add IP Address"');
      console.error('  4. Add your current IP or use 0.0.0.0/0 (dev only)');
      console.error('  5. Wait 1-2 minutes for changes to take effect');
      console.error('');
    } else {
      console.error('Full error details:');
      console.error(error);
      console.error('');
    }
    
    process.exit(1);
  });














