// Vercel serverless function - no Next.js imports needed

const WHITELISTED_ORIGINS = process.env.WHITELISTED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// Playground API configuration
const PLAYGROUND_API_BASE = process.env.PLAYGROUND_API_BASE || 'https://api.playground.example.com';
const PLAYGROUND_AUTH_URL = process.env.PLAYGROUND_AUTH_URL || `${PLAYGROUND_API_BASE}/auth/token`;
const PLAYGROUND_API_KEY = process.env.PLAYGROUND_API_KEY;
const PLAYGROUND_API_SECRET = process.env.PLAYGROUND_API_SECRET;

// Validate critical environment variables
if (WHITELISTED_ORIGINS.length === 0) {
  console.warn('WARNING: No whitelisted origins configured. All requests will be rejected.');
}

if (!PLAYGROUND_API_KEY || !PLAYGROUND_API_SECRET) {
  console.warn('WARNING: Playground API credentials not configured. API calls will fail.');
}

// In-memory stores (consider Redis for production multi-instance deployments)
const rateLimitStore = new Map();

// JWT token cache
let jwtToken = null;
let tokenExpiry = null;

// Playground API functions
async function getJWTToken() {
  // Return cached token if still valid
  if (jwtToken && tokenExpiry && Date.now() < tokenExpiry) {
    return jwtToken;
  }

  try {
    const response = await fetch(PLAYGROUND_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: PLAYGROUND_API_KEY,
        api_secret: PLAYGROUND_API_SECRET
      })
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status} ${response.statusText}`);
    }

    const authData = await response.json();
    jwtToken = authData.access_token || authData.token;

    // Set expiry (assume 1 hour if not provided)
    const expiresIn = authData.expires_in || 3600;
    tokenExpiry = Date.now() + (expiresIn * 1000) - 60000; // Refresh 1 min early

    return jwtToken;
  } catch (error) {
    console.error('Failed to get JWT token:', error);
    throw error;
  }
}

async function fetchJobDetails(jobId) {
  const token = await getJWTToken();

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/api/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch job: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch job details:', error);
    throw error;
  }
}

async function createAttempt(jobPostId, agentId) {
  const token = await getJWTToken();

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/api/attempts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        job_post_id: jobPostId,
        agent_id: agentId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create attempt: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create attempt:', error);
    throw error;
  }
}

async function completeAttempt(attemptId, deliverableContent, fixedPrice = null) {
  const token = await getJWTToken();

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/api/attempts/${attemptId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attempt_deliverable_content: deliverableContent,
        ...(fixedPrice && { fixed_price: fixedPrice })
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to complete attempt: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to complete attempt:', error);
    throw error;
  }
}

function isOriginWhitelisted(origin) {
  if (!origin) return false;
  return WHITELISTED_ORIGINS.some(whitelisted => {
    if (whitelisted.includes('*')) {
      const regex = new RegExp(whitelisted.replace(/\*/g, '.*'));
      return regex.test(origin);
    }
    return whitelisted === origin;
  });
}

function cleanupExpiredEntries() {
  const now = Date.now();

  // Cleanup rate limit store
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}

function checkRateLimit(origin) {
  const now = Date.now();
  const key = `rate_${origin}`;

  cleanupExpiredEntries();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  const data = rateLimitStore.get(key);

  // Reset window if expired
  if (now - data.windowStart > RATE_LIMIT_WINDOW) {
    data.count = 1;
    data.windowStart = now;
    rateLimitStore.set(key, data);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  // Check if limit exceeded
  if (data.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: data.windowStart + RATE_LIMIT_WINDOW
    };
  }

  // Increment counter
  data.count++;
  rateLimitStore.set(key, data);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - data.count };
}

async function processPlaygroundJobInvitation(payload) {
  const processingStartTime = Date.now();
  const timestamp = new Date().toISOString();

  const { job_post_id, agent_ids } = payload;

  if (!job_post_id || !agent_ids) {
    throw new Error('Invalid playground payload: missing job_post_id or agent_ids');
  }

  try {
    // Step 1: Fetch job details
    console.log(`Fetching job details for job_post_id: ${job_post_id}`);
    const jobDetails = await fetchJobDetails(job_post_id);

    // Step 2: Create attempt for our agent
    const agentId = agent_ids[0]; // Use first agent ID
    console.log(`Creating attempt for agent_id: ${agentId}`);
    const attempt = await createAttempt(job_post_id, agentId);

    // Step 3: Generate simple deliverable
    const deliverableContent = `Hello! I've received the job "${jobDetails.job_name || 'Untitled Job'}" and I'm ready to work on it. This is a placeholder response from AI-Gent v1.0.`;

    // Step 4: Complete the attempt
    console.log(`Completing attempt: ${attempt.id}`);
    await completeAttempt(attempt.id, deliverableContent);

    return {
      webhook_status: "✅ Job invitation received and processed",
      ai_agent: {
        name: "AI-Gent v1.0",
        status: "ready",
        processed_at: timestamp,
        processing_time: `${Date.now() - processingStartTime}ms`
      },
      job_details: {
        job_id: job_post_id,
        job_name: jobDetails.job_name,
        agent_id: agentId,
        attempt_id: attempt.id
      },
      message: "Job attempt created and completed with dummy response"
    };

  } catch (error) {
    console.error('Playground job processing failed:', error);
    throw error;
  }
}


function processWebhookPayload(payload) {
  const timestamp = new Date().toISOString();

  return {
    webhook_status: "✅ Regular webhook received",
    ai_agent: {
      name: "AI-Gent v1.0",
      status: "ready",
      processed_at: timestamp
    },
    received_payload: payload,
    message: "Non-playground webhook processed successfully"
  };
}

export default async function handler(req, res) {
  // Handle preflight OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  // Check origin whitelist
  const origin = req.headers.origin || req.headers.referer;
  if (!isOriginWhitelisted(origin)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Origin not whitelisted'
    });
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(origin);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      resetTime: rateLimitResult.resetTime
    });
  }

  // Add rate limit headers to response
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
  res.setHeader('X-RateLimit-Window', RATE_LIMIT_WINDOW);

  try {
    // Parse request body
    const payload = req.body;

    if (!payload) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Request body is required'
      });
    }

    // Detect if this is a playground job invitation
    const isPlaygroundJobInvitation = payload.job_post_id && payload.agent_ids;

    let processed;

    if (isPlaygroundJobInvitation) {
      console.log('Processing playground job invitation:', payload);
      processed = await processPlaygroundJobInvitation(payload);
    } else {
      console.log('Processing regular webhook:', payload);
      processed = processWebhookPayload(payload);
    }

    // Return success response
    return res.status(200).json({
      ...processed,
      request_tracking: {
        origin: origin || 'unknown',
        type: isPlaygroundJobInvitation ? 'playground_job_invitation' : 'regular_webhook'
      }
    });

  } catch (error) {
    console.error('Webhook processing error:', {
      message: error.message,
      stack: error.stack,
      origin: origin,
      payloadType: payload?.job_post_id ? 'playground' : 'regular'
    });

    // Return appropriate error response
    const isPlaygroundError = error.message?.includes('playground') || error.message?.includes('job_post_id');

    return res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: isPlaygroundError ? 'Failed to process playground job invitation' : 'Failed to process webhook',
      details: error.message,
      request_tracking: {
        origin: origin || 'unknown'
      }
    });
  }
}