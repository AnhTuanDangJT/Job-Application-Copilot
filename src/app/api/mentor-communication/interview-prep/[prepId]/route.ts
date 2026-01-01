import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { InterviewPrep } from "@/models/InterviewPrep";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { z } from "zod";
import { Types } from "mongoose";

const updateInterviewPrepSchema = z.object({
  question: z.string().min(1).max(1000).optional(),
  assessment: z.enum(["WEAK", "AVERAGE", "STRONG"]).optional(),
  notes: z.string().max(10000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ prepId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentors can update interview prep questions
  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { prepId } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(prepId)) {
    return errors.validation("Invalid interview prep ID format");
  }

  const validation = await validateRequestBody(req, updateInterviewPrepSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { question, assessment, notes } = validation.data;

  try {
    await connectToDatabase();

    // Find interview prep
    const interviewPrep = await InterviewPrep.findById(prepId);
    if (!interviewPrep) {
      return errors.notFound("Interview prep question not found");
    }

    // Check conversation access and verify user is the mentor
    const accessCheck = await assertConversationAccess(
      interviewPrep.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);

    // Verify user is the mentor
    if (!conversation.mentorId.equals(userId)) {
      return errors.forbidden("Only the assigned mentor can update interview prep questions");
    }

    // Update interview prep question
    const updateData: { question?: string; assessment?: "WEAK" | "AVERAGE" | "STRONG"; notes?: string } = {};
    if (question !== undefined) {
      updateData.question = question.trim();
    }
    if (assessment !== undefined) {
      updateData.assessment = assessment;
    }
    if (notes !== undefined) {
      updateData.notes = notes?.trim();
    }

    const updated = await InterviewPrep.findByIdAndUpdate(
      prepId,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updated) {
      return errors.notFound("Interview prep question not found");
    }

    return NextResponse.json(
      {
        id: updated._id.toString(),
        conversationId: updated.conversationId.toString(),
        question: updated.question,
        assessment: updated.assessment,
        notes: updated.notes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update interview prep error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating interview prep");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ prepId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentors can delete interview prep questions
  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { prepId } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(prepId)) {
    return errors.validation("Invalid interview prep ID format");
  }

  try {
    await connectToDatabase();

    // Find interview prep
    const interviewPrep = await InterviewPrep.findById(prepId);
    if (!interviewPrep) {
      return errors.notFound("Interview prep question not found");
    }

    // Check conversation access and verify user is the mentor
    const accessCheck = await assertConversationAccess(
      interviewPrep.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);

    // Verify user is the mentor
    if (!conversation.mentorId.equals(userId)) {
      return errors.forbidden("Only the assigned mentor can delete interview prep questions");
    }

    // Delete interview prep question
    await InterviewPrep.findByIdAndDelete(prepId);

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Delete interview prep error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while deleting interview prep");
  }
}







