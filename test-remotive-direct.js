// Direct test of Remotive API (no auth needed)
// Run with: node test-remotive-direct.js

const testRemotiveDirect = async () => {
  try {
    console.log('🧪 Testing Remotive API Directly...\n');
    
    const testQueries = [
      "JavaScript",
      "Java developer",
      "software engineer"
    ];

    for (const query of testQueries) {
      console.log(`\n📤 Testing query: "${query}"`);
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=5`;
      console.log(`   URL: ${url}\n`);

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`   ❌ Error: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const jobs = data.jobs || [];
      
      console.log(`   ✅ Received ${jobs.length} jobs`);
      console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
      
      if (jobs.length > 0) {
        console.log(`   📋 First job: ${jobs[0].title} at ${jobs[0].company_name}`);
      } else {
        console.log(`   ⚠️  No jobs returned for this query`);
      }
    }

    console.log('\n\n✅ Remotive API test complete!');
    console.log('   If Remotive returns jobs here but not in the app,');
    console.log('   the issue is likely with query construction or authentication.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }
};

testRemotiveDirect();












