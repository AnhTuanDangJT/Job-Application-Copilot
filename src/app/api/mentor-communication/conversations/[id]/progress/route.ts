import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ResumeShare } from "@/models/ResumeShare";
import { Feedback } from "@/models/Feedback";
import { InterviewPrep } from "@/models/InterviewPrep";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

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

    const conversationId = new Types.ObjectId(id);

    // Get conversation to check for progress override
    const conversation = await Conversation.findById(id).lean();

    // Get resume statistics
    const resumesUploaded = await ResumeShare.countDocuments({
      conversationId,
      purpose: "REVIEW",
    });

    // A resume is considered REVIEWED if:
    // 1. status === "REVIEWED" OR
    // 2. reviewedAt is set (fallback for data consistency)
    const resumesReviewed = await ResumeShare.countDocuments({
      conversationId,
      purpose: "REVIEW",
      $or: [
        { status: "REVIEWED" },
        { reviewedAt: { $exists: true, $ne: null } }
      ],
    });

    // Get action items statistics
    const allFeedbacks = await Feedback.find({ conversationId }).lean();
    const totalActionItems = allFeedbacks.reduce(
      (sum, fb) => sum + (fb.actionItems?.length || 0),
      0
    );
    const completedActionItems = allFeedbacks.reduce(
      (sum, fb) => sum + (fb.actionItems?.filter((item) => item.done)?.length || 0),
      0
    );

    // Get interview prep statistics
    const interviewPrepQuestions = await InterviewPrep.countDocuments({
      conversationId,
    });

    const interviewPrepStrong = await InterviewPrep.countDocuments({
      conversationId,
      assessment: "STRONG",
    });

    // Calculate percentages (auto-computed values)
    const resumeProgress = resumesUploaded > 0 ? (resumesReviewed / resumesUploaded) * 100 : 0;
    const actionItemProgress = totalActionItems > 0 ? (completedActionItems / totalActionItems) * 100 : 0;
    const interviewPrepProgress = interviewPrepQuestions > 0 
      ? (interviewPrepStrong / interviewPrepQuestions) * 100 
      : 0;

    // Overall progress (weighted average)
    // Resume progress: 40%, Action items: 40%, Interview prep: 20% (if applicable)
    const hasInterviewPrep = interviewPrepQuestions > 0;
    const computedOverallProgress = hasInterviewPrep
      ? (resumeProgress * 0.4 + actionItemProgress * 0.4 + interviewPrepProgress * 0.2)
      : (resumeProgress * 0.5 + actionItemProgress * 0.5);

    // Check if there's a progress override
    const hasOverride = conversation?.progressOverride && conversation.progressOverride.overallPercent !== undefined;
    
    // Use override values if they exist, otherwise use computed values
    const finalOverallProgress = hasOverride 
      ? conversation.progressOverride.overallPercent 
      : Math.round(computedOverallProgress);
    
    const finalResumeReviewed = hasOverride 
      ? conversation.progressOverride.resumeReviewed 
      : (resumesReviewed > 0);
    
    const finalActionItemsCompleted = hasOverride 
      ? conversation.progressOverride.actionItemsCompleted 
      : completedActionItems;

    // Calculate final resume reviewed count and progress
    const finalResumesReviewedCount = hasOverride 
      ? (finalResumeReviewed ? resumesUploaded : 0)
      : resumesReviewed;
    const finalResumeProgress = resumesUploaded > 0 
      ? (finalResumesReviewedCount / resumesUploaded) * 100 
      : 0;

    return NextResponse.json(
      {
        resumesUploaded,
        resumesReviewed: finalResumesReviewedCount,
        resumeProgress: Math.round(finalResumeProgress),
        totalActionItems,
        completedActionItems: finalActionItemsCompleted,
        actionItemProgress: totalActionItems > 0 
          ? Math.round((finalActionItemsCompleted / totalActionItems) * 100) 
          : Math.round(actionItemProgress),
        interviewPrepQuestions,
        interviewPrepStrong,
        interviewPrepProgress: Math.round(interviewPrepProgress),
        overallProgress: finalOverallProgress,
        hasOverride: hasOverride || false,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get progress error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching progress");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentors can update progress
  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }

  try {
    // Parse request body
    const body = await req.json();
    const { overallPercent, resumeReviewed, actionItemsCompleted } = body;

    // Validate values
    if (overallPercent !== undefined && (typeof overallPercent !== "number" || overallPercent < 0 || overallPercent > 100)) {
      return errors.validation("overallPercent must be a number between 0 and 100");
    }
    if (resumeReviewed !== undefined && typeof resumeReviewed !== "boolean") {
      return errors.validation("resumeReviewed must be a boolean");
    }
    if (actionItemsCompleted !== undefined && (typeof actionItemsCompleted !== "number" || actionItemsCompleted < 0)) {
      return errors.validation("actionItemsCompleted must be a non-negative number");
    }

    await connectToDatabase();

    // Check conversation access and verify mentor is the conversation mentor
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Verify the user is the mentor of this conversation
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return errors.notFound("Conversation not found");
    }

    const mentorId = new Types.ObjectId(auth.sub);
    if (!conversation.mentorId.equals(mentorId)) {
      return errors.forbidden("Only the mentor of this conversation can update progress");
    }

    // Get current action items total to validate actionItemsCompleted
    const allFeedbacks = await Feedback.find({ conversationId: new Types.ObjectId(id) }).lean();
    const totalActionItems = allFeedbacks.reduce(
      (sum, fb) => sum + (fb.actionItems?.length || 0),
      0
    );

    // Validate actionItemsCompleted doesn't exceed total
    if (actionItemsCompleted !== undefined && actionItemsCompleted > totalActionItems) {
      return errors.validation(`actionItemsCompleted (${actionItemsCompleted}) cannot exceed total action items (${totalActionItems})`);
    }

    // Update progress override
    conversation.progressOverride = {
      overallPercent: overallPercent !== undefined ? overallPercent : conversation.progressOverride?.overallPercent ?? 0,
      resumeReviewed: resumeReviewed !== undefined ? resumeReviewed : conversation.progressOverride?.resumeReviewed ?? false,
      actionItemsCompleted: actionItemsCompleted !== undefined ? actionItemsCompleted : conversation.progressOverride?.actionItemsCompleted ?? 0,
      updatedAt: new Date(),
      updatedBy: mentorId,
    };

    await conversation.save();

    return NextResponse.json(
      { 
        success: true,
        progressOverride: conversation.progressOverride,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update progress error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating progress");
  }
}


