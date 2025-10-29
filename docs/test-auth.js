// Test script to verify playground API credentials
console.log('🔐 Testing Playground API Authentication\n');

// You'll need to replace these with your actual values
const PLAYGROUND_AUTH_URL = 'https://www.upwork.com/api/v3/oauth2/token';
const PLAYGROUND_API_KEY = 'your-actual-api-key';
const PLAYGROUND_API_SECRET = 'your-actual-api-secret';

async function testAuthentication() {
  console.log('📡 Testing different authentication approaches...\n');

  // Test 1: JSON format
  console.log('🔄 Test 1: JSON format');
  await testWithFormat('JSON', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: PLAYGROUND_API_KEY,
      api_secret: PLAYGROUND_API_SECRET
    })
  });

  console.log('\n---\n');

  // Test 2: Form URL encoded
  console.log('🔄 Test 2: Form URL encoded');
  const formData = new URLSearchParams();
  formData.append('api_key', PLAYGROUND_API_KEY);
  formData.append('api_secret', PLAYGROUND_API_SECRET);

  await testWithFormat('Form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString()
  });

  console.log('\n---\n');

  // Test 3: OAuth2 standard format (THIS ONE WORKS!)
  console.log('🔄 Test 3: OAuth2 grant_type format');
  const oauthData = new URLSearchParams();
  oauthData.append('grant_type', 'client_credentials');
  oauthData.append('client_id', PLAYGROUND_API_KEY);
  oauthData.append('client_secret', PLAYGROUND_API_SECRET);

  await testWithFormat('OAuth2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: oauthData.toString()
  });
}

async function testWithFormat(testName, options) {
  try {
    console.log(`Trying ${testName} format...`);
    const response = await fetch(PLAYGROUND_AUTH_URL, options);

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.log(`❌ ${testName} failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText.substring(0, 200));
      return false;
    }

    const authData = await response.json();
    console.log(`✅ ${testName} SUCCESS!`);
    console.log('Response data:');
    console.log(JSON.stringify(authData, null, 2));

    const token = authData.access_token || authData.token;
    if (token) {
      console.log(`🎯 JWT Token: ${token.substring(0, 20)}...`);
      const expiresIn = authData.expires_in || 3600;
      console.log(`⏰ Expires in: ${Math.floor(expiresIn/60)} minutes`);
    }
    return true;

  } catch (error) {
    console.error(`💥 ${testName} network error:`, error.message);
    return false;
  }
}

// Run the test
testAuthentication();

/*
EXPECTED RESULTS:
- Test 1 (JSON): 415 Unsupported Media Type
- Test 2 (Form): 400 Bad Request (missing grant_type)
- Test 3 (OAuth2): 200 OK SUCCESS! ✅

The correct format is OAuth2 with:
- grant_type: client_credentials
- client_id: your API key
- client_secret: your API secret
- Content-Type: application/x-www-form-urlencoded
*/