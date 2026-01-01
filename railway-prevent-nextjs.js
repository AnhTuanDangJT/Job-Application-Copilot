#!/usr/bin/env node
/**
 * Railway Start Script - Prevents Next.js from Running
 * 
 * This script will exit with an error if Next.js is detected.
 * Railway should NEVER run Next.js frontend from this repository root.
 * 
 * Frontend must be deployed on Vercel only.
 * Backend must be in a separate directory or repository.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for Next.js installation...');

// Check if package.json exists and contains Next.js
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Check if next is a dependency
  const hasNext = packageJson.dependencies?.next || packageJson.devDependencies?.next;
  
  if (hasNext) {
    console.error('');
    console.error('❌ ERROR: Next.js detected in package.json');
    console.error('');
    console.error('Railway should NOT run Next.js frontend.');
    console.error('Frontend must be deployed on Vercel only.');
    console.error('Backend must be in a separate directory or repository.');
    console.error('');
    console.error('To fix this:');
    console.error('1. Ensure Railway root directory points to a backend folder (e.g., /backend)');
    console.error('2. Do NOT point Railway to the repository root');
    console.error('3. Frontend should be deployed separately on Vercel');
    console.error('');
    process.exit(1);
  }
}

// Check if next.config.* exists
const nextConfigFiles = [
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'next.config.cjs'
];

for (const configFile of nextConfigFiles) {
  if (fs.existsSync(path.join(process.cwd(), configFile))) {
    console.error('');
    console.error(`❌ ERROR: ${configFile} file detected`);
    console.error('');
    console.error('Railway should NOT run Next.js frontend.');
    console.error('Frontend must be deployed on Vercel only.');
    console.error('');
    process.exit(1);
  }
}

// Check if src/app directory exists (Next.js App Router)
if (fs.existsSync(path.join(process.cwd(), 'src', 'app'))) {
  console.error('');
  console.error('❌ ERROR: Next.js src/app directory detected');
  console.error('');
  console.error('Railway should NOT run Next.js frontend.');
  console.error('Frontend must be deployed on Vercel only.');
  console.error('');
  process.exit(1);
}

// Check if pages directory exists (Next.js Pages Router)
if (fs.existsSync(path.join(process.cwd(), 'pages'))) {
  console.error('');
  console.error('❌ ERROR: Next.js pages directory detected');
  console.error('');
  console.error('Railway should NOT run Next.js frontend.');
  console.error('Frontend must be deployed on Vercel only.');
  console.error('');
  process.exit(1);
}

console.log('✅ Next.js check passed. No Next.js detected in this directory.');
console.log('Proceeding with backend deployment...');


