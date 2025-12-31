import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Suggestion } from "@/models/Suggestion";
import { ApplicationRow } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { id } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid suggestion ID format");
  }

  // Only mentees can accept suggestions
  if (auth.role !== "mentee") {
    return errors.forbidden("Only mentees can accept suggestions");
  }

  try {
    await connectToDatabase();

    // Find suggestion
    const suggestion = await Suggestion.findById(id);
    if (!suggestion) {
      return errors.notFound("Suggestion not found");
    }

    // Check conversation access
    const accessCheck = await assertConversationAccess(
      suggestion.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;

    // Verify the user is the mentee in this conversation
    const userIdObj = new Types.ObjectId(auth.sub);
    if (!conversation.menteeId.equals(userIdObj)) {
      return errors.forbidden("Only the mentee in this conversation can accept suggestions");
    }

    // Verify suggestion is pending
    if (suggestion.status !== "pending") {
      return errors.validation("Only pending suggestions can be accepted");
    }

    // Find application row
    const applicationRow = await ApplicationRow.findById(suggestion.applicationId);
    if (!applicationRow) {
      return errors.notFound("Application not found");
    }

    // Verify application row belongs to this conversation
    if (!applicationRow.conversationId.equals(suggestion.conversationId)) {
      return errors.forbidden("Application does not belong to this conversation");
    }

    // Get old value from cells
    const oldValue = applicationRow.cells[suggestion.field];

    // Update application row cell
    applicationRow.cells[suggestion.field] = suggestion.proposedValue;

    // Add history entry
    const historyId = randomUUID();
    if (!applicationRow.history) {
      applicationRow.history = [];
    }
    applicationRow.history.push({
      id: historyId,
      field: suggestion.field,
      oldValue,
      newValue: suggestion.proposedValue,
      changedBy: "mentee",
      timestamp: new Date(),
    });

    // Add activity log entry
    const activityLogId = randomUUID();
    if (!applicationRow.activityLog) {
      applicationRow.activityLog = [];
    }
    applicationRow.activityLog.push({
      id: activityLogId,
      authorRole: "mentee",
      message: `Accepted suggestion to change ${suggestion.field} from "${oldValue}" to "${suggestion.proposedValue}"`,
      timestamp: new Date(),
    });

    // Save application row
    await applicationRow.save();

    // Update suggestion status
    suggestion.status = "accepted";
    suggestion.resolvedAt = new Date();
    await suggestion.save();

    // Emit real-time events
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    const conversationId = suggestion.conversationId.toString();
    broadcastToConversation(conversationId, "suggestion.resolved", {
      conversationId,
      suggestionId: suggestion._id.toString(),
      applicationId: suggestion.applicationId.toString(),
      status: "accepted",
    });
    broadcastToConversation(conversationId, "application.updated", {
      conversationId,
      applicationId: applicationRow._id.toString(),
      changes: { [suggestion.field]: suggestion.proposedValue },
    });

    return NextResponse.json(
      {
        id: suggestion._id.toString(),
        status: suggestion.status,
        resolvedAt: suggestion.resolvedAt,
        application: {
          id: applicationRow._id.toString(),
          cells: applicationRow.cells,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Accept suggestion error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while accepting suggestion");
  }
}

