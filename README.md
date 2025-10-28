# AI Webhook Agent

A lightweight webhook agent designed to receive external webhooks, perform processing, and return responses. Built for Vercel deployment with origin whitelisting security.

## Features

- 🔐 **Origin Whitelisting**: Only accepts requests from configured trusted domains
- 🚦 **Rate Limiting**: Configurable per-origin request limits with sliding window
- 🔄 **Request Deduplication**: Prevents duplicate processing using header-based IDs
- ⚡ **Lightweight Processing**: Fast webhook payload processing
- 🚀 **Vercel Ready**: Optimized for serverless deployment
- 🛡️ **Security**: Built-in CORS and origin validation
- 🔧 **Configurable**: Environment-based configuration

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and update the whitelisted origins:
   ```bash
   cp .env.example .env.local
   ```

3. **Configure environment variables in `.env.local`:**
   ```
   WHITELISTED_ORIGINS=https://example.com,https://api.partner.com,https://*.trusted-domain.com
   RATE_LIMIT_MAX_REQUESTS=100
   RATE_LIMIT_WINDOW=60000
   DEDUPE_WINDOW=300000
   ```

## Deployment

### Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add `WHITELISTED_ORIGINS` environment variable

## Usage

Send POST requests to `/api/webhook` with JSON payload:

```bash
curl -X POST https://your-domain.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://trusted-domain.com" \
  -H "X-Webhook-ID: unique-request-id-123" \
  -d '{"event": "test", "data": {"key": "value"}}'
```

**Headers:**
- `X-Webhook-ID` or `X-Request-ID`: Unique identifier for deduplication (optional but recommended)
- `Origin`: Must match whitelisted origins

### Response Format

**Success (200):**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "timestamp": "2023-10-27T...",
    "received": {...},
    "processed_at": 1698432000000
  },
  "requestId": "unique-request-id-123"
}
```

**Rate Limited (429):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "resetTime": 1698432060000
}
```

**Duplicate Request (409):**
```json
{
  "success": false,
  "error": "Duplicate request",
  "message": "Request with this ID has already been processed"
}
```

**Forbidden (403):**
```json
{
  "error": "Forbidden",
  "message": "Origin not whitelisted"
}
```

**Response Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Window`: Rate limit window duration (ms)

## Security

- Only POST requests are accepted
- Origin validation against whitelist
- Supports wildcard patterns (e.g., `*.example.com`)
- Per-origin rate limiting with sliding window
- Request deduplication prevents replay attacks
- CORS headers configured
- Request size limits via Vercel
- In-memory stores (consider Redis for production scaling)

## Customization

Edit the `processWebhookPayload()` function in `api/webhook.js` to add your specific processing logic:

```javascript
function processWebhookPayload(payload) {
  // Add your custom processing here
  const processed = {
    timestamp: new Date().toISOString(),
    received: payload,
    // Your custom fields
  };
  return processed;
}
```
