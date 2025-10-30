import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { start } from "workflow/api";
import { handleJobInvitation } from "../../../../../workflows/handleJobInvitation";
import { handleJobMessage } from "../../../../../workflows/handleJobMessage";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

// Maximum allowed age for webhook timestamps (2 minutes in milliseconds)
const MAX_TIMESTAMP_AGE_MS = 2 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Extract agent ID from route parameter
    const { agentId } = await params;

    if (!agentId) {
      return Response.json(
        { error: "Missing agentId in route parameter" },
        { status: 400 }
      );
    }

    console.log(`Processing webhook for agent: ${agentId}`);

    // Extract required headers
    const signature = request.headers.get("x-up-signature");
    const upId = request.headers.get("x-up-id");
    const upTimestamp = request.headers.get("x-up-timestamp");

    // Check if signature header is present
    if (!signature) {
      return new Response("Missing X-Up-Signature header", { status: 401 });
    }

    // Check if signature has correct format
    if (!signature.startsWith("sha256=")) {
      return new Response("Invalid signature format", { status: 401 });
    }

    // Check if required headers are present
    if (!upId || !upTimestamp) {
      return new Response("Missing required headers", { status: 401 });
    }

    // Extract the signature value (remove "sha256=" prefix)
    const expectedSignature = signature.substring(7);

    // Read the request body
    const bodyText = await request.text();

    // Construct the raw payload as per specification
    const rawPayload = `${upId}.${upTimestamp}.${bodyText}`;

    // Compute HMAC-SHA256 signature
    const computedSignature = createHmac("sha256", WEBHOOK_SECRET)
      .update(rawPayload)
      .digest("hex");

    // Use constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(expectedSignature, "hex");
    const computedBuffer = Buffer.from(computedSignature, "hex");

    if (signatureBuffer.length !== computedBuffer.length) {
      return new Response("Invalid signature", { status: 401 });
    }

    if (!timingSafeEqual(signatureBuffer, computedBuffer)) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Verify timestamp is not older than 2 minutes
    const timestampMs = parseInt(upTimestamp, 10);
    const currentTimeMs = Date.now();
    const timeDifference = currentTimeMs - timestampMs;

    if (timeDifference > MAX_TIMESTAMP_AGE_MS) {
      return new Response("Timestamp too old", { status: 401 });
    }

    // Signature and timestamp are valid, parse the event
    const event = JSON.parse(bodyText);

    console.log(`Received webhook event:`, event);

    // Handle health check - return immediately without workflow
    if (event.event_type === "agent.health_check") {
      return Response.json({
        success: true,
        message: "Health check received",
        event_type: event.event_type,
        timestamp: event.timestamp,
      });
    }

    // Handle job invitation event - start durable workflow
    if (event.event_type === "agent.job.invitation") {
      const { job_post_id } = event;

      if (!job_post_id) {
        return Response.json(
          { error: "Missing job_post_id in event" },
          { status: 400 }
        );
      }

      console.log(
        `Starting handleJobInvitation workflow for job_post_id: ${job_post_id}, agent_id: ${agentId}`
      );

      // Start workflow asynchronously (non-blocking)
      await start(handleJobInvitation, [
        {
          job_post_id,
          agent_id: agentId,
        },
      ]);

      // Return 200 immediately
      return Response.json({
        success: true,
        message: "Job invitation workflow started",
        event_type: event.event_type,
        job_post_id,
      });
    }

    // Handle job message event - start durable workflow
    if (event.event_type === "agent.job.message") {
      const { job_post_id } = event;

      if (!job_post_id) {
        return Response.json(
          { error: "Missing job_post_id in event" },
          { status: 400 }
        );
      }

      console.log(
        `Starting handleJobMessage workflow for job_post_id: ${job_post_id}, agent_id: ${agentId}`
      );

      // Start workflow asynchronously (non-blocking)
      await start(handleJobMessage, [
        {
          job_post_id,
          agent_id: agentId,
        },
      ]);

      // Return 200 immediately
      return Response.json({
        success: true,
        message: "Job message workflow started",
        event_type: event.event_type,
        job_post_id,
      });
    }

    // Handle other event types
    return Response.json({
      success: true,
      message: "Event received",
      event_type: event.event_type,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
