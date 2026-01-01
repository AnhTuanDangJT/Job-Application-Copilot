#!/bin/bash
# Script to prevent Next.js from running on Railway
# This script will fail if Next.js is detected

echo "Checking for Next.js installation..."

# Check if next is in package.json
if [ -f "package.json" ] && grep -q '"next"' package.json; then
    echo "ERROR: Next.js detected in package.json"
    echo "Railway should NOT run Next.js frontend."
    echo "Frontend must be deployed on Vercel only."
    echo "Backend must be in a separate directory."
    exit 1
fi

# Check if next.config.* exists
if ls next.config.* 1> /dev/null 2>&1; then
    echo "ERROR: next.config.* file detected"
    echo "Railway should NOT run Next.js frontend."
    echo "Frontend must be deployed on Vercel only."
    exit 1
fi

# Check if src/app directory exists (Next.js App Router)
if [ -d "src/app" ]; then
    echo "ERROR: Next.js src/app directory detected"
    echo "Railway should NOT run Next.js frontend."
    echo "Frontend must be deployed on Vercel only."
    exit 1
fi

echo "Next.js check passed. Proceeding with backend deployment..."


