#!/usr/bin/env node
/**
 * Generate random secrets for JWT_SECRET and NEXTAUTH_SECRET
 * Run: node generate-secrets.js
 */

const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(32).toString('base64');
}

console.log('🔐 Generate secrets for Vercel environment variables\n');
console.log('Copy these values to your Vercel environment variables:\n');
console.log('JWT_SECRET=' + generateSecret());
console.log('NEXTAUTH_SECRET=' + generateSecret());
console.log('\n✅ Generated two unique secrets');
console.log('📋 Copy each one to Vercel dashboard → Settings → Environment Variables');


