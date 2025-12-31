#!/usr/bin/env node

/**
 * MongoDB Atlas Connection Test Script
 * Tests the connection string and provides diagnostic information
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

console.log('\n=== MongoDB Atlas Connection Test ===\n');

if (!uri) {
  console.error('❌ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

// Parse and mask URI for logging
const uriMatch = uri.match(/mongodb\+srv?:\/\/([^:]+):([^@]+)@(.+)/);
if (uriMatch) {
  const [, username, password, rest] = uriMatch;
  console.log('📋 Connection String Details:');
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password ? '***' + password.slice(-2) : 'MISSING'}`);
  console.log(`   Host: ${rest.split('/')[0]}`);
  console.log(`   Database: ${rest.includes('/') ? rest.split('/')[1].split('?')[0] : 'DEFAULT'}`);
  console.log('');
}

console.log('🔄 Attempting to connect...\n');

mongoose.connect(uri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log(`   Ready State: ${mongoose.connection.readyState}`);
    console.log('');
    console.log('✅ Your credentials are correct!');
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ CONNECTION FAILED\n');
    
    const errorMsg = error.message || String(error);
    
    console.error('Error Details:');
    console.error(`   Message: ${errorMsg}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error('');
    
    // Provide specific guidance based on error
    if (errorMsg.includes('authentication failed') || errorMsg.includes('bad auth')) {
      console.error('🔍 DIAGNOSIS: Authentication Failed');
      console.error('');
      console.error('Possible causes:');
      console.error('   1. ❌ Wrong username or password');
      console.error('   2. ❌ Password contains special characters that need URL encoding');
      console.error('   3. ❌ Database user was deleted or password changed');
      console.error('');
      console.error('🔧 HOW TO FIX:');
      console.error('');
      console.error('1. Go to MongoDB Atlas: https://cloud.mongodb.com/');
      console.error('2. Navigate to "Database Access"');
      console.error('3. Verify your database user exists and credentials are correct');
      console.error('4. Check the username and password in MONGODB_URI');
      console.error('5. If password has special characters, URL encode them:');
      console.error('   - @ becomes %40');
      console.error('   - # becomes %23');
      console.error('   - $ becomes %24');
      console.error('   - % becomes %25');
      console.error('   - & becomes %26');
      console.error('   - + becomes %2B');
      console.error('   - / becomes %2F');
      console.error('   - = becomes %3D');
      console.error('   - ? becomes %3F');
      console.error('');
      console.error('6. Update MONGODB_URI in .env.local with correct credentials');
      console.error('');
    } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      console.error('🔍 DIAGNOSIS: Cannot resolve hostname');
      console.error('   Check your cluster hostname in the connection string');
      console.error('');
    } else if (errorMsg.includes('timeout') || errorMsg.includes('serverSelectionTimeoutMS')) {
      console.error('🔍 DIAGNOSIS: Connection Timeout');
      console.error('   Your IP address may not be whitelisted in MongoDB Atlas');
      console.error('');
      console.error('🔧 HOW TO FIX:');
      console.error('1. Go to MongoDB Atlas: https://cloud.mongodb.com/');
      console.error('2. Navigate to "Network Access"');
      console.error('3. Click "Add IP Address"');
      console.error('4. Add your current IP or use 0.0.0.0/0 (for development only)');
      console.error('');
    } else {
      console.error('🔍 Check the error message above for specific issues');
      console.error('');
    }
    
    console.error('Full error:');
    console.error(error);
    console.error('');
    process.exit(1);
  });

// Handle process termination
process.on('SIGINT', () => {
  mongoose.connection.close();
  process.exit(0);
});














