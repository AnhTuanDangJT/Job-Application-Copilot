const mongoose = require('mongoose');

const username = 'dganhtuan2k5_db_user';
const password = 'Johnnytext12345';
const cluster = 'cluster0.8wwd3vo.mongodb.net';
const database = 'job_app_copilot';

const uri = `mongodb+srv://${username}:${password}@${cluster}/${database}?retryWrites=true&w=majority&appName=Cluster0`;

console.log('\n=== Testing MongoDB Atlas Connection ===\n');
console.log('Username:', username);
console.log('Password:', '***' + password.slice(-2));
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
      console.error('  3. Find user: dganhtuan2k5_db_user');
      console.error('  4. Verify the password is: Johnnytext12345');
      console.error('  5. If wrong, either:');
      console.error('     - Reset password in MongoDB Atlas');
      console.error('     - Or update .env.local with correct password');
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














