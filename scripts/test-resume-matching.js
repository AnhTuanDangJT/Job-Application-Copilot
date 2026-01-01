/**
 * Automated Test Script for Resume-Based Job Matching
 * 
 * Run this script to verify the implementation:
 * node scripts/test-resume-matching.js
 * 
 * Prerequisites:
 * - Application must be running on http://localhost:3000
 * - MongoDB must be connected
 * - Test user must exist (or create one)
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  email: 'test@example.com',
  password: 'testpassword123',
  authToken: null,
};

/**
 * Helper function to make authenticated requests
 */
async function authenticatedFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (TEST_CONFIG.authToken) {
    headers['Cookie'] = `auth_token=${TEST_CONFIG.authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  return response;
}

/**
 * Test 1: Check if resume text endpoint works
 */
async function testResumeTextEndpoint() {
  console.log('\n📋 Test 1: GET /api/user/resume-text');
  
  try {
    const response = await authenticatedFetch('/api/user/resume-text');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Endpoint accessible');
      console.log(`   Success: ${data.success}`);
      console.log(`   Text length: ${data.text ? data.text.length : 0} characters`);
      return data;
    } else {
      console.log('❌ Endpoint returned error:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return null;
  }
}

/**
 * Test 2: Check if job matching endpoint works
 */
async function testJobMatchingEndpoint(resumeText) {
  console.log('\n📋 Test 2: POST /api/jobs/match');
  
  if (!resumeText) {
    console.log('⚠️  Skipping: No resume text available');
    return null;
  }

  try {
    const response = await authenticatedFetch('/api/jobs/match', {
      method: 'POST',
      body: JSON.stringify({
        resumeText: resumeText.substring(0, 1000), // Use first 1000 chars for testing
        searchQuery: '',
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Endpoint accessible');
      console.log(`   Jobs returned: ${data.jobs?.length || 0}`);
      
      if (data.jobs && data.jobs.length > 0) {
        const scores = data.jobs.map(j => j.matchScore).filter(s => s > 0);
        if (scores.length > 0) {
          console.log(`   Match scores: ${scores.slice(0, 5).join(', ')}...`);
          console.log(`   Highest score: ${Math.max(...scores)}`);
          console.log(`   Lowest score: ${Math.min(...scores)}`);
        }
      }
      
      return data;
    } else {
      console.log('❌ Endpoint returned error:', response.status);
      console.log('   Error:', data.error || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return null;
  }
}

/**
 * Test 3: Check if job list endpoint works
 */
async function testJobListEndpoint() {
  console.log('\n📋 Test 3: GET /api/jobs/list');
  
  try {
    const response = await authenticatedFetch('/api/jobs/list');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Endpoint accessible');
      console.log(`   Jobs returned: ${data.jobs?.length || 0}`);
      return data;
    } else {
      console.log('❌ Endpoint returned error:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return null;
  }
}

/**
 * Test 4: Verify error handling
 */
async function testErrorHandling() {
  console.log('\n📋 Test 4: Error Handling');
  
  // Test with invalid resume text
  try {
    const response = await authenticatedFetch('/api/jobs/match', {
      method: 'POST',
      body: JSON.stringify({
        resumeText: '', // Empty text
        searchQuery: '',
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Handles empty resume text gracefully');
      console.log(`   Jobs returned: ${data.jobs?.length || 0}`);
    } else {
      console.log('⚠️  Endpoint returned error (expected for empty text):', response.status);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Resume-Based Job Matching - Automated Tests');
  console.log('=' .repeat(50));
  console.log(`Testing against: ${BASE_URL}`);
  console.log('\n⚠️  Note: This script tests API endpoints only.');
  console.log('   For full UI testing, use the manual checklist in TESTING_CHECKLIST.md\n');

  // Test resume text endpoint
  const resumeData = await testResumeTextEndpoint();
  const resumeText = resumeData?.text || null;

  // Test job matching endpoint (if resume exists)
  await testJobMatchingEndpoint(resumeText);

  // Test job list endpoint
  await testJobListEndpoint();

  // Test error handling
  await testErrorHandling();

  console.log('\n' + '='.repeat(50));
  console.log('✅ Tests completed!');
  console.log('\nFor complete testing, refer to TESTING_CHECKLIST.md');
}

// Run tests if executed directly
if (require.main === module) {
  // Check if fetch is available (Node 18+)
  if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ with native fetch support');
    console.error('   Or install node-fetch: npm install node-fetch');
    process.exit(1);
  }

  runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testResumeTextEndpoint, testJobMatchingEndpoint, testJobListEndpoint };















