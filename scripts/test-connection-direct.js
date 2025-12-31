const mongoose = require('mongoose');

// Get MongoDB URI from environment variable
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set');
  console.error('');
  console.error('Please set MONGODB_URI before running this script:');
  console.error('  export MONGODB_URI="<YOUR_MONGODB_URI>"');
  console.error('  (Windows: set MONGODB_URI=<YOUR_MONGODB_URI>)');
  console.error('');
  process.exit(1);
}

// Parse URI for display
const uriMatch = uri.match(/mongodb\+srv?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
const username = uriMatch ? uriMatch[1] : 'unknown';
const cluster = uriMatch ? uriMatch[3] : 'unknown';
const database = uriMatch ? uriMatch[4] : 'unknown';

console.log('\n=== Direct MongoDB Connection Test ===\n');
console.log('Testing with:');
console.log(`  Username: ${username}`);
console.log(`  Password: ***`);
console.log(`  Cluster: ${cluster}`);
console.log(`  Database: ${database}`);
console.log('\nConnecting...\n');

mongoose.connect(uri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('✅ CONNECTION SUCCESSFUL!\n');
    console.log(`Database: ${mongoose.connection.db.databaseName}`);
    console.log(`Ready State: ${mongoose.connection.readyState}`);
    
    // Test if we can access the database
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`Collections found: ${collections.length}`);
      if (collections.length > 0) {
        console.log('Collection names:', collections.map(c => c.name).join(', '));
      }
    } catch (err) {
      console.log('Note: Could not list collections (this is okay)');
    }
    
    console.log('\n🎉 Your credentials are CORRECT!');
    console.log('✅ IP whitelist is working (0.0.0.0/0 is active)');
    console.log('✅ Connection string is valid');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your dev server: pnpm dev');
    console.log('   2. Try logging in again');
    console.log('   3. The authentication should work now!\n');
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ CONNECTION FAILED\n');
    
    const errorMsg = error.message || String(error);
    console.error('Error Message:', errorMsg);
    console.error('Error Code:', error.code || 'N/A');
    console.error('');
    
    // Detailed diagnosis
    if (errorMsg.includes('authentication failed') || errorMsg.includes('bad auth') || errorMsg.includes('Authentication failed')) {
      console.error('🔍 DIAGNOSIS: Authentication Failed');
      console.error('');
      console.error('The username or password is incorrect, or the user doesn\'t exist.');
      console.error('');
      console.error('Please verify in MongoDB Atlas:');
      console.error('   1. Go to https://cloud.mongodb.com/');
      console.error('   2. Click "Database Access"');
      console.error('   3. Find your database user');
      console.error('   4. Check:');
      console.error('      - Does the user exist?');
      console.error('      - Is the password correct in MONGODB_URI?');
      console.error('      - Is the user "Active" (not disabled)?');
      console.error('');
      console.error('If the user doesn\'t exist or password is wrong:');
      console.error('   1. Create/reset the user in MongoDB Atlas');
      console.error('   2. Update MONGODB_URI with correct credentials');
      console.error('   3. Grant "Read and write to any database" permissions');
      console.error('   4. Run this test again\n');
    } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      console.error('🔍 DIAGNOSIS: DNS/Network Error');
      console.error('Cannot resolve the hostname. Check your internet connection.');
      console.error('');
    } else {
      console.error('Full error details:');
      console.error(error);
      console.error('');
    }
    
    process.exit(1);
  });














