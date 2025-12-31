import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Feedback } from "@/models/Feedback";
import { ResumeShare } from "@/models/ResumeShare";
import { Message } from "@/models/Message";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { createFeedbackSchema } from "@/lib/validation";
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

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Get feedback for this conversation
    const feedbacks = await Feedback.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        feedbacks: feedbacks.map((fb) => ({
          id: fb._id.toString(),
          conversationId: fb.conversationId.toString(),
          resumeShareId: fb.resumeShareId.toString(),
          mentorId: fb.mentorId.toString(),
          menteeId: fb.menteeId.toString(),
          feedbackText: fb.feedbackText,
          strengths: fb.strengths,
          issues: fb.issues,
          actionItems: fb.actionItems || [],
          rating: fb.rating,
          createdAt: fb.createdAt,
          updatedAt: fb.updatedAt,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get feedback error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching feedback");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentors can create feedback
  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const validation = await validateRequestBody(req, createFeedbackSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { resumeShareId, feedbackText, strengths, issues, actionItems, rating } = validation.data;

  try {
    await connectToDatabase();

    // Validate resumeShareId format
    if (!isValidObjectId(resumeShareId)) {
      return errors.validation("Invalid resume share ID format");
    }

    // Check conversation access (must match mentorId)
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);

    // Verify user is the mentor
    if (!conversation.mentorId.equals(userId)) {
      return errors.forbidden("Only the assigned mentor can provide feedback");
    }

    // Verify resumeShareId belongs to this conversation
    const resumeShare = await ResumeShare.findById(resumeShareId).lean();
    if (!resumeShare) {
      return errors.notFound("Resume share not found");
    }

    if (!resumeShare.conversationId.equals(new Types.ObjectId(id))) {
      return errors.forbidden("Resume share does not belong to this conversation");
    }

    // Feedback can ONLY be attached to mentee-uploaded resumes (purpose === "REVIEW")
    // Mentor-uploaded resumes (purpose === "REFERENCE" or "EDITED_VERSION") CANNOT receive feedback
    const resumePurpose = resumeShare.purpose || "REVIEW"; // Default for backward compatibility
    if (resumePurpose !== "REVIEW") {
      return errors.forbidden("Feedback can only be provided on resumes uploaded by mentees for review");
    }

    // Convert actionItems strings to objects with done: false and createdAt
    const actionItemsArray = actionItems?.map((text) => ({
      text: text.trim(),
      done: false,
      createdAt: new Date(),
    })) || [];

    // Create feedback - use feedbackText for backward compatibility or combine strengths/issues
    const feedbackTextToStore = feedbackText || 
      (strengths || issues ? `${strengths ? `Strengths: ${strengths}\n\n` : ''}${issues ? `Issues: ${issues}` : ''}`.trim() : '');

    // Create feedback
    const feedback = await Feedback.create({
      conversationId: new Types.ObjectId(id),
      resumeShareId: new Types.ObjectId(resumeShareId),
      mentorId: userId,
      menteeId: conversation.menteeId,
      feedbackText: feedbackTextToStore,
      strengths,
      issues,
      actionItems: actionItemsArray,
      rating,
    });

    // Update resume status to REVIEWED
    // CRITICAL: Set reviewedAt when feedback is created (source of truth for "resume reviewed")
    // This update is non-blocking - feedback creation succeeds even if resume update fails
    try {
      await ResumeShare.updateOne(
        { _id: resumeShareId },
        {
          $set: {
            status: "REVIEWED",
            reviewedAt: new Date(),
            reviewedBy: userId,
          },
        }
      );
    } catch (updateError) {
      // Log warning but don't fail feedback creation
      console.warn(
        "[Create Feedback] Failed to update ResumeShare reviewedAt:",
        updateError instanceof Error ? updateError.message : "Unknown error",
        { resumeShareId, feedbackId: feedback._id.toString() }
      );
    }

    // Create Message with type FEEDBACK
    const messagePreview = feedbackTextToStore.length > 100 
      ? feedbackTextToStore.substring(0, 100) + "..." 
      : feedbackTextToStore;
    const messageContent = `Feedback on ${resumeShare.originalName}: ${messagePreview}`;
    
    const message = await Message.create({
      conversationId: new Types.ObjectId(id),
      senderId: userId,
      senderRole: "mentor",
      type: "FEEDBACK",
      content: messageContent,
      resumeShareId: new Types.ObjectId(resumeShareId),
      readBy: [userId], // Sender has read their own message
    });

    // Update conversation lastMessagePreview and lastMessageAt
    // CRITICAL: Only update mutable fields (never mentorId/menteeId)
    await Conversation.findByIdAndUpdate(
      id,
      {
        $set: {
          lastMessagePreview: messageContent,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    return NextResponse.json(
      {
        id: feedback._id.toString(),
        conversationId: feedback.conversationId.toString(),
        resumeShareId: feedback.resumeShareId.toString(),
        mentorId: feedback.mentorId.toString(),
        menteeId: feedback.menteeId.toString(),
        feedbackText: feedback.feedbackText,
        strengths: feedback.strengths,
        issues: feedback.issues,
        actionItems: feedback.actionItems,
        rating: feedback.rating,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
        messageId: message._id.toString(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create feedback error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating feedback");
  }
}

