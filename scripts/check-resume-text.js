/**
 * Diagnostic script to check if resume text is being saved correctly
 * 
 * Usage: node scripts/check-resume-text.js <userId>
 * 
 * This script will:
 * 1. Check if user has cv_filename (resume uploaded)
 * 2. Check if cv_text exists and its length
 * 3. Show diagnostic information
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide a user ID');
  console.log('Usage: node scripts/check-resume-text.js <userId>');
  process.exit(1);
}

async function checkResumeText() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const user = await User.findById(userId).select('cv_filename cv_text cv_uploaded_at email name').lean();

    if (!user) {
      console.error(`❌ User with ID ${userId} not found`);
      process.exit(1);
    }

    console.log('📋 User Information:');
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   User ID: ${userId}\n`);

    console.log('📄 Resume Information:');
    console.log(`   CV Filename: ${user.cv_filename || 'NOT SET'}`);
    console.log(`   CV Uploaded At: ${user.cv_uploaded_at || 'NOT SET'}`);
    console.log(`   CV Text Exists: ${user.cv_text ? 'YES' : 'NO'}`);
    
    if (user.cv_text) {
      const textLength = user.cv_text.length;
      const trimmedLength = user.cv_text.trim().length;
      console.log(`   CV Text Length: ${textLength} characters`);
      console.log(`   CV Text Length (trimmed): ${trimmedLength} characters`);
      console.log(`   CV Text Preview (first 200 chars):`);
      console.log(`   "${user.cv_text.substring(0, 200)}..."\n`);
      
      if (trimmedLength < 20) {
        console.log('⚠️  WARNING: CV text is too short (< 20 characters)');
        console.log('   This may indicate text extraction failed or the resume is image-based.\n');
      } else {
        console.log('✅ CV text looks good!\n');
      }
    } else {
      console.log('\n⚠️  WARNING: CV text is missing!');
      if (user.cv_filename) {
        console.log('   Resume file exists but text extraction may have failed.');
        console.log('   Possible reasons:');
        console.log('   - Image-based PDF (scanned document)');
        console.log('   - Text extraction error');
        console.log('   - File corruption\n');
      } else {
        console.log('   No resume file uploaded.\n');
      }
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkResumeText();














