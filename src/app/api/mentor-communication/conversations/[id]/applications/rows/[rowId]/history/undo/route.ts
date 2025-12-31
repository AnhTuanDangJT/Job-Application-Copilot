import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationRow } from "@/models/ApplicationRow";
import { ApplicationBoard } from "@/models/ApplicationBoard";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { id, rowId } = await params;

  // Validate ObjectId formats
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }
  if (!isValidObjectId(rowId)) {
    return errors.validation("Invalid row ID format");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userIdObj = new Types.ObjectId(auth.sub);
    const changedBy = conversation.mentorId.equals(userIdObj) ? "mentor" : "mentee";

    // Find application row and verify it belongs to this conversation
    const applicationRow = await ApplicationRow.findOne({
      _id: rowId,
      conversationId: id,
    });

    if (!applicationRow) {
      return errors.notFound("Application row not found in this conversation");
    }

    // Get history entries
    const history = (applicationRow.history || []).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (history.length === 0) {
      return errors.validation("No history to undo");
    }

    // Get the most recent history entry
    const lastChange = history[0];

    // Undo: set the field back to oldValue
    const oldValue = applicationRow.cells[lastChange.field];
    applicationRow.cells[lastChange.field] = lastChange.oldValue;

    // Create new history entry for the undo action (do not delete history)
    const undoHistoryId = randomUUID();
    if (!applicationRow.history) {
      applicationRow.history = [];
    }
    applicationRow.history.push({
      id: undoHistoryId,
      field: lastChange.field,
      oldValue: oldValue,
      newValue: lastChange.oldValue,
      changedBy,
      timestamp: new Date(),
    });

    // Add activity log entry
    const activityLogId = randomUUID();
    if (!applicationRow.activityLog) {
      applicationRow.activityLog = [];
    }
    applicationRow.activityLog.push({
      id: activityLogId,
      authorRole: changedBy,
      message: `Undid change to ${lastChange.field} (restored from "${oldValue}" back to "${lastChange.oldValue}")`,
      timestamp: new Date(),
    });

    await applicationRow.save();

    // Emit real-time events
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(id, "application.updated", {
      conversationId: id,
      applicationId: rowId,
      changes: { [lastChange.field]: lastChange.oldValue },
      application: {
        id: applicationRow._id.toString(),
        cells: applicationRow.cells,
      },
    });
    broadcastToConversation(id, "activityLog.created", {
      conversationId: id,
      applicationId: rowId,
      activityLogId: activityLogId,
    });

    return NextResponse.json(
      {
        success: true,
        field: lastChange.field,
        oldValue: oldValue,
        newValue: lastChange.oldValue,
        historyEntry: {
          id: undoHistoryId,
          field: lastChange.field,
          oldValue: oldValue,
          newValue: lastChange.oldValue,
          changedBy,
          timestamp: new Date(),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Undo error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while undoing change");
  }
}



