import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ReplySuggestion } from "@/models/ReplySuggestion";
import { Message } from "@/models/Message";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";
import { broadcastToConversation } from "@/lib/websocket/broadcast";

const suggestReplySchema = z.object({
  conversationId: z.string().min(1).max(100),
  messageContextIds: z.array(z.string().min(1).max(100)).min(1).max(10),
});

/**
 * POST /api/chat/suggest-reply - Generate AI reply suggestion
 */
export async function POST(req: NextRequest) {
  // Rate limiting (stricter for AI suggestions)
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, suggestReplySchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { conversationId, messageContextIds } = validation.data;

  if (!isValidObjectId(conversationId)) {
    return errors.validation("Invalid conversation ID");
  }

  // Validate all message IDs
  for (const msgId of messageContextIds) {
    if (!isValidObjectId(msgId)) {
      return errors.validation("Invalid message ID in context");
    }
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(conversationId, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Fetch context messages
    const contextMessages = await Message.find({
      _id: { $in: messageContextIds.map((id) => new Types.ObjectId(id)) },
      conversationId: new Types.ObjectId(conversationId),
    })
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();

    if (contextMessages.length === 0) {
      return errors.validation("No valid context messages found");
    }

    // Generate suggestion (simplified - in production use actual AI)
    const contextText = contextMessages
      .map((msg) => `${msg.senderRole}: ${msg.content}`)
      .join("\n");
    
    // Simple rule-based suggestion (replace with actual AI in production)
    const suggestedText = generateReplySuggestion(contextText);

    // Create suggestion
    const suggestion = await ReplySuggestion.create({
      conversationId: new Types.ObjectId(conversationId),
      messageContextIds: messageContextIds.map((id) => new Types.ObjectId(id)),
      suggestedText,
      createdBy: new Types.ObjectId(auth.sub),
      status: "pending",
    });

    // Broadcast suggestion:new event
    broadcastToConversation(conversationId, "suggestion:new", {
      suggestionId: suggestion._id.toString(),
      conversationId,
      suggestedText,
      createdBy: auth.sub,
    });

    return NextResponse.json(
      {
        id: suggestion._id.toString(),
        conversationId: suggestion.conversationId.toString(),
        suggestedText: suggestion.suggestedText,
        status: suggestion.status,
        createdAt: suggestion.createdAt.toISOString(),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Suggest reply error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while generating reply suggestion");
  }
}

/**
 * Generate reply suggestion (simplified - replace with GitHub Models API)
 */
function generateReplySuggestion(context: string): string {
  // Simple rule-based generation
  // In production, replace with GitHub Models API using GITHUB_TOKEN
  if (context.toLowerCase().includes("thank")) {
    return "You're welcome! Happy to help.";
  }
  if (context.toLowerCase().includes("question")) {
    return "That's a great question. Let me think about that and get back to you.";
  }
  return "Thank you for your message. I'll review this and provide feedback soon.";
}


