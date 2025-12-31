/**
 * Server-Sent Events (SSE) endpoint for real-time collaboration updates
 * This provides real-time updates for collaboration features in Next.js App Router
 * 
 * Usage: GET /api/websocket?conversationId=<id>
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { collaborationEvents } from "@/lib/websocket/server";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { activeConnections, cleanupConnection } from "@/lib/websocket/broadcast";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) {
    return errors.unauthorized("Authentication required");
  }

  const { searchParams } = req.nextUrl;
  const conversationId = searchParams.get("conversationId");

  if (!conversationId || !isValidObjectId(conversationId)) {
    return errors.validation("Valid conversationId is required");
  }

  // Verify user has access to this conversation
  try {
    const { connectToDatabase } = await import("@/lib/db");
    await connectToDatabase();
    const accessCheck = await assertConversationAccess(conversationId, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }
  } catch (error) {
    return errors.internal("Failed to verify conversation access");
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const eventHandlers = new Map<string, (payload: any) => void>();

      // Send initial connection message
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", conversationId })}\n\n`));
      } catch (error) {
        // Connection already closed
        return;
      }

      // Create event handler
      const createHandler = (event: string) => {
        return (payload: any) => {
          if (payload.conversationId === conversationId) {
            try {
              const message = JSON.stringify({ type: event, ...payload });
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            } catch (error) {
              // Connection closed, cleanup
              cleanupConnection(controller);
            }
          }
        };
      };

      // Subscribe to all collaboration events
      const events = [
        "application.created",
        "application.updated",
        "suggestion.created",
        "suggestion.resolved",
        "reminder.created",
        "mentoringPlan.updated",
        "activityLog.created",
        "message:new",
        "notification:new",
        "insight:ready",
        "reminder:due",
        "suggestion:new",
        "dashboard:statsUpdated",
      ];

      events.forEach((event) => {
        const handler = createHandler(event);
        eventHandlers.set(event, handler);
        collaborationEvents.on(event, handler);
      });

      // Store connection info
      activeConnections.set(controller, {
        controller,
        conversationId,
        eventHandlers,
      });

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        cleanupConnection(controller);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

