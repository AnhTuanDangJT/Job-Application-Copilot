import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ReplySuggestion } from "@/models/ReplySuggestion";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";
import { broadcastToConversation } from "@/lib/websocket/broadcast";

const updateSuggestionSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  suggestedText: z.string().max(10000).optional(), // Allow mentor to edit
});

/**
 * PATCH /api/chat/suggestions/[id] - Accept or reject suggestion
 */
export async function PATCH(
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

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid suggestion ID");
  }

  const validation = await validateRequestBody(req, updateSuggestionSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    await connectToDatabase();

    // Find suggestion
    const suggestion = await ReplySuggestion.findById(id);
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

    // Update suggestion
    suggestion.status = validation.data.status;
    if (validation.data.suggestedText) {
      suggestion.suggestedText = validation.data.suggestedText;
    }
    await suggestion.save();

    // Broadcast update
    broadcastToConversation(suggestion.conversationId.toString(), "suggestion:new", {
      suggestionId: suggestion._id.toString(),
      conversationId: suggestion.conversationId.toString(),
      status: suggestion.status,
    });

    return NextResponse.json({
      id: suggestion._id.toString(),
      status: suggestion.status,
      suggestedText: suggestion.suggestedText,
    });
  } catch (error) {
    console.error("Update suggestion error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating suggestion");
  }
}


