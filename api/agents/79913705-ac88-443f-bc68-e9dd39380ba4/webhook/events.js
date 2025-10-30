import { createHmac, timingSafeEqual } from 'crypto';

const rateLimitStore = new Map();
const requestIdStore = new Set();
let jwtToken = null;
let tokenExpiry = null;

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

function verifySignature(payload, signature, secret, debug = false) {
  if (debug) {
    console.log('[SIGNATURE DEBUG]', {
      hasSignature: !!signature,
      hasSecret: !!secret,
      secretLength: secret?.length,
      signatureLength: signature?.length,
      payloadLength: payload?.length
    });
  }

  if (!signature || !secret) {
    if (debug) console.log('[SIGNATURE DEBUG] Missing signature or secret');
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  if (debug) {
    console.log('[SIGNATURE DEBUG]', {
      providedSignature: providedSignature.substring(0, 16) + '...',
      expectedSignature: expectedSignature.substring(0, 16) + '...',
      signaturesMatch: providedSignature === expectedSignature
    });
  }

  return timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
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

export default async function handler(req, res) {
  const DEBUG = process.env.DEBUG === 'true';

  function debugLog(...args) {
    if (DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  try {
    const WEBHOOK_SECRET = process.env.UPWORK_WEBHOOK_SECRET;
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
      hasBody: !!req.body,
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

    const signature = req.headers['x-up-signature'];
    const timestamp = req.headers['x-up-timestamp'];
    const requestId = req.headers['x-up-id'];

    // For signature verification, we need the exact body Upwork sent
    // Vercel parses JSON, so we reconstruct it consistently
    const rawBody = JSON.stringify(req.body);

    debugLog('Body info:', {
      bodyType: typeof req.body,
      bodyLength: rawBody.length,
      bodyKeys: req.body ? Object.keys(req.body) : 'none',
      rawBodySample: rawBody.substring(0, 100)
    });

    debugLog('Webhook headers:', {
      signature: signature ? signature.substring(0, 20) + '...' : 'missing',
      timestamp,
      requestId,
      hasWebhookSecret: !!WEBHOOK_SECRET,
      webhookSecretLength: WEBHOOK_SECRET?.length
    });

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET, DEBUG)) {
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
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Request body is required'
      });
    }

    // Simple message type detection
    const isPlaygroundJobInvitation = payload.job_post_id && payload.agent_ids;
    const isClientFeedback = payload.message_type === 'client_feedback' || (payload.attempt_id && payload.client_message);

    let messageType;
    let response;

    if (isPlaygroundJobInvitation) {
      messageType = 'playground_job_invitation';
      response = {
        webhook_status: "✅ Job invitation received (placeholder response)",
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
        message: "Placeholder response - real API integration disabled for testing"
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

    debugLog('Sending response:', { messageType, status: 'success' });

    return res.status(200).json({
      ...response,
      request_tracking: {
        origin: origin,
        type: messageType
      },
      debug: DEBUG ? { timestamp: new Date().toISOString() } : undefined
    });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      debug: DEBUG ? { stack: error.stack?.split('\n').slice(0, 3) } : undefined
    });
  }
}