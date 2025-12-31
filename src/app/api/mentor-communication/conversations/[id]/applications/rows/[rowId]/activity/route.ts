import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationRow } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, addActivityLogSchema } from "@/lib/validation";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  // Rate limiting
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

  const validation = await validateRequestBody(req, addActivityLogSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { message } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;

    // Determine user role
    const userIdObj = new Types.ObjectId(auth.sub);
    const authorRole = conversation.mentorId.equals(userIdObj) ? "mentor" : "mentee";

    // Find application row and verify it belongs to this conversation
    const applicationRow = await ApplicationRow.findOne({
      _id: rowId,
      conversationId: id,
    });

    if (!applicationRow) {
      return errors.notFound("Application row not found in this conversation");
    }

    // Add activity log entry
    const activityLogId = randomUUID();
    if (!applicationRow.activityLog) {
      applicationRow.activityLog = [];
    }
    applicationRow.activityLog.push({
      id: activityLogId,
      authorRole,
      message,
      timestamp: new Date(),
    });

    await applicationRow.save();

    // Emit real-time event
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(id, "activityLog.created", {
      conversationId: id,
      applicationId: rowId,
      activityLogId: activityLogId,
      activityLog: {
        id: activityLogId,
        authorRole,
        message,
        timestamp: new Date(),
      },
    });

    return NextResponse.json(
      {
        id: activityLogId,
        authorRole,
        message,
        timestamp: new Date(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Add activity log error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while adding activity log entry");
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  // Rate limiting
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

    // Find application row and verify it belongs to this conversation
    const applicationRow = await ApplicationRow.findOne({
      _id: rowId,
      conversationId: id,
    }).lean();

    if (!applicationRow) {
      return errors.notFound("Application row not found in this conversation");
    }

    // Get query parameters for pagination
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const skip = (page - 1) * limit;

    // Get activity log entries (sorted by timestamp, newest first)
    // Handle dates that might be Date objects or strings
    const activityLog = (applicationRow.activityLog || []).map((entry) => ({
      ...entry,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
    })).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const paginatedLog = activityLog.slice(skip, skip + limit);

    return NextResponse.json(
      {
        activityLog: paginatedLog,
        pagination: {
          page,
          limit,
          total: activityLog.length,
          hasMore: skip + limit < activityLog.length,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get activity log error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching activity log");
  }
}

