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
      return null;
    }

    const authData = await response.json();
    console.log('✅ Token acquired!');
    console.log('Expires in:', Math.floor(authData.expires_in/60), 'minutes\n');

    return authData.access_token;

  } catch (error) {
    console.error('💥 Error:', error.message);
    return null;
  }
}

async function getJobs(token) {
  console.log('📋 Getting list of jobs...\n');

  const API_BASE = 'https://www.upwork.com/api/v3/aap/api';

  try {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Jobs API Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Failed to get jobs:', errorText);
      return;
    }

    const jobsData = await response.json();
    console.log('✅ Jobs retrieved!');
    console.log('📋 Jobs List:');
    console.log(JSON.stringify(jobsData, null, 2));

  } catch (error) {
    console.error('💥 Error getting jobs:', error.message);
  }
}

async function getSpecificJob(token, jobId, agentId) {
  console.log(`🔍 Checking specific job: ${jobId} with agent: ${agentId}\n`);

  const API_BASE = 'https://www.upwork.com/api/v3/aap/api';

  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/${agentId}/detail`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Job Detail API Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Failed to get job details:', errorText);
      return;
    }

    const jobData = await response.json();
    console.log('✅ Job details retrieved!');
    console.log('📋 Job Details:');
    console.log(JSON.stringify(jobData, null, 2));

  } catch (error) {
    console.error('💥 Error getting job details:', error.message);
  }
}

async function main() {
  const token = await getToken();
  if (token) {
    await getJobs(token);

    // Check the specific job from your webhook simulation
    const jobId = '872b78a7-7d59-48d9-a99a-b0360005c8a7';
    const agentId = '79913705-ac88-443f-bc68-e9dd39380ba4';
    await getSpecificJob(token, jobId, agentId);
  }
}

main();