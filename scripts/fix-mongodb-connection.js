#!/usr/bin/env node

/**
 * Fix MongoDB Connection - Update .env.local with correct credentials
 */

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

// Parse URI for display
const uriMatch = mongodbUri.match(/mongodb\+srv?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
const username = uriMatch ? uriMatch[1] : 'unknown';
const cluster = uriMatch ? uriMatch[3] : 'unknown';
const database = uriMatch ? uriMatch[4] : 'unknown';

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
  // Write .env.local file
  fs.writeFileSync(envPath, envContent, 'utf8');
  
  console.log('✅ .env.local file updated successfully!');
  console.log('');
  console.log('📋 Configuration:');
  console.log(`   ✅ MongoDB URI: mongodb+srv://${username}:***@${cluster}/${database}`);
  console.log(`   ✅ JWT_SECRET: Generated`);
  console.log('');
  console.log('🔄 Testing connection...');
  console.log('');
  
  // Test the connection
  const mongoose = require('mongoose');
  
  mongoose.connect(mongodbUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
    .then(() => {
      console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
      console.log(`   Database: ${mongoose.connection.db.databaseName}`);
      console.log('');
      console.log('🎉 Everything is configured correctly!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Restart your dev server: pnpm dev');
      console.log('   2. Try logging in again');
      console.log('');
      mongoose.connection.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Connection test failed:');
      console.error('');
      const errorMsg = error.message || String(error);
      
      if (errorMsg.includes('authentication failed') || errorMsg.includes('bad auth')) {
        console.error('🔍 Issue: Authentication Failed');
        console.error('');
        console.error('Possible causes:');
        console.error('   1. Username or password is incorrect');
        console.error('   2. Database user doesn\'t exist in MongoDB Atlas');
        console.error('   3. Password was changed in MongoDB Atlas');
        console.error('   4. IP address not whitelisted');
        console.error('');
        console.error('🔧 How to fix:');
        console.error('   1. Go to https://cloud.mongodb.com/');
        console.error('   2. Check "Database Access" - verify user exists');
        console.error('   3. Check "Network Access" - whitelist your IP');
        console.error('   4. If password was changed, update it in MongoDB Atlas');
        console.error('');
      } else if (errorMsg.includes('timeout') || errorMsg.includes('serverSelectionTimeoutMS')) {
        console.error('🔍 Issue: Connection Timeout');
        console.error('');
        console.error('Your IP address may not be whitelisted.');
        console.error('');
        console.error('🔧 How to fix:');
        console.error('   1. Go to MongoDB Atlas → Network Access');
        console.error('   2. Click "Add IP Address"');
        console.error('   3. Add your current IP or use 0.0.0.0/0 (development only)');
        console.error('');
      } else {
        console.error('Error:', errorMsg);
        console.error('');
      }
      
      console.error('Full error:', error);
      console.error('');
      console.log('⚠️  .env.local was updated, but connection test failed.');
      console.log('   Please check the issues above and try again.');
      console.log('');
      process.exit(1);
    });
    
} catch (error) {
  console.error('❌ Error updating .env.local:', error.message);
  console.error('');
  console.log('Please manually update .env.local with:');
  console.log(`MONGODB_URI=${mongodbUri}`);
  console.log('');
  process.exit(1);
}














