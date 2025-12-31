import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

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

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);
    const conversationId = new Types.ObjectId(id);

    // Find conversation and verify user is either mentor or mentee
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return errors.notFound("Conversation not found");
    }

    // Check if user is either mentor or mentee
    const isMentor = conversation.mentorId.equals(userId);
    const isMentee = conversation.menteeId.equals(userId);

    if (!isMentor && !isMentee) {
      return errors.forbidden("You are not authorized to end this mentorship");
    }

    // Check if already completed or cancelled
    if (conversation.status === "COMPLETED" || conversation.status === "CANCELLED" || conversation.status === "ENDED") {
      return errors.validation("Mentorship relationship has already been ended");
    }

    // Update conversation status to COMPLETED (preserves history, allows new mentorship)
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          status: "COMPLETED",
          endedAt: new Date(),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Mentorship term completed successfully. You can start a new mentorship with this user anytime.",
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("End mentorship error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while ending mentorship");
  }
}


