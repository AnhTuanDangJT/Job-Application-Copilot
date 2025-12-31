#!/usr/bin/env node

/**
 * MongoDB Atlas Setup Helper
 * This script helps configure .env.local with MongoDB Atlas connection string
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n=== MongoDB Atlas Configuration Helper ===\n');
  
  const envPath = path.join(process.cwd(), '.env.local');
  const examplePath = path.join(process.cwd(), 'config', 'env.example');
  
  // Read or create .env.local
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('Found existing .env.local file\n');
  } else if (fs.existsSync(examplePath)) {
    envContent = fs.readFileSync(examplePath, 'utf8');
    console.log('Created .env.local from template\n');
  } else {
    console.error('Error: Could not find config/env.example');
    process.exit(1);
  }
  
  console.log('To set up MongoDB Atlas, you need:');
  console.log('1. Your MongoDB Atlas username');
  console.log('2. Your MongoDB Atlas password');
  console.log('3. Your cluster hostname (e.g., cluster0.xxxxx.mongodb.net)');
  console.log('\nYou can find these in MongoDB Atlas:');
  console.log('- Go to https://cloud.mongodb.com/');
  console.log('- Click "Connect" on your cluster');
  console.log('- Choose "Drivers" option');
  console.log('- Copy the connection string\n');
  
  const useAtlas = await question('Do you want to configure MongoDB Atlas now? (yes/no): ');
  
  if (useAtlas.toLowerCase() === 'yes' || useAtlas.toLowerCase() === 'y') {
    const username = await question('Enter MongoDB Atlas username: ');
    const password = await question('Enter MongoDB Atlas password: ');
    const cluster = await question('Enter cluster hostname (e.g., cluster0.xxxxx.mongodb.net): ');
    
    // Build MongoDB Atlas URI
    const mongodbUri = `mongodb+srv://${username}:${password}@${cluster}/job_app_copilot?retryWrites=true&w=majority`;
    
    // Update MONGODB_URI in envContent
    if (envContent.includes('MONGODB_URI=')) {
      envContent = envContent.replace(
        /MONGODB_URI=.*/,
        `MONGODB_URI=${mongodbUri}`
      );
    } else {
      envContent += `\nMONGODB_URI=${mongodbUri}\n`;
    }
    
    console.log('\n✅ MongoDB Atlas URI configured!');
  } else {
    console.log('\nSkipping MongoDB Atlas configuration.');
    console.log('You can manually edit .env.local later.');
  }
  
  // Generate JWT_SECRET if it's still the default
  if (envContent.includes('JWT_SECRET=replace-with-strong-secret')) {
    const crypto = require('crypto');
    const jwtSecret = crypto.randomBytes(32).toString('base64');
    envContent = envContent.replace(
      /JWT_SECRET=replace-with-strong-secret/,
      `JWT_SECRET=${jwtSecret}`
    );
    console.log('✅ Generated a secure JWT_SECRET');
  }
  
  // Write .env.local
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('\n✅ .env.local file updated successfully!');
  console.log('\nNext steps:');
  console.log('1. Make sure your IP is whitelisted in MongoDB Atlas (Network Access)');
  console.log('2. Restart your dev server: pnpm dev');
  console.log('3. Test the connection\n');
  
  rl.close();
}

main().catch((error) => {
  console.error('Error:', error.message);
  rl.close();
  process.exit(1);
});














