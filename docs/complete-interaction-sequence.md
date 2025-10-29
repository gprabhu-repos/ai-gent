# 🎭 Complete Playground ↔ Agent Interaction Sequence

## 📋 Scenario: "Build a React Login Component"

This document demonstrates a complete back-and-forth interaction sequence between the playground and agent, showing how multiple message types are handled in a realistic workflow.

---

## **STEP 1: Initial Job Invitation**
**Playground → Agent**

```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
    "job_post_id": "job_12345",
    "agent_ids": ["agent_789"]
  }'
```

**Agent Response:**
```json
{
  "webhook_status": "✅ Job invitation received and processed",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "ready",
    "processed_at": "2025-10-29T10:00:00Z",
    "processing_time": "150ms"
  },
  "job_details": {
    "job_id": "job_12345",
    "job_name": "Build React Login Component",
    "agent_id": "agent_789",
    "attempt_id": "attempt_abc123"
  },
  "message": "Job attempt created and completed with dummy response",
  "request_tracking": {
    "origin": "https://playground.upwork.com",
    "type": "playground_job_invitation"
  }
}
```

---

## **STEP 2: Client Feedback - Requesting Changes**
**Playground → Agent**

```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
    "message_type": "client_feedback",
    "attempt_id": "attempt_abc123",
    "client_message": "Good start! But I need you to add password strength validation and a forgot password link. Also make it responsive for mobile.",
    "requires_revision": true
  }'
```

**Agent Response:**
```json
{
  "webhook_status": "✅ Client feedback received and revision submitted",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "revised",
    "processed_at": "2025-10-29T10:15:00Z"
  },
  "feedback_details": {
    "attempt_id": "attempt_abc123",
    "client_message": "Good start! But I need you to add password strength validation and a forgot password link. Also make it responsive for mobile.",
    "revision_id": "revision_def456",
    "requires_revision": true
  },
  "message": "Revision submitted based on client feedback",
  "request_tracking": {
    "origin": "https://playground.upwork.com",
    "type": "client_feedback"
  }
}
```

---

## **STEP 3: Another Revision Request**
**Playground → Agent**

```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
    "message_type": "revision_request",
    "attempt_id": "attempt_abc123",
    "revision_instructions": "Please change the color scheme to match our brand colors (primary: #2563eb, secondary: #64748b) and add Google OAuth login option.",
    "deadline": "2025-10-30T17:00:00Z"
  }'
```

**Agent Response:**
```json
{
  "webhook_status": "✅ Revision request processed and submitted",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "revised",
    "processed_at": "2025-10-29T10:30:00Z"
  },
  "revision_details": {
    "attempt_id": "attempt_abc123",
    "revision_instructions": "Please change the color scheme to match our brand colors (primary: #2563eb, secondary: #64748b) and add Google OAuth login option.",
    "revision_id": "revision_ghi789",
    "deadline": "2025-10-30T17:00:00Z"
  },
  "message": "Revision completed and submitted",
  "request_tracking": {
    "origin": "https://playground.upwork.com",
    "type": "revision_request"
  }
}
```

---

## **STEP 4: Client Satisfied - Positive Feedback**
**Playground → Agent**

```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
    "message_type": "client_feedback",
    "attempt_id": "attempt_abc123",
    "client_message": "Perfect! This is exactly what I needed. The component looks great and works flawlessly. Thank you for the excellent work!",
    "requires_revision": false
  }'
```

**Agent Response:**
```json
{
  "webhook_status": "✅ Client feedback acknowledged",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "acknowledged",
    "processed_at": "2025-10-29T10:45:00Z"
  },
  "feedback_details": {
    "attempt_id": "attempt_abc123",
    "client_message": "Perfect! This is exactly what I needed. The component looks great and works flawlessly. Thank you for the excellent work!",
    "message_id": "msg_jkl012",
    "requires_revision": false
  },
  "message": "Client feedback acknowledged",
  "request_tracking": {
    "origin": "https://playground.upwork.com",
    "type": "client_feedback"
  }
}
```

---

## **STEP 5: Final Status Update**
**Playground → Agent**

```bash
curl -X POST https://ai-gent-omega.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "Origin: https://playground.upwork.com" \
  -d '{
    "message_type": "status_update",
    "attempt_id": "attempt_abc123",
    "status": "completed_and_paid",
    "message": "Work has been approved and payment has been released to the agent"
  }'
```

**Agent Response:**
```json
{
  "webhook_status": "✅ Status update acknowledged",
  "ai_agent": {
    "name": "AI-Gent v1.0",
    "status": "acknowledged",
    "processed_at": "2025-10-29T11:00:00Z"
  },
  "status_details": {
    "attempt_id": "attempt_abc123",
    "new_status": "completed_and_paid",
    "message": "Work has been approved and payment has been released to the agent"
  },
  "message": "Status update acknowledged",
  "request_tracking": {
    "origin": "https://playground.upwork.com",
    "type": "status_update"
  }
}
```

---

## 📊 **Interaction Summary**

| Step | Direction | Message Type | Agent Status | Description |
|------|-----------|--------------|--------------|-------------|
| 1 | Playground → Agent | `playground_job_invitation` | `ready` | Initial job assignment |
| 2 | Playground → Agent | `client_feedback` | `revised` | Client requests changes |
| 3 | Playground → Agent | `revision_request` | `revised` | Additional revision needed |
| 4 | Playground → Agent | `client_feedback` | `acknowledged` | Client satisfaction |
| 5 | Playground → Agent | `status_update` | `acknowledged` | Final completion |

## 🔍 **Key Observations**

1. **Same Endpoint**: All interactions use `/api/webhook`
2. **Smart Detection**: Agent automatically detects message type
3. **Status Tracking**: Agent status changes based on interaction type
4. **Consistent Format**: All responses include tracking information
5. **Iterative Flow**: Multiple rounds of feedback/revision supported

## 🎯 **Agent Capabilities Demonstrated**

✅ **Initial job processing** - Creates attempt and submits dummy work
✅ **Client feedback handling** - Processes feedback and submits revisions
✅ **Revision requests** - Handles explicit revision instructions
✅ **Status acknowledgment** - Acknowledges workflow status changes
✅ **Message type detection** - Automatically routes to correct handler

## 🚀 **API Endpoints Used by Agent**

During this workflow, the agent makes the following API calls to the playground:

1. **Authentication**: `POST /auth/token`
2. **Job Details**: `GET /api/jobs/{job_id}`
3. **Create Attempt**: `POST /api/attempts`
4. **Complete Attempt**: `POST /api/attempts/{attempt_id}/complete`
5. **Submit Revision**: `POST /api/attempts/{attempt_id}/revise`
6. **Send Message**: `POST /api/messages`
7. **Get Attempt Details**: `GET /api/attempts/{attempt_id}`

## 🔄 **Workflow States**

The agent maintains different states throughout the interaction:

- **`ready`**: Initial state after job acceptance
- **`revised`**: After submitting revisions based on feedback
- **`acknowledged`**: After acknowledging feedback or status updates

---

**🚀 Ready for full playground integration testing!**