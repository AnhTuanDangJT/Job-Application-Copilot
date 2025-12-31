import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { DocumentInsight } from "@/models/DocumentInsight";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";
import { broadcastToConversation } from "@/lib/websocket/broadcast";

const approveInsightSchema = z.object({
  approvalStatus: z.enum(["approved", "rejected"]),
});

/**
 * PATCH /api/insights/[id]/approve - Approve or reject insight (mentor only)
 */
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

  // Check if user is mentor or admin
  if (auth.role !== "mentor" && auth.role !== "admin") {
    return errors.forbidden("Only mentors can approve insights");
  }

  const { id } = await params;

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid insight ID");
  }

  const validation = await validateRequestBody(req, approveInsightSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    await connectToDatabase();

    // Find insight
    const insight = await DocumentInsight.findById(id);
    if (!insight) {
      return errors.notFound("Insight not found");
    }

    // Check conversation access
    const accessCheck = await assertConversationAccess(
      insight.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Verify user is mentor in this conversation
    const conversation = accessCheck.conversation as { mentorId: Types.ObjectId };
    const userId = new Types.ObjectId(auth.sub);
    const mentorId = conversation.mentorId instanceof Types.ObjectId ? conversation.mentorId : new Types.ObjectId(conversation.mentorId as unknown as string);
    if (!mentorId.equals(userId) && auth.role !== "admin") {
      return errors.forbidden("Only the mentor for this conversation can approve insights");
    }

    // Update approval status
    insight.approvalStatus = validation.data.approvalStatus;
    await insight.save();

    // Broadcast update
    broadcastToConversation(insight.conversationId.toString(), "insight:ready", {
      insightId: insight._id.toString(),
      conversationId: insight.conversationId.toString(),
      docType: insight.docType,
      approvalStatus: insight.approvalStatus,
    });

    return NextResponse.json({
      id: insight._id.toString(),
      approvalStatus: insight.approvalStatus,
    });
  } catch (error) {
    console.error("Approve insight error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while approving insight");
  }
}


