# AI Webhook Agent

A simple webhook agent designed to receive playground job invitations and return dummy responses. Built for Vercel deployment with basic security.

## Features

- 🎯 **Playground Integration**: Handles job invitations with dummy responses
- 🔐 **Origin Whitelisting**: Only accepts requests from trusted domains
- 🚦 **Rate Limiting**: Basic per-origin request limits
- ⚡ **Simple Processing**: Lightweight job handling with placeholder responses
- 🚀 **Vercel Ready**: Optimized for serverless deployment
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
   PLAYGROUND_API_BASE=https://api.playground.example.com
   PLAYGROUND_AUTH_URL=https://api.playground.example.com/auth/token
   PLAYGROUND_API_KEY=your-api-key
   PLAYGROUND_API_SECRET=your-api-secret
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
   - Add all environment variables from `.env.example`
   - **Keep API credentials secure!**

## Usage

### **Playground Job Invitation:**
```bash
curl -X POST https://your-domain.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.domain.com" \
  -d '{
    "job_post_id": "123e4567-e89b-12d3-a456-426614174000",
    "agent_ids": ["550e8400-e29b-41d4-a716-446655440005"]
  }'
```

### **Regular Webhook:**
```bash
curl -X POST https://your-domain.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://trusted-domain.com" \
  -d '{"event": "test", "data": {"key": "value"}}'
```

**Headers:**
- `Origin`: Must match whitelisted origins
- `Content-Type`: application/json

### Response Format

**Playground Job Success (200):**
```json
{
  "webhook_status": "✅ Job invitation received and processed",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "ready",
    "processed_at": "2025-10-28T...",
    "processing_time": "150ms"
  },
  "job_details": {
    "job_id": "123e4567-e89b-12d3-a456-426614174000",
    "job_name": "Build React Component",
    "agent_id": "550e8400-e29b-41d4-a716-446655440005",
    "attempt_id": "abc12345-..."
  },
  "message": "Job attempt created and completed with dummy response"
}
```

**Regular Webhook Success (200):**
```json
{
  "webhook_status": "✅ Regular webhook received",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "ready",
    "processed_at": "2025-10-28T..."
  },
  "received_payload": {...},
  "message": "Non-playground webhook processed successfully"
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

## Playground Integration

### **Simple Job Workflow:**
1. **Receive webhook** → `{job_post_id, agent_ids}`
2. **Authenticate** → Get JWT token
3. **Fetch job details** → Get job info
4. **Create attempt** → Start job attempt
5. **Submit dummy response** → Complete with placeholder
6. **Return status** → Confirmation response

## Security

- Only POST requests are accepted
- Origin validation against whitelist
- Supports wildcard patterns (e.g., `*.example.com`)
- Per-origin rate limiting with sliding window
- JWT token caching and auto-refresh
- CORS headers configured
- Request size limits via Vercel
- In-memory stores (consider Redis for production scaling)

## Customization

### **To Customize:**
Replace the dummy response in `processPlaygroundJobInvitation()` function:

```javascript
// Change this line in api/webhook.js:
const deliverableContent = `Hello! I've received the job "${jobDetails.job_name || 'Untitled Job'}" and I'm ready to work on it. This is a placeholder response from AI-Gent v1.0.`;

// To your actual logic:
const deliverableContent = await yourActualJobProcessing(jobDetails);
```

Your simple webhook agent is ready for playground integration! 🚀
