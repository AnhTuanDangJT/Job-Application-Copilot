import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Message } from "@/models/Message";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * DELETE /api/mentor-communication/messages/[messageId]
 * Soft-delete a message (only the sender can delete their own message)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { messageId } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(messageId)) {
    return errors.validation("Invalid message ID format");
  }

  try {
    await connectToDatabase();

    // Find the message
    const message = await Message.findById(messageId).lean();
    if (!message) {
      return errors.notFound("Message not found");
    }

    // Check if message is already deleted
    if (message.deletedAt) {
      return errors.validation("Message is already deleted");
    }

    // Verify user is the sender of the message
    if (!message.senderId || message.senderId.toString() !== auth.sub) {
      return errors.forbidden("You can only delete your own messages");
    }

    // Verify user has access to the conversation (additional security check)
    const accessCheck = await assertConversationAccess(
      message.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Soft delete: set deletedAt and deletedBy (DO NOT remove the message)
    const userId = new Types.ObjectId(auth.sub);
    await Message.findByIdAndUpdate(messageId, {
      $set: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return NextResponse.json(
      { message: "Message deleted successfully" },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Delete message error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while deleting message");
  }
}

