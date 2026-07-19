import { spawn } from 'child_process';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting server for API testing...');
  
  const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    stdio: 'pipe',
    env: { ...process.env, PORT: '3000', NODE_ENV: 'production' }
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  // Wait for server to start
  await delay(3000);

  console.log('\\n--- Testing API Endpoints ---');
  let allPassed = true;
  
  try {
    // Test 1: Public Listings Endpoint
    console.log('1. Testing GET /api/listings ...');
    const listingsRes = await fetch('http://localhost:3000/api/listings');
    if (!listingsRes.ok) throw new Error(`HTTP Error: ${listingsRes.status}`);
    const listingsData = await listingsRes.json();
    console.log(`   ✅ Success. Found ${listingsData.listings?.length || 0} listings.`);

    // Test 2: AI Match Endpoint (Recommendation Engine)
    console.log('2. Testing POST /api/ai/match ...');
    const aiRes = await fetch('http://localhost:3000/api/ai/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: { budget: 1500, location: "Bali", durationMonths: 1, needsWifi: true, allowsPets: false }
      })
    });
    if (!aiRes.ok) throw new Error(`HTTP Error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    console.log(`   ✅ Success. AI suggested ${aiData.recommendations?.length || 0} matching properties.`);

    // Test 3: Demo Auth Endpoint (Should return a token)
    console.log('3. Testing POST /api/auth/demo ...');
    const authRes = await fetch('http://localhost:3000/api/auth/demo', { method: 'POST' });
    if (!authRes.ok) throw new Error(`HTTP Error: ${authRes.status}`);
    const authData = await authRes.json();
    console.log(`   ✅ Success. Logged in as: ${authData.user?.name || 'Demo User'}`);

  } catch (error) {
    console.error('❌ API Test Failed:', error);
    allPassed = false;
  } finally {
    console.log('\\nShutting down server...');
    serverProcess.kill('SIGINT');
  }

  if (allPassed) {
    console.log('🎉 All API endpoint tests passed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️ Some API tests failed.');
    process.exit(1);
  }
}

runTests();
