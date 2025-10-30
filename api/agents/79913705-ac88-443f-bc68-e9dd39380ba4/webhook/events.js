import { createHmac, timingSafeEqual } from 'crypto';

const rateLimitStore = new Map();
const requestIdStore = new Set();
let jwtToken = null;
let tokenExpiry = null;

// API Configuration
const API_BASE = 'https://www.upwork.com/api/v3/aap/api';
const AUTH_URL = 'https://www.upwork.com/api/v3/oauth2/token';

// Helper function to get fresh OAuth token
async function getOAuthToken() {
  const API_KEY = process.env.PLAYGROUND_API_KEY || '88b9cea0d2d7f6accc0ad10713d85533';
  const API_SECRET = process.env.PLAYGROUND_API_SECRET || 'c384c89a33482846';

  if (!API_KEY || !API_SECRET) {
    throw new Error('API credentials not configured');
  }

  // Check if we have a valid token
  if (jwtToken && tokenExpiry && Date.now() < tokenExpiry) {
    return jwtToken;
  }

  console.log('🔑 Getting fresh OAuth token...');

  const formData = `grant_type=client_credentials&client_id=${encodeURIComponent(API_KEY)}&client_secret=${encodeURIComponent(API_SECRET)}`;

  console.log('🔑 Making OAuth request to:', AUTH_URL);

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData
  });

  console.log('🔑 OAuth response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🔑 OAuth failed with response:', errorText);
    throw new Error(`OAuth failed: ${response.status} ${errorText}`);
  }

  const authData = await response.json();
  jwtToken = authData.access_token;
  tokenExpiry = Date.now() + (authData.expires_in * 1000) - 60000; // Refresh 1 min early

  console.log('✅ OAuth token acquired');
  return jwtToken;
}

// Helper function to make authenticated API calls
async function callUpworkAPI(endpoint, options = {}) {
  const token = await getOAuthToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

// Complete job processing workflow
async function processJobInvitation(jobPostId, agentId, debugLog) {
  try {
    console.log('🚀 STARTING JOB PROCESSING WORKFLOW:', { jobPostId, agentId });
    debugLog('🚀 Starting job processing workflow', { jobPostId, agentId });

    // Step 1: Get job details and attachments
    console.log('📋 STEP 1: Getting job details for:', jobPostId);
    console.log('📋 Making API call to:', `/jobs/${jobPostId}/${agentId}/detail`);
    debugLog('📋 Step 1: Getting job details...');

    const jobDetails = await callUpworkAPI(`/jobs/${jobPostId}/${agentId}/detail`);
    console.log('📋 Job details response received:', jobDetails);
    debugLog('✅ Job details retrieved:', {
      jobName: jobDetails.job_name,
      hasAttachments: jobDetails.attachments?.length > 0,
      attachmentCount: jobDetails.attachments?.length || 0
    });

    // Step 2: Start job attempt
    console.log('🏁 STEP 2: Starting job attempt');
    console.log('🏁 Making API call to:', `/jobs/${jobPostId}/${agentId}/start`);
    debugLog('🏁 Step 2: Starting job attempt...');

    const startResponse = await callUpworkAPI(`/jobs/${jobPostId}/${agentId}/start`, {
      method: 'POST',
      body: JSON.stringify({
        explanation: "Starting work on this job with AI-Gent v1.0"
      })
    });
    console.log('🏁 Job attempt started, response:', startResponse);
    debugLog('✅ Job attempt started:', startResponse);

    // Step 3: Generate deliverable content (AI logic would go here)
    console.log('🤖 STEP 3: Generating deliverable content');
    debugLog('🤖 Step 3: Generating deliverable content...');
    const deliverableContent = generateDeliverableContent(jobDetails);
    console.log('🤖 Generated content length:', deliverableContent.length, 'characters');

    // Create deliverable file
    const deliverableBlob = new Blob([deliverableContent], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('files', deliverableBlob, 'deliverable.txt');

    // Step 4: Submit deliverable
    console.log('📤 STEP 4: Submitting deliverable');
    console.log('📤 Making API call to:', `/jobs/${jobPostId}/${agentId}/deliverable`);
    debugLog('📤 Step 4: Submitting deliverable...');

    const deliverableResponse = await fetch(`${API_BASE}/jobs/${jobPostId}/${agentId}/deliverable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getOAuthToken()}`
      },
      body: formData
    });

    console.log('📤 Deliverable response status:', deliverableResponse.status, deliverableResponse.statusText);

    if (!deliverableResponse.ok) {
      const errorText = await deliverableResponse.text();
      console.log('📤 Deliverable submission failed:', errorText);
      throw new Error(`Deliverable submission failed: ${deliverableResponse.status} ${errorText}`);
    }

    const deliverableResult = await deliverableResponse.json();
    console.log('📤 Deliverable submitted successfully:', deliverableResult);
    debugLog('✅ Deliverable submitted:', deliverableResult);

    // Step 5: Complete the job
    console.log('🎯 STEP 5: Completing job');
    console.log('🎯 Making API call to:', `/jobs/${jobPostId}/${agentId}/complete`);
    debugLog('🎯 Step 5: Completing job...');

    const completeResponse = await callUpworkAPI(`/jobs/${jobPostId}/${agentId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        explanation: `Job completed successfully! Generated ${deliverableContent.length} characters of content based on the job requirements.`,
        fixed_price: null // Optional pricing
      })
    });
    console.log('🎯 Job completed successfully:', completeResponse);
    debugLog('✅ Job completed:', completeResponse);

    return {
      success: true,
      jobDetails,
      deliverableSize: deliverableContent.length,
      completedAt: new Date().toISOString()
    };

  } catch (error) {
    debugLog('❌ Job processing failed:', error.message);
    throw error;
  }
}

// Generate deliverable content based on job details
function generateDeliverableContent(jobDetails) {
  const jobName = jobDetails.job_name || 'Untitled Job';
  const jobDescription = jobDetails.job_description || 'No description provided';
  const attachments = jobDetails.attachments || [];

  // This is where you'd integrate with AI/LLM for real content generation
  const content = `# Job Completion: ${jobName}

## Job Requirements Analysis
${jobDescription}

## Attachments Processed
${attachments.length > 0 ?
  attachments.map(att => `- ${att.name} (${att.size} bytes)`).join('\n') :
  'No attachments provided'
}

## Deliverable Content
This is a sample deliverable generated by AI-Gent v1.0.

Based on the job requirements, I have analyzed the request and provided this response.

**Key Features Delivered:**
- Comprehensive analysis of job requirements
- Professional formatting and structure
- Attention to detail and client specifications

**Technical Implementation:**
- Clean, well-documented approach
- Scalable and maintainable solution
- Follows industry best practices

## Summary
Job has been completed according to specifications. All requirements have been addressed with attention to quality and detail.

Generated on: ${new Date().toISOString()}
Agent: AI-Gent v1.0
Job ID: ${jobDetails.job_post_id || 'N/A'}

---
🤖 Generated with AI-Gent - Automated job completion system
`;

  return content;
}

function isOriginWhitelisted(origin, whitelistedOrigins) {
  if (!origin) return false;
  if (whitelistedOrigins.includes('*')) return true;

  return whitelistedOrigins.some(whitelisted => {
    if (whitelisted.includes('*')) {
      const regex = new RegExp(whitelisted.replace(/\*/g, '.*'));
      return regex.test(origin);
    }
    return whitelisted === origin;
  });
}

function verifySignature(payload, signature, secret, timestamp = null, requestId = null, debug = false) {
  if (debug) {
    console.log('[SIGNATURE DEBUG] Input params:', {
      payload: payload,
      signature: signature,
      secret: secret,
      payloadType: typeof payload,
      signatureType: typeof signature,
      secretType: typeof secret,
      payloadBytes: Buffer.from(payload, 'utf8').length,
      payloadEncoding: Buffer.from(payload, 'utf8').toString('hex').substring(0, 32) + '...'
    });
  }

  if (!signature || !secret) {
    if (debug) console.log('[SIGNATURE DEBUG] Missing signature or secret');
    return false;
  }

  // According to Upwork docs: raw_payload = f"{x_up_id}.{x_up_timestamp}.{body_str}"
  const upworkFormat = `${requestId}.${timestamp}.${payload}`;

  if (debug) {
    console.log('[SIGNATURE DEBUG] Upwork format payload:', upworkFormat);
  }

  const computedSignature = createHmac('sha256', secret)
    .update(upworkFormat, 'utf8')
    .digest('hex');

  const providedSignature = signature.substring(7); // Remove "sha256=" prefix

  if (debug) {
    console.log('[SIGNATURE DEBUG] Final comparison:', {
      providedSignature: providedSignature,
      computedSignature: computedSignature,
      signaturesMatch: providedSignature === computedSignature,
      upworkFormatUsed: upworkFormat
    });
  }

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const computedBuffer = Buffer.from(computedSignature, 'hex');

  if (providedBuffer.length !== computedBuffer.length) {
    if (debug) console.log('[SIGNATURE DEBUG] Length mismatch');
    return false;
  }

  return timingSafeEqual(computedBuffer, providedBuffer);
}

function validateTimestamp(timestamp, maxAge = 120000) {
  if (!timestamp) return false;
  const now = Date.now();
  const requestTime = parseInt(timestamp) * 1000;
  return (now - requestTime) <= maxAge;
}

function isDuplicateRequest(requestId) {
  if (!requestId) return false;
  if (requestIdStore.has(requestId)) return true;

  requestIdStore.add(requestId);
  if (requestIdStore.size > 1000) {
    const first = requestIdStore.values().next().value;
    requestIdStore.delete(first);
  }
  return false;
}

function checkRateLimit(origin, maxRequests, window) {
  const now = Date.now();
  const key = `rate_${origin}`;

  for (const [k, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > window) {
      rateLimitStore.delete(k);
    }
  }

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const data = rateLimitStore.get(key);

  if (now - data.windowStart > window) {
    data.count = 1;
    data.windowStart = now;
    rateLimitStore.set(key, data);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (data.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: data.windowStart + window
    };
  }

  data.count++;
  rateLimitStore.set(key, data);
  return { allowed: true, remaining: maxRequests - data.count };
}

// Disable body parser to get raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  const DEBUG = process.env.DEBUG === 'true';

  function debugLog(...args) {
    if (DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  // ALWAYS LOG WEBHOOK ENTRY
  console.log('🎯 WEBHOOK ENTRY - Request received:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  try {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const WHITELISTED_ORIGINS = process.env.WHITELISTED_ORIGINS?.split(',').map(origin => origin.trim()) || ['*'];
    const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000;
    const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

    if (!WEBHOOK_SECRET) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Webhook secret not configured'
      });
    }

    debugLog('Handler invoked:', {
      method: req.method,
      originsCount: WHITELISTED_ORIGINS.length
    });

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Only POST requests are accepted'
      });
    }

    // Read raw body for signature verification (bodyParser is disabled)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    const signature = req.headers['x-up-signature'];
    const timestamp = req.headers['x-up-timestamp'];
    const requestId = req.headers['x-up-id'];

    // Parse the JSON body for processing
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
      console.log('📦 RAW BODY RECEIVED:', rawBody);
      console.log('📦 PARSED PAYLOAD:', JSON.stringify(parsedBody, null, 2));
    } catch (error) {
      console.log('❌ JSON PARSE ERROR:', error.message);
      console.log('❌ RAW BODY THAT FAILED:', rawBody);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid JSON body'
      });
    }

    debugLog('Body info:', {
      bodyType: typeof parsedBody,
      bodyLength: rawBody.length,
      bodyKeys: parsedBody ? Object.keys(parsedBody) : 'none',
      rawBodySample: rawBody.substring(0, 100)
    });

    debugLog('Webhook headers:', {
      signature: signature ? signature.substring(0, 20) + '...' : 'missing',
      timestamp,
      requestId,
      hasWebhookSecret: !!WEBHOOK_SECRET,
      webhookSecretLength: WEBHOOK_SECRET?.length
    });

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET, timestamp, requestId, DEBUG)) {
      debugLog('Signature verification failed');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid signature'
      });
    }

    if (!validateTimestamp(timestamp)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Request too old or invalid timestamp'
      });
    }

    if (isDuplicateRequest(requestId)) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Duplicate request'
      });
    }

    // Check origin
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    if (!isOriginWhitelisted(origin, WHITELISTED_ORIGINS)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Origin not whitelisted',
        debug: DEBUG ? { origin, whitelisted: WHITELISTED_ORIGINS } : undefined
      });
    }

    // Check rate limit
    const rateLimitResult = checkRateLimit(origin, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        resetTime: rateLimitResult.resetTime
      });
    }

    // Add headers
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
    res.setHeader('X-RateLimit-Window', RATE_LIMIT_WINDOW);

    // Process payload
    const payload = parsedBody;
    if (!payload) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Request body is required'
      });
    }

    debugLog('🔍 PAYLOAD ANALYSIS:', {
      payloadKeys: Object.keys(payload),
      hasJobPostId: !!payload.job_post_id,
      hasAgentIds: !!payload.agent_ids,
      hasEventType: !!payload.event_type,
      eventType: payload.event_type,
      fullPayload: payload
    });

    // Enhanced message type detection based on Upwork documentation
    const isJobInvitation = payload.event_type === 'agent.job.invitation';
    const isJobMessage = payload.event_type === 'agent.job.message';
    const isJobFeedback = payload.event_type === 'agent.job.feedback';
    const isHealthCheck = payload.event_type === 'agent.health_check';

    // Legacy detection for older payload formats
    const isPlaygroundJobInvitation = payload.job_post_id && payload.agent_ids;
    const isClientFeedback = payload.message_type === 'client_feedback' || (payload.attempt_id && payload.client_message);

    // Always log message type detection regardless of DEBUG setting
    console.log('🎯 MESSAGE TYPE DETECTION:', {
      isJobInvitation,
      isJobMessage,
      isJobFeedback,
      isHealthCheck,
      isPlaygroundJobInvitation,
      isClientFeedback,
      payloadEventType: payload.event_type
    });

    debugLog('🎯 MESSAGE TYPE DETECTION:', {
      isJobInvitation,
      isJobMessage,
      isJobFeedback,
      isHealthCheck,
      isPlaygroundJobInvitation,
      isClientFeedback
    });

    let messageType;
    let response;

    // Handle Health Check (simplest case)
    if (isHealthCheck) {
      debugLog('🏥 HEALTH CHECK received');
      messageType = 'health_check';
      response = {
        success: true,
        message: "Health check received",
        event_type: payload.event_type,
        timestamp: payload.timestamp,
      };
    }
    // Handle Job Invitation (NEW FORMAT - this is what you likely received)
    else if (isJobInvitation) {
      console.log('🚀 JOB INVITATION DETECTED AND PROCESSING');
      console.log('🚀 Job Details:', {
        job_post_id: payload.job_post_id,
        event_type: payload.event_type,
        timestamp: payload.timestamp
      });

      debugLog('🚀 JOB INVITATION received:', {
        job_post_id: payload.job_post_id,
        event_type: payload.event_type,
        timestamp: payload.timestamp
      });

      messageType = 'job_invitation';

      try {
        // Process the job asynchronously
        const agentId = '79913705-ac88-443f-bc68-e9dd39380ba4'; // Extract from route or config

        // Start job processing in background (don't await to respond quickly)
        console.log('🚀 ABOUT TO START JOB PROCESSING - ALWAYS VISIBLE');
        console.log('Job ID:', payload.job_post_id);
        console.log('Agent ID:', agentId);
        debugLog('🚀 About to start job processing for:', { jobId: payload.job_post_id, agentId });

        processJobInvitation(payload.job_post_id, agentId, debugLog)
          .then(result => {
            debugLog('🎉 Job processing completed successfully:', result);
            console.log('✅ JOB COMPLETED SUCCESSFULLY:', result);
          })
          .catch(error => {
            debugLog('💥 Job processing failed:', error.message);
            console.error('❌ JOB PROCESSING ERROR:', error);
            console.error('❌ ERROR STACK:', error.stack);

            // Try to log more details about the error
            if (error.response) {
              console.error('❌ API Response Error:', error.response.status, error.response.statusText);
            }
          });

        // Return immediate response to Upwork
        response = {
          success: true,
          message: "Job invitation received - processing started",
          event_type: payload.event_type,
          job_post_id: payload.job_post_id,
          status: "processing_started"
        };

      } catch (error) {
        debugLog('❌ Failed to start job processing:', error.message);
        response = {
          success: false,
          message: "Failed to start job processing",
          event_type: payload.event_type,
          job_post_id: payload.job_post_id,
          error: error.message
        };
      }
    }
    // Handle Job Messages
    else if (isJobMessage) {
      debugLog('💬 JOB MESSAGE received:', payload);
      messageType = 'job_message';
      response = {
        success: true,
        message: "Job message received",
        event_type: payload.event_type,
        job_post_id: payload.job_post_id,
      };
    }
    // Handle Job Feedback
    else if (isJobFeedback) {
      debugLog('⭐ JOB FEEDBACK received:', payload);
      messageType = 'job_feedback';
      response = {
        success: true,
        message: "Job feedback received",
        event_type: payload.event_type,
        job_post_id: payload.job_post_id,
      };
    }
    // Handle Legacy Format (job_post_id + agent_ids)
    else if (isPlaygroundJobInvitation) {
      debugLog('📋 LEGACY JOB INVITATION received:', {
        job_post_id: payload.job_post_id,
        agent_ids: payload.agent_ids
      });

      messageType = 'playground_job_invitation';
      response = {
        webhook_status: "✅ Job invitation received (legacy format)",
        ai_agent: {
          name: "AI-Gent v1.0",
          status: "ready",
          processed_at: new Date().toISOString()
        },
        job_details: {
          job_id: payload.job_post_id,
          job_name: "Placeholder Job",
          agent_id: payload.agent_ids[0]
        },
        message: "Legacy format - real API integration needed"
      };
    } else if (isClientFeedback) {
      messageType = 'client_feedback';
      response = {
        webhook_status: "✅ Client feedback received",
        ai_agent: {
          name: "AI-Gent v1.0",
          status: "acknowledged",
          processed_at: new Date().toISOString()
        },
        message: "Client feedback acknowledged"
      };
    } else {
      messageType = 'regular_webhook';
      response = {
        webhook_status: "✅ Regular webhook received",
        ai_agent: {
          name: "AI-Gent v1.0",
          status: "ready",
          processed_at: new Date().toISOString()
        },
        received_payload: payload,
        message: "Webhook processed successfully"
      };
    }

    console.log('📨 SENDING WEBHOOK RESPONSE:', {
      messageType,
      status: 'success',
      responseData: response
    });

    debugLog('Sending response:', { messageType, status: 'success' });

    const finalResponse = {
      ...response,
      request_tracking: {
        origin: origin,
        type: messageType
      },
      debug: DEBUG ? { timestamp: new Date().toISOString() } : undefined
    };

    console.log('📨 FINAL RESPONSE BEING SENT:', finalResponse);

    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      debug: DEBUG ? { stack: error.stack?.split('\n').slice(0, 3) } : undefined
    });
  }
}