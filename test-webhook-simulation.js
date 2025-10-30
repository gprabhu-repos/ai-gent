#!/usr/bin/env node

// Test script to simulate Upwork sending a job invitation webhook
import crypto from 'crypto';

// Configuration
const WEBHOOK_URL = 'https://ai-gent-omega.vercel.app/agents/79913705-ac88-443f-bc68-e9dd39380ba4/webhook/events';
const WEBHOOK_SECRET = 'GSG7QiKf4DdeXCueOE520uta_coeoKKTY1epJwsKIH4';

// Generate test data - REAL JOB ID
const testJobId = '872b78a7-7d59-48d9-a99a-b0360005c8a7';
const requestId = `msg_test_${Date.now()}`;
const timestamp = Date.now().toString();

// Create realistic job invitation payload
const jobInvitationPayload = {
  event_type: "agent.job.invitation",
  job_post_id: testJobId,
  timestamp: new Date().toISOString(),
  agent_id: "79913705-ac88-443f-bc68-e9dd39380ba4"
};

const bodyString = JSON.stringify(jobInvitationPayload);

// Generate signature exactly like Upwork does
// Format: {x_up_id}.{x_up_timestamp}.{body_str}
const rawPayload = `${requestId}.${timestamp}.${bodyString}`;
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawPayload, 'utf8')
  .digest('hex');

console.log('🧪 WEBHOOK TEST SIMULATION');
console.log('=====================================');
console.log('Target URL:', WEBHOOK_URL);
console.log('Job Post ID:', testJobId);
console.log('Request ID:', requestId);
console.log('Timestamp:', timestamp);
console.log('Payload:', bodyString);
console.log('Raw Payload for Signature:', rawPayload);
console.log('Generated Signature:', signature);
console.log('=====================================\n');

// Send the webhook
async function sendTestWebhook() {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Up-Signature': `sha256=${signature}`,
        'X-Up-Timestamp': timestamp,
        'X-Up-Id': requestId,
        'Origin': 'https://upwork.com'
      },
      body: bodyString
    });

    console.log('📡 RESPONSE STATUS:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('📨 RESPONSE BODY:');

    try {
      const responseJson = JSON.parse(responseText);
      console.log(JSON.stringify(responseJson, null, 2));
    } catch (e) {
      console.log(responseText);
    }

    if (response.status === 200) {
      console.log('\n✅ SUCCESS! Check your Vercel logs for debug output.');
      console.log(`🔍 Look for logs with job_post_id: ${testJobId}`);
    } else {
      console.log('\n❌ FAILED! Check the response above for details.');
    }

  } catch (error) {
    console.error('💥 ERROR sending webhook:', error.message);
  }
}

// Alternative test payloads for different scenarios
const testPayloads = {
  health_check: {
    event_type: "agent.health_check",
    timestamp: new Date().toISOString()
  },

  job_message: {
    event_type: "agent.job.message",
    job_post_id: testJobId,
    timestamp: new Date().toISOString()
  },

  job_feedback: {
    event_type: "agent.job.feedback",
    job_post_id: testJobId,
    timestamp: new Date().toISOString()
  },

  legacy_format: {
    job_post_id: testJobId,
    agent_ids: ["79913705-ac88-443f-bc68-e9dd39380ba4"]
  }
};

// Function to test different payload types
async function testPayloadType(payloadType) {
  if (!testPayloads[payloadType]) {
    console.log('❌ Unknown payload type. Available:', Object.keys(testPayloads));
    return;
  }

  const payload = testPayloads[payloadType];
  const bodyStr = JSON.stringify(payload);
  const testRequestId = `msg_${payloadType}_${Date.now()}`;
  const testTimestamp = Date.now().toString();
  const testRawPayload = `${testRequestId}.${testTimestamp}.${bodyStr}`;
  const testSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(testRawPayload, 'utf8')
    .digest('hex');

  console.log(`\n🧪 TESTING ${payloadType.toUpperCase()}`);
  console.log('Payload:', bodyStr);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Up-Signature': `sha256=${testSignature}`,
        'X-Up-Timestamp': testTimestamp,
        'X-Up-Id': testRequestId,
        'Origin': 'https://upwork.com'
      },
      body: bodyStr
    });

    console.log('Status:', response.status);
    const responseText = await response.text();
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Response:', JSON.stringify(responseJson, null, 2));
    } catch (e) {
      console.log('Response:', responseText);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const testType = args[0];
    await testPayloadType(testType);
  } else {
    // Default: send job invitation
    await sendTestWebhook();
  }
}

// Usage help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage:
  node test-webhook-simulation.js                    # Send job invitation
  node test-webhook-simulation.js health_check       # Send health check
  node test-webhook-simulation.js job_message        # Send job message
  node test-webhook-simulation.js job_feedback       # Send job feedback
  node test-webhook-simulation.js legacy_format      # Send legacy format

Available test types: ${Object.keys(testPayloads).join(', ')}
`);
  process.exit(0);
}

main().catch(console.error);