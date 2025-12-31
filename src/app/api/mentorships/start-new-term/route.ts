import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { z } from "zod";
import { Types } from "mongoose";

const startNewTermSchema = z.object({
  conversationId: z.string().optional(),
  mentorId: z.string().optional(),
  menteeId: z.string().optional(),
});

/**
 * POST /api/mentorships/start-new-term
 * 
 * Starts a new active mentorship term (Conversation).
 * Can accept either conversationId (to extract mentorId/menteeId from existing conversation)
 * or explicit mentorId and menteeId.
 * 
 * Reuses existing conversation if one exists for the mentor-mentee pair (prevents duplicate key errors).
 * Updates existing conversation to ACTIVE status and sets lastMessageAt to current time.
 * Creates new conversation only if none exists.
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, startNewTermSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { conversationId, mentorId, menteeId } = validation.data;

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);
    let mentorIdObj: Types.ObjectId;
    let menteeIdObj: Types.ObjectId;

    // If conversationId is provided, extract mentorId and menteeId from it
    if (conversationId) {
      if (!isValidObjectId(conversationId)) {
        return errors.validation("Invalid conversation ID format");
      }

      const existingConversation = await Conversation.findById(conversationId).lean();
      if (!existingConversation) {
        return errors.notFound("Conversation not found");
      }

      // Verify user has access to this conversation
      if (
        !existingConversation.mentorId.equals(userId) &&
        !existingConversation.menteeId.equals(userId)
      ) {
        return errors.forbidden("You are not authorized to access this conversation");
      }

      mentorIdObj = new Types.ObjectId(existingConversation.mentorId);
      menteeIdObj = new Types.ObjectId(existingConversation.menteeId);
    } else if (mentorId && menteeId) {
      // Use explicit mentorId and menteeId
      if (!isValidObjectId(mentorId) || !isValidObjectId(menteeId)) {
        return errors.validation("Invalid mentor ID or mentee ID format");
      }

      mentorIdObj = new Types.ObjectId(mentorId);
      menteeIdObj = new Types.ObjectId(menteeId);

      // Verify user is either the mentor or mentee
      if (!mentorIdObj.equals(userId) && !menteeIdObj.equals(userId)) {
        return errors.forbidden("You are not authorized to start a mentorship between these users");
      }
    } else {
      return errors.validation("Either conversationId or both mentorId and menteeId must be provided");
    }

    // Check if a conversation already exists for this mentor-mentee pair
    let conversation = await Conversation.findOne({
      mentorId: mentorIdObj,
      menteeId: menteeIdObj,
    });

    const now = new Date();
    const isNewConversation = !conversation;

    if (conversation) {
      // Reuse existing conversation - update it to active status
      // Check original status before updating
      const wasCompleted = conversation.status === "COMPLETED" || conversation.status === "CANCELLED" || conversation.status === "ENDED";
      conversation.status = "ACTIVE";
      conversation.lastMessageAt = now;
      conversation.endedAt = null;
      conversation.completedAt = null;
      // Update startedAt to now if it was previously completed/ended (new term starts)
      if (wasCompleted) {
        conversation.startedAt = now;
      }
      await conversation.save();
    } else {
      // Create a NEW active conversation
      conversation = await Conversation.create({
        mentorId: mentorIdObj,
        menteeId: menteeIdObj,
        sessionType: "RESUME",
        status: "ACTIVE",
        goal: "Improve resume and job readiness",
        startedAt: now,
        lastMessageAt: now,
        // Explicitly set endedAt and completedAt to null/undefined
        endedAt: undefined,
        completedAt: undefined,
      });
    }

    if (!conversation) {
      return errors.internal("Failed to create or update mentorship term");
    }

    // Create SYSTEM welcome message only for new conversations
    if (isNewConversation) {
      try {
        await Message.create({
          conversationId: conversation._id,
          type: "SYSTEM",
          senderRole: "system",
          content: "Welcome to your new mentorship term. Use this space to review resumes, discuss applications, and track progress.",
          readBy: [],
        });
      } catch (msgError) {
        // Log error but don't fail the conversation creation
        console.error("[Start New Term] Failed to create welcome message:", msgError);
      }
    }

    return NextResponse.json(
      {
        id: conversation._id.toString(),
        conversationId: conversation._id.toString(),
        mentorId: conversation.mentorId.toString(),
        menteeId: conversation.menteeId.toString(),
        goal: conversation.goal,
        focusAreas: conversation.focusAreas,
        sessionType: conversation.sessionType,
        status: conversation.status,
        mentorship: { status: "active" },
        success: true,
        startedAt: conversation.startedAt,
        completedAt: conversation.completedAt,
        endedAt: conversation.endedAt,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt,
      },
      {
        status: isNewConversation ? 201 : 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Start new term error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while starting new mentorship term");
  }
}

