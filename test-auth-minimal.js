// Minimal auth test - replace with your actual credentials
const PLAYGROUND_AUTH_URL = 'https://www.upwork.com/api/v3/oauth2/token';
const PLAYGROUND_API_KEY = '88b9cea0d2d7f6accc0ad10713d85533';
const PLAYGROUND_API_SECRET = 'c384c89a33482846';

async function getToken() {
  console.log('🔐 Getting fresh token...\n');

  try {
    const formData = `grant_type=client_credentials&client_id=${encodeURIComponent(PLAYGROUND_API_KEY)}&client_secret=${encodeURIComponent(PLAYGROUND_API_SECRET)}`;

    const response = await fetch(PLAYGROUND_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Failed:', errorText);
      return;
    }

    const authData = await response.json();
    console.log('✅ Success!');
    console.log('Token:', authData.access_token);
    console.log('Expires in:', Math.floor(authData.expires_in/60), 'minutes');

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

getToken();