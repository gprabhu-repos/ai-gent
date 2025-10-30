# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI webhook agent for Upwork's Agent Playground API. It's designed as a serverless application that receives job invitations, handles client feedback, and manages the complete iterative workflow for AI agents on the Upwork platform.

## Architecture

### Core Structure
- **Serverless Vercel Functions**: All logic is in `/api/` directory as Vercel edge functions
- **Main Webhook Handler**: `/api/agents/{agent-id}/webhook/events.js` - handles all incoming webhooks
- **Agent-Specific Routing**: Uses agent ID in URL path for routing (currently: `79913705-ac88-443f-bc68-e9dd39380ba4`)
- **Memory-Based Storage**: Uses in-memory Maps for rate limiting and request deduplication (not persistent)

### Key Components
1. **Authentication System**: OAuth2 client credentials flow with JWT token caching
2. **Signature Verification**: HMAC-SHA256 verification using Upwork's signature format
3. **Rate Limiting**: Per-origin sliding window rate limiting
4. **Origin Whitelisting**: Configurable CORS protection
5. **Message Type Detection**: Automatic routing based on webhook payload structure

### Webhook Message Types
- **Job Invitation**: `{job_post_id, agent_ids}` → Creates attempt with dummy response
- **Client Feedback**: `{attempt_id, client_message, requires_revision}` → Handles revisions or acknowledgments
- **Revision Request**: `{attempt_id, revision_instructions}` → Processes explicit revision requests
- **Status Update**: `{attempt_id, status}` → Acknowledges status changes

## Development Commands

### Local Development
```bash
npm run dev          # Start local development server with Vercel CLI
```

### Deployment
```bash
npm run deploy       # Deploy to production Vercel
vercel --prod        # Alternative deployment command
```

### Testing
```bash
node test-auth-minimal.js    # Test OAuth2 token generation
node get-agent-id.js         # Register new agent and get agent ID
python test_signature.py     # Test signature verification logic
```

## Environment Configuration

Copy `.env.example` to `.env.local` for local development. Key variables:

- `PLAYGROUND_API_KEY` / `PLAYGROUND_API_SECRET`: Upwork API credentials
- `WHITELISTED_ORIGINS`: Comma-separated list of allowed origins (supports wildcards)
- `WEBHOOK_SECRET`: Secret for signature verification
- `DEBUG`: Enable detailed logging

## API Integration Flow

### Authentication
1. Uses client credentials OAuth2 flow
2. Caches JWT tokens until expiry
3. Auto-refreshes tokens on API calls

### Job Processing Workflow
1. **Receive webhook** → Validate signature and origin
2. **Authenticate** → Get/refresh JWT token
3. **Fetch job details** → Call GET `/jobs/{job_id}`
4. **Create attempt** → Call POST `/attempts`
5. **Submit response** → Call PATCH `/attempts/{attempt_id}`

### Security Measures
- HMAC-SHA256 signature verification using `{request_id}.{timestamp}.{payload}` format
- Origin validation against whitelist with wildcard support
- Per-origin rate limiting (default: 100 requests/minute)
- Request ID deduplication to prevent replay attacks

## File Structure

- `/api/agents/{agent-id}/webhook/events.js` - Main webhook handler
- `/api/webhook-*.js` - Alternative webhook implementations
- `/docs/` - API documentation and workflow guides
- `get-agent-id.js` - Agent registration utility
- `test-auth-minimal.js` - Authentication testing
- `test_signature.py` - Signature verification testing
- `vercel.json` - Vercel deployment configuration with routing

## Important Notes

- The current implementation returns dummy responses for all jobs
- Rate limiting and request storage are in-memory only (not persistent across deployments)
- Agent ID is hardcoded in URL routing (`79913705-ac88-443f-bc68-e9dd39380ba4`)
- No formal test suite - uses standalone test scripts for specific functionality
- Designed for Upwork Agent Playground integration specifically

## Customization

To implement actual job processing, modify the `deliverableContent` generation in the main webhook handler. The current placeholder logic should be replaced with real AI agent functionality.