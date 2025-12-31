import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { z } from "zod";
import { Types } from "mongoose";

const updateConversationSchema = z.object({
  goal: z.string().max(500).optional(),
  focusAreas: z.array(z.enum(["Resume", "Interview", "Job Search", "Networking"])).optional(),
  sessionType: z.enum(["RESUME", "INTERVIEW", "JOB_SEARCH"]).optional(),
  status: z.enum(["ACTIVE", "COMPLETED"]).optional(),
});

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

  const validation = await validateRequestBody(req, updateConversationSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { goal, focusAreas, sessionType, status } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);

    // Only mentor can mark status as COMPLETED
    if (status === "COMPLETED") {
      if (!conversation.mentorId.equals(userId) && auth.role !== "admin") {
        return errors.forbidden("Only the mentor can mark a session as completed");
      }
    }

    // Update conversation fields (ONLY mutable fields: goal, focusAreas, sessionType, status)
    // CRITICAL: mentorId and menteeId are IMMUTABLE - never update them
    const updateData: { 
      goal?: string; 
      focusAreas?: string[]; 
      sessionType?: "RESUME" | "INTERVIEW" | "JOB_SEARCH";
      status?: "ACTIVE" | "COMPLETED";
      completedAt?: Date;
    } = {};
    if (goal !== undefined) {
      updateData.goal = goal;
    }
    if (focusAreas !== undefined) {
      updateData.focusAreas = focusAreas;
    }
    if (sessionType !== undefined) {
      updateData.sessionType = sessionType;
    }
    if (status !== undefined) {
      updateData.status = status;
      // Set completedAt when status is set to COMPLETED
      if (status === "COMPLETED" && !conversation.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    // Use $set to explicitly update only allowed fields (prevents accidental mentorId/menteeId mutation)
    const updated = await Conversation.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updated) {
      return errors.notFound("Conversation not found");
    }

    return NextResponse.json(
      {
        id: updated._id.toString(),
        mentorId: updated.mentorId.toString(),
        menteeId: updated.menteeId.toString(),
        goal: updated.goal,
        focusAreas: updated.focusAreas,
        sessionType: updated.sessionType,
        status: updated.status,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
        lastMessageAt: updated.lastMessageAt,
        lastMessagePreview: updated.lastMessagePreview,
        updatedAt: updated.updatedAt,
        createdAt: updated.createdAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update conversation error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating conversation");
  }
}

