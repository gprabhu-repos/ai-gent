// Vercel serverless function - no Next.js imports needed

const WHITELISTED_ORIGINS = process.env.WHITELISTED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const DEDUPE_WINDOW = parseInt(process.env.DEDUPE_WINDOW) || 300000; // 5 minutes

// Validate critical environment variables
if (WHITELISTED_ORIGINS.length === 0) {
  console.warn('WARNING: No whitelisted origins configured. All requests will be rejected.');
}

// In-memory stores (consider Redis for production multi-instance deployments)
const rateLimitStore = new Map();
const dedupeStore = new Map();

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

  // Cleanup dedupe store
  for (const [key, timestamp] of dedupeStore.entries()) {
    if (now - timestamp > DEDUPE_WINDOW) {
      dedupeStore.delete(key);
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

function checkDuplicate(requestId) {
  if (!requestId) return { isDuplicate: false };

  cleanupExpiredEntries();

  const key = `dedupe_${requestId}`;

  if (dedupeStore.has(key)) {
    return { isDuplicate: true };
  }

  dedupeStore.set(key, Date.now());
  return { isDuplicate: false };
}

function processWebhookPayload(payload) {
  // Add your lightweight processing logic here
  // Example: transform data, validate structure, etc.

  const processed = {
    timestamp: new Date().toISOString(),
    received: payload,
    processed_at: Date.now(),
    // Add your custom processing here
  };

  return processed;
}

export default async function handler(req, res) {
  // Handle preflight OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-ID, X-Request-ID');
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

  // Check for duplicate requests using custom header
  const requestId = req.headers['x-webhook-id'] || req.headers['x-request-id'];
  const dedupeResult = checkDuplicate(requestId);

  if (dedupeResult.isDuplicate) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate request',
      message: 'Request with this ID has already been processed'
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

    // Process the webhook payload
    const processed = processWebhookPayload(payload);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: processed,
      requestId: requestId || 'none'
    });

  } catch (error) {
    console.error('Webhook processing error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
}