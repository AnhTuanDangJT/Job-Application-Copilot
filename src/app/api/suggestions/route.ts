import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Suggestion } from "@/models/Suggestion";
import { ApplicationRow } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, createSuggestionSchema } from "@/lib/validation";
import { Types } from "mongoose";

export async function POST(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, createSuggestionSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { applicationId, field, oldValue, proposedValue } = validation.data;

  // Validate ObjectId format
  if (!isValidObjectId(applicationId)) {
    return errors.validation("Invalid application ID format");
  }

  try {
    await connectToDatabase();

    // Find application row
    const applicationRow = await ApplicationRow.findById(applicationId);
    if (!applicationRow) {
      return errors.notFound("Application not found");
    }

    const conversationId = applicationRow.conversationId.toString();

    // Check conversation access
    const accessCheck = await assertConversationAccess(conversationId, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;

    // Determine user role (only mentors can create suggestions in current design)
    const userIdObj = new Types.ObjectId(auth.sub);
    const proposedByRole = conversation.mentorId.equals(userIdObj) ? "mentor" : "mentee";

    // Verify the field exists in the application row
    if (!(field in applicationRow.cells)) {
      return errors.validation(`Field "${field}" does not exist in application`);
    }

    // Verify oldValue matches current value
    const currentValue = applicationRow.cells[field];
    if (JSON.stringify(currentValue) !== JSON.stringify(oldValue)) {
      return errors.validation("Application value has changed. Please refresh and try again.");
    }

    // Create suggestion
    const suggestion = await Suggestion.create({
      conversationId: applicationRow.conversationId,
      applicationId: applicationRow._id,
      field,
      oldValue,
      proposedValue,
      proposedByRole,
      status: "pending",
    });

    // Emit real-time event
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(conversationId, "suggestion.created", {
      conversationId,
      suggestionId: suggestion._id.toString(),
      applicationId: applicationRow._id.toString(),
      suggestion: {
        id: suggestion._id.toString(),
        field,
        oldValue,
        proposedValue,
        status: suggestion.status,
      },
    });

    return NextResponse.json(
      {
        id: suggestion._id.toString(),
        conversationId: conversationId,
        applicationId: applicationRow._id.toString(),
        field,
        oldValue,
        proposedValue,
        proposedByRole,
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

export async function GET(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { searchParams } = req.nextUrl;
  const conversationId = searchParams.get("conversationId");
  const applicationId = searchParams.get("applicationId");
  const status = searchParams.get("status") as "pending" | "accepted" | "rejected" | null;

  try {
    await connectToDatabase();

    const query: any = {};

    if (conversationId) {
      if (!isValidObjectId(conversationId)) {
        return errors.validation("Invalid conversation ID format");
      }
      // Check access
      const accessCheck = await assertConversationAccess(conversationId, auth.sub);
      if (!accessCheck.success) {
        return accessCheck.response;
      }
      query.conversationId = new Types.ObjectId(conversationId);
    }

    if (applicationId) {
      if (!isValidObjectId(applicationId)) {
        return errors.validation("Invalid application ID format");
      }
      query.applicationId = new Types.ObjectId(applicationId);
      
      // Verify access through application
      const app = await ApplicationRow.findById(applicationId);
      if (app) {
        const accessCheck = await assertConversationAccess(
          app.conversationId.toString(),
          auth.sub
        );
        if (!accessCheck.success) {
          return accessCheck.response;
        }
      }
    }

    if (status) {
      query.status = status;
    }

    const suggestions = await Suggestion.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

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



