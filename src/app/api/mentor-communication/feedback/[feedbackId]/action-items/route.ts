import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Feedback } from "@/models/Feedback";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { z } from "zod";
import { Types } from "mongoose";

const toggleActionItemSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { feedbackId } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(feedbackId)) {
    return errors.validation("Invalid feedback ID format");
  }

  const validation = await validateRequestBody(req, toggleActionItemSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { index, done } = validation.data;

  try {
    await connectToDatabase();

    // Find feedback
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return errors.notFound("Feedback not found");
    }

    // Verify user is the mentee in this feedback
    const userId = new Types.ObjectId(auth.sub);
    if (!feedback.menteeId.equals(userId)) {
      return errors.forbidden("Only the mentee can update action items");
    }

    // Validate index
    if (index < 0 || index >= feedback.actionItems.length) {
      return errors.validation("Invalid action item index");
    }

    // Update the action item
    feedback.actionItems[index].done = done;
    await feedback.save();

    return NextResponse.json(
      {
        id: feedback._id.toString(),
        actionItems: feedback.actionItems,
        updatedAt: feedback.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Toggle action item error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating action item");
  }
}






