import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Suggestion } from "@/models/Suggestion";
import { ApplicationRow } from "@/models/ApplicationRow";
import { assertConversationAccess, getOtherParticipant } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, createSuggestionSchema } from "@/lib/validation";
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
    return errors.validation("Invalid conversation ID format");
  }

  // Only mentors can create suggestions
  if (auth.role !== "mentor") {
    return errors.forbidden("Only mentors can create suggestions");
  }

  const validation = await validateRequestBody(req, createSuggestionSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { applicationId, field, oldValue, proposedValue } = validation.data;

  // Validate applicationId format
  if (!isValidObjectId(applicationId)) {
    return errors.validation("Invalid application ID format");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;

    // Verify the user is the mentor in this conversation
    const userIdObj = new Types.ObjectId(auth.sub);
    if (!conversation.mentorId.equals(userIdObj)) {
      return errors.forbidden("Only the mentor in this conversation can create suggestions");
    }

    // Verify application row exists and belongs to this conversation
    const applicationRow = await ApplicationRow.findOne({
      _id: applicationId,
      conversationId: id,
    });

    if (!applicationRow) {
      return errors.notFound("Application not found in this conversation");
    }

    // Get the current value of the field from cells or the oldValue if field doesn't exist
    const currentValue = applicationRow.cells[field] ?? oldValue;

    // Create suggestion
    const suggestion = await Suggestion.create({
      conversationId: new Types.ObjectId(id),
      applicationId: new Types.ObjectId(applicationId),
      field,
      oldValue: currentValue,
      proposedValue,
      proposedByRole: "mentor",
      status: "pending",
    });

    // Emit real-time event
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(id, "suggestion.created", {
      conversationId: id,
      suggestionId: suggestion._id.toString(),
      applicationId,
      suggestion: {
        id: suggestion._id.toString(),
        field: suggestion.field,
        oldValue: suggestion.oldValue,
        proposedValue: suggestion.proposedValue,
        status: suggestion.status,
      },
    });

    return NextResponse.json(
      {
        id: suggestion._id.toString(),
        conversationId: suggestion.conversationId.toString(),
        applicationId: suggestion.applicationId.toString(),
        field: suggestion.field,
        oldValue: suggestion.oldValue,
        proposedValue: suggestion.proposedValue,
        proposedByRole: suggestion.proposedByRole,
        status: suggestion.status,
        createdAt: suggestion.createdAt,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create suggestion error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating suggestion");
  }
}

export async function GET(
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
    return errors.validation("Invalid conversation ID format");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Get query parameters for filtering
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status"); // optional filter: "pending" | "accepted" | "rejected"

    // Build query
    const query: any = { conversationId: id };
    if (status && ["pending", "accepted", "rejected"].includes(status)) {
      query.status = status;
    }

    // Fetch suggestions
    const suggestions = await Suggestion.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Count pending suggestions
    const pendingCount = await Suggestion.countDocuments({
      conversationId: id,
      status: "pending",
    });

    return NextResponse.json(
      {
        suggestions: suggestions.map((s) => ({
          id: s._id.toString(),
          conversationId: s.conversationId.toString(),
          applicationId: s.applicationId.toString(),
          field: s.field,
          oldValue: s.oldValue,
          proposedValue: s.proposedValue,
          proposedByRole: s.proposedByRole,
          status: s.status,
          createdAt: s.createdAt,
          resolvedAt: s.resolvedAt,
        })),
        pendingCount,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get suggestions error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching suggestions");
  }
}

