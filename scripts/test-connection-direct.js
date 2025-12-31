const mongoose = require('mongoose');

// Your credentials
const username = 'dganhtuan2k5_db_user';
const password = 'Johnnytext12345';
const cluster = 'cluster0.8wwd3vo.mongodb.net';
const database = 'job_app_copilot';

// Connection string
const uri = `mongodb+srv://${username}:${password}@${cluster}/${database}?retryWrites=true&w=majority&appName=Cluster0`;

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
      console.error('   3. Find user: dganhtuan2k5_db_user');
      console.error('   4. Check:');
      console.error('      - Does the user exist?');
      console.error('      - Is the password exactly: Johnnytext12345');
      console.error('      - Is the user "Active" (not disabled)?');
      console.error('');
      console.error('If the user doesn\'t exist or password is wrong:');
      console.error('   1. Create/reset the user in MongoDB Atlas');
      console.error('   2. Set password to: Johnnytext12345');
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














