import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, updateMentoringPlanSchema } from "@/lib/validation";
import { Types } from "mongoose";

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

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }

  // Only mentors can update mentoring plan
  if (auth.role !== "mentor") {
    return errors.forbidden("Only mentors can update mentoring plan");
  }

  const validation = await validateRequestBody(req, updateMentoringPlanSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { goals, milestones, mentorNotes, menteeNotes } = validation.data;

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
      return errors.forbidden("Only the mentor in this conversation can update mentoring plan");
    }

    // Get or initialize mentoring plan
    const currentPlan = conversation.mentoringPlan || {
      goals: [],
      milestones: [],
      mentorNotes: "",
      menteeNotes: "",
      lastUpdatedBy: "mentor" as const,
      updatedAt: new Date(),
    };

    // Update fields (only provided fields)
    const updatedPlan = {
      goals: goals !== undefined ? goals : currentPlan.goals,
      milestones: milestones !== undefined ? milestones : currentPlan.milestones,
      mentorNotes: mentorNotes !== undefined ? mentorNotes : currentPlan.mentorNotes,
      menteeNotes: menteeNotes !== undefined ? menteeNotes : currentPlan.menteeNotes,
      lastUpdatedBy: "mentor" as const,
      updatedAt: new Date(),
    };

    // Update conversation
    const updated = await Conversation.findByIdAndUpdate(
      id,
      { $set: { mentoringPlan: updatedPlan } },
      { new: true }
    ).lean();

    if (!updated) {
      return errors.notFound("Conversation not found");
    }

    // Emit real-time event
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(id, "mentoringPlan.updated", {
      conversationId: id,
      mentoringPlan: updated.mentoringPlan,
    });

    return NextResponse.json(
      {
        mentoringPlan: updated.mentoringPlan,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update mentoring plan error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating mentoring plan");
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

    const conversation = accessCheck.conversation;

    return NextResponse.json(
      {
        mentoringPlan: conversation.mentoringPlan || null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get mentoring plan error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching mentoring plan");
  }
}

