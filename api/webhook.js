// Vercel serverless function - no Next.js imports needed

// Debug logging flag
const DEBUG = process.env.DEBUG === 'true';

function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Safe environment variable parsing
let WHITELISTED_ORIGINS = [];
try {
  WHITELISTED_ORIGINS = process.env.WHITELISTED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
  debugLog('Parsed WHITELISTED_ORIGINS:', WHITELISTED_ORIGINS);
} catch (error) {
  console.error('Error parsing WHITELISTED_ORIGINS:', error);
  WHITELISTED_ORIGINS = [];
}

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// Playground API configuration
const PLAYGROUND_API_BASE = process.env.PLAYGROUND_API_BASE || 'https://www.upwork.com/api/v3';
const PLAYGROUND_AUTH_URL = process.env.PLAYGROUND_AUTH_URL || 'https://www.upwork.com/api/v3/oauth2/token';
const PLAYGROUND_API_KEY = process.env.PLAYGROUND_API_KEY;
const PLAYGROUND_API_SECRET = process.env.PLAYGROUND_API_SECRET;

// Startup validation
debugLog('Function startup - Environment check:', {
  WHITELISTED_ORIGINS_COUNT: WHITELISTED_ORIGINS.length,
  PLAYGROUND_API_BASE,
  PLAYGROUND_AUTH_URL,
  HAS_API_KEY: !!PLAYGROUND_API_KEY,
  HAS_API_SECRET: !!PLAYGROUND_API_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL
});

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
    // Build form data manually for better compatibility
    const formData = `grant_type=client_credentials&client_id=${encodeURIComponent(PLAYGROUND_API_KEY)}&client_secret=${encodeURIComponent(PLAYGROUND_API_SECRET)}`;

    const response = await fetch(PLAYGROUND_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
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
    const response = await fetch(`${PLAYGROUND_API_BASE}/jobs/${jobId}`, {
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
    const response = await fetch(`${PLAYGROUND_API_BASE}/attempts`, {
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
    const response = await fetch(`${PLAYGROUND_API_BASE}/attempts/${attemptId}/complete`, {
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

async function submitRevision(attemptId, revisionContent, revisionNotes = null) {
  const token = await getJWTToken();

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/attempts/${attemptId}/revise`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        revision_content: revisionContent,
        ...(revisionNotes && { revision_notes: revisionNotes })
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to submit revision: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to submit revision:', error);
    throw error;
  }
}

async function sendMessage(attemptId, messageContent, messageType = 'agent_response') {
  const token = await getJWTToken();

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attempt_id: attemptId,
        message_content: messageContent,
        message_type: messageType,
        sender: 'agent'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

async function getAttemptDetails(attemptId) {
  const token = await getJWTToken();

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/attempts/${attemptId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch attempt: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch attempt details:', error);
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


async function processClientFeedback(payload) {
  const timestamp = new Date().toISOString();
  const { attempt_id, client_message, requires_revision } = payload;

  if (!attempt_id || !client_message) {
    throw new Error('Invalid client feedback payload: missing attempt_id or client_message');
  }

  try {
    console.log(`Processing client feedback for attempt: ${attempt_id}`);

    // Get current attempt details
    const attemptDetails = await getAttemptDetails(attempt_id);

    if (requires_revision) {
      // Generate a revision based on client feedback
      const revisionContent = `Thank you for your feedback! I've reviewed your message: "${client_message}". Here's my updated response addressing your concerns. This is a placeholder revision from AI-Gent v1.0.`;

      // Submit revision
      const revision = await submitRevision(attempt_id, revisionContent, "Addressing client feedback");

      return {
        webhook_status: "✅ Client feedback received and revision submitted",
        ai_agent: {
          name: "AI-Gent v1.0",
          status: "revised",
          processed_at: timestamp
        },
        feedback_details: {
          attempt_id: attempt_id,
          client_message: client_message,
          revision_id: revision.id,
          requires_revision: requires_revision
        },
        message: "Revision submitted based on client feedback"
      };
    } else {
      // Just acknowledge the feedback
      const messageResponse = await sendMessage(attempt_id, `Thank you for your feedback: "${client_message}". I'm glad you're satisfied with the work! - AI-Gent v1.0`);

      return {
        webhook_status: "✅ Client feedback acknowledged",
        ai_agent: {
          name: "AI-Gent v1.0",
          status: "acknowledged",
          processed_at: timestamp
        },
        feedback_details: {
          attempt_id: attempt_id,
          client_message: client_message,
          message_id: messageResponse.id,
          requires_revision: requires_revision
        },
        message: "Client feedback acknowledged"
      };
    }

  } catch (error) {
    console.error('Client feedback processing failed:', error);
    throw error;
  }
}

async function processRevisionRequest(payload) {
  const timestamp = new Date().toISOString();
  const { attempt_id, revision_instructions, deadline } = payload;

  if (!attempt_id || !revision_instructions) {
    throw new Error('Invalid revision request payload: missing attempt_id or revision_instructions');
  }

  try {
    console.log(`Processing revision request for attempt: ${attempt_id}`);

    // Get current attempt details
    const attemptDetails = await getAttemptDetails(attempt_id);

    // Generate revision based on instructions
    const revisionContent = `I've received your revision request: "${revision_instructions}". Here's my updated work addressing these specific requirements. This is a placeholder revision from AI-Gent v1.0.`;

    // Submit revision
    const revision = await submitRevision(attempt_id, revisionContent, `Addressing revision: ${revision_instructions}`);

    return {
      webhook_status: "✅ Revision request processed and submitted",
      ai_agent: {
        name: "AI-Gent v1.0",
        status: "revised",
        processed_at: timestamp
      },
      revision_details: {
        attempt_id: attempt_id,
        revision_instructions: revision_instructions,
        revision_id: revision.id,
        deadline: deadline
      },
      message: "Revision completed and submitted"
    };

  } catch (error) {
    console.error('Revision request processing failed:', error);
    throw error;
  }
}

async function processStatusUpdate(payload) {
  const timestamp = new Date().toISOString();
  const { attempt_id, status, message } = payload;

  try {
    console.log(`Processing status update for attempt: ${attempt_id}, status: ${status}`);

    // Log the status update
    const responseMessage = `Status update received for attempt ${attempt_id}: ${status}. ${message || ''}. Acknowledged by AI-Gent v1.0.`;

    return {
      webhook_status: "✅ Status update acknowledged",
      ai_agent: {
        name: "AI-Gent v1.0",
        status: "acknowledged",
        processed_at: timestamp
      },
      status_details: {
        attempt_id: attempt_id,
        new_status: status,
        message: message
      },
      message: "Status update acknowledged"
    };

  } catch (error) {
    console.error('Status update processing failed:', error);
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
  debugLog('Handler invoked:', {
    method: req.method,
    url: req.url,
    headers: Object.keys(req.headers || {}),
    hasBody: !!req.body
  });

  try {
    // Handle preflight OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
      debugLog('Handling OPTIONS request');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      debugLog('Invalid method:', req.method);
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Only POST requests are accepted'
      });
    }
  } catch (error) {
    console.error('Handler initialization error:', error);
    return res.status(500).json({
      error: 'Handler initialization failed',
      message: error.message
    });
  }

  try {
    // Check origin whitelist
    const origin = req.headers.origin || req.headers.referer;
    debugLog('Origin check:', { origin, whitelistedCount: WHITELISTED_ORIGINS.length });

    if (!isOriginWhitelisted(origin)) {
      debugLog('Origin not whitelisted:', origin);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Origin not whitelisted',
        debug: DEBUG ? { origin, whitelisted: WHITELISTED_ORIGINS } : undefined
      });
    }

    // Check rate limit
    const rateLimitResult = checkRateLimit(origin);
    debugLog('Rate limit check:', rateLimitResult);

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

    // Parse request body
    const payload = req.body;
    debugLog('Request payload:', typeof payload, Object.keys(payload || {}));

    if (!payload) {
      debugLog('Missing payload');
      return res.status(400).json({
        error: 'Bad request',
        message: 'Request body is required'
      });
    }

    // Detect message type based on payload structure
    const isPlaygroundJobInvitation = payload.job_post_id && payload.agent_ids;
    const isClientFeedback = payload.message_type === 'client_feedback' || (payload.attempt_id && payload.client_message);
    const isRevisionRequest = payload.message_type === 'revision_request' || (payload.attempt_id && payload.revision_instructions);
    const isStatusUpdate = payload.message_type === 'status_update' || (payload.attempt_id && payload.status && !payload.client_message && !payload.revision_instructions);

    debugLog('Message type detection:', {
      isPlaygroundJobInvitation,
      isClientFeedback,
      isRevisionRequest,
      isStatusUpdate
    });

    let processed;
    let messageType;

    if (isPlaygroundJobInvitation) {
      debugLog('Processing playground job invitation');
      console.log('Processing playground job invitation:', payload);
      processed = await processPlaygroundJobInvitation(payload);
      messageType = 'playground_job_invitation';
    } else if (isClientFeedback) {
      console.log('Processing client feedback:', payload);
      processed = await processClientFeedback(payload);
      messageType = 'client_feedback';
    } else if (isRevisionRequest) {
      console.log('Processing revision request:', payload);
      processed = await processRevisionRequest(payload);
      messageType = 'revision_request';
    } else if (isStatusUpdate) {
      console.log('Processing status update:', payload);
      processed = await processStatusUpdate(payload);
      messageType = 'status_update';
    } else {
      console.log('Processing regular webhook:', payload);
      processed = processWebhookPayload(payload);
      messageType = 'regular_webhook';
    }

    debugLog('Processing completed, sending response');

    // Return success response
    return res.status(200).json({
      ...processed,
      request_tracking: {
        origin: origin || 'unknown',
        type: messageType
      },
      debug: DEBUG ? { timestamp: new Date().toISOString() } : undefined
    });

  } catch (error) {
    console.error('Webhook processing error:', {
      message: error.message,
      stack: DEBUG ? error.stack : error.stack?.split('\n')[0],
      origin: origin || 'unknown',
      payloadType: typeof payload === 'object' ? (payload?.job_post_id ? 'playground' : 'regular') : typeof payload,
      errorName: error.name,
      errorConstructor: error.constructor.name
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
      },
      debug: DEBUG ? {
        errorName: error.name,
        stack: error.stack?.split('\n').slice(0, 3),
        timestamp: new Date().toISOString()
      } : undefined
    });
  } catch (outerError) {
    // Catch-all for any errors in error handling
    console.error('Critical error in webhook handler:', outerError);
    return res.status(500).json({
      error: 'Critical handler error',
      message: 'Unexpected error in webhook processing',
      timestamp: new Date().toISOString()
    });
  }
}