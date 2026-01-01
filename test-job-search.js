// Quick test script to test job search endpoint
// Run with: node test-job-search.js

const testJobSearch = async () => {
  try {
    console.log('🧪 Testing Job Search Endpoint...\n');
    
    // Test data - similar to what frontend sends
    const testData = {
      skills: ["JavaScript", "React"],
      query: "",
      resumeText: ""
    };

    console.log('📤 Sending request with:');
    console.log('   Skills:', testData.skills);
    console.log('   Query:', testData.query || '(empty)');
    console.log('   Resume text length:', testData.resumeText.length);
    console.log('\n');

    // Note: This requires authentication, so we'll just show the structure
    // In a real test, you'd need to login first and get a cookie
    console.log('⚠️  Note: This endpoint requires authentication.');
    console.log('    Check the backend logs in your terminal where "npm run dev" is running');
    console.log('    when you perform a job search from the web UI.\n');
    
    console.log('📋 To test:');
    console.log('   1. Open http://localhost:3000 in your browser');
    console.log('   2. Login to your account');
    console.log('   3. Go to Jobs page');
    console.log('   4. Upload a resume or search for jobs');
    console.log('   5. Check your terminal for [JOB SEARCH] logs\n');
    
    console.log('🔍 Or test Remotive API directly:');
    console.log('   Run: curl "https://remotive.com/api/remote-jobs?search=JavaScript&limit=5"\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testJobSearch();












