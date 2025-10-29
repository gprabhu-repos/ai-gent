# Iterative Workflow Test Documentation

## 🧪 Testing Iterative Workflow Support

This document contains test payloads and validation for the iterative workflow functionality.

## 📋 Test Payloads

### Job Invitation
```json
{
  "job_post_id": "123e4567-e89b-12d3-a456-426614174000",
  "agent_ids": ["550e8400-e29b-41d4-a716-446655440005"]
}
```

### Client Feedback (Requiring Revision)
```json
{
  "message_type": "client_feedback",
  "attempt_id": "attempt_789",
  "client_message": "Great start! Can you add dark mode support and improve the styling?",
  "requires_revision": true
}
```

### Client Feedback (Acknowledgment)
```json
{
  "message_type": "client_feedback",
  "attempt_id": "attempt_789",
  "client_message": "Perfect! This looks exactly what I needed. Thank you!",
  "requires_revision": false
}
```

### Revision Request
```json
{
  "message_type": "revision_request",
  "attempt_id": "attempt_789",
  "revision_instructions": "Please add responsive design for mobile devices and update the color scheme to match our brand guidelines",
  "deadline": "2025-10-30T12:00:00Z"
}
```

### Status Update
```json
{
  "message_type": "status_update",
  "attempt_id": "attempt_789",
  "status": "approved",
  "message": "Work has been approved by client"
}
```

### Implicit Client Feedback (without explicit message_type)
```json
{
  "attempt_id": "attempt_789",
  "client_message": "This is good but needs some tweaks",
  "requires_revision": true
}
```

### Implicit Revision Request (without explicit message_type)
```json
{
  "attempt_id": "attempt_789",
  "revision_instructions": "Make the buttons bigger and change color to blue"
}
```

## 🔍 Message Type Detection Logic

The agent detects message types using the following logic:

```javascript
const isPlaygroundJobInvitation = payload.job_post_id && payload.agent_ids;
const isClientFeedback = payload.message_type === 'client_feedback' || (payload.attempt_id && payload.client_message);
const isRevisionRequest = payload.message_type === 'revision_request' || (payload.attempt_id && payload.revision_instructions);
const isStatusUpdate = payload.message_type === 'status_update' || (payload.attempt_id && payload.status && !payload.client_message && !payload.revision_instructions);
```

## 🚀 Test Commands

### 1. Initial Job Invitation
```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
  "job_post_id": "123e4567-e89b-12d3-a456-426614174000",
  "agent_ids": [
    "550e8400-e29b-41d4-a716-446655440005"
  ]
}'
```

### 2. Client Feedback Requiring Revision
```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
  "message_type": "client_feedback",
  "attempt_id": "attempt_789",
  "client_message": "Great start! Can you add dark mode support and improve the styling?",
  "requires_revision": true
}'
```

### 3. Client Feedback (Positive)
```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
  "message_type": "client_feedback",
  "attempt_id": "attempt_789",
  "client_message": "Perfect! This looks exactly what I needed. Thank you!",
  "requires_revision": false
}'
```

### 4. Explicit Revision Request
```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
  "message_type": "revision_request",
  "attempt_id": "attempt_789",
  "revision_instructions": "Please add responsive design for mobile devices and update the color scheme to match our brand guidelines",
  "deadline": "2025-10-30T12:00:00Z"
}'
```

### 5. Status Update
```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
  "message_type": "status_update",
  "attempt_id": "attempt_789",
  "status": "approved",
  "message": "Work has been approved by client"
}'
```

## 📝 Expected Response Patterns

### Job Invitation Response
- `webhook_status`: "✅ Job invitation received and processed"
- `ai_agent.status`: "ready"
- `job_details`: {job_id, job_name, agent_id, attempt_id}
- `message`: "Job attempt created and completed with dummy response"
- `request_tracking.type`: "playground_job_invitation"

### Client Feedback (Revision) Response
- `webhook_status`: "✅ Client feedback received and revision submitted"
- `ai_agent.status`: "revised"
- `feedback_details`: {attempt_id, client_message, revision_id}
- `message`: "Revision submitted based on client feedback"
- `request_tracking.type`: "client_feedback"

### Client Feedback (Acknowledge) Response
- `webhook_status`: "✅ Client feedback acknowledged"
- `ai_agent.status`: "acknowledged"
- `feedback_details`: {attempt_id, client_message, message_id}
- `message`: "Client feedback acknowledged"
- `request_tracking.type`: "client_feedback"

### Revision Request Response
- `webhook_status`: "✅ Revision request processed and submitted"
- `ai_agent.status`: "revised"
- `revision_details`: {attempt_id, revision_instructions, revision_id}
- `message`: "Revision completed and submitted"
- `request_tracking.type`: "revision_request"

### Status Update Response
- `webhook_status`: "✅ Status update acknowledged"
- `ai_agent.status`: "acknowledged"
- `status_details`: {attempt_id, new_status, message}
- `message`: "Status update acknowledged"
- `request_tracking.type`: "status_update"

## ✅ Validation Results

All message types are correctly detected:
- ✅ `playground_job_invitation` - Job invitations
- ✅ `client_feedback` - Client feedback messages
- ✅ `revision_request` - Revision requests
- ✅ `status_update` - Status updates
- ✅ `regular_webhook` - Fallback for unrecognized formats

## 🎉 Implementation Status

**Iterative Workflow Support Implementation Complete!**
- Message type detection working correctly
- All curl commands ready for testing
- Response patterns documented
- Ready for full playground interaction testing!