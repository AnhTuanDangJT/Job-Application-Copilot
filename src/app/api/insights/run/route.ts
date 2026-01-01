import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { DocumentInsight } from "@/models/DocumentInsight";
import { Conversation } from "@/models/Conversation";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";
import { generateDocumentInsight } from "@/lib/insights/generateInsight";
import { createHash } from "crypto";
import { createNotification } from "@/lib/notifications";

const runInsightSchema = z.object({
  conversationId: z.string().min(1).max(100),
  docType: z.enum(["resume", "cover"]),
});

/**
 * POST /api/insights/run - Generate insights for a document
 * This enqueues a job that runs asynchronously
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, runInsightSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { conversationId, docType } = validation.data;

  if (!isValidObjectId(conversationId)) {
    return errors.validation("Invalid conversation ID");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(conversationId, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Get user's document text
    const user = await User.findById(auth.sub).select("cv_text cover_letter_text").lean();
    if (!user || Array.isArray(user)) {
      return errors.notFound("User not found");
    }

    const documentText = docType === "resume" ? user.cv_text : user.cover_letter_text;
    if (!documentText || documentText.trim().length === 0) {
      return errors.validation(`${docType === "resume" ? "Resume" : "Cover letter"} text not found. Please upload the document first.`);
    }

    // Create hash of input text to detect duplicates
    const inputHash = createHash("sha256").update(documentText).digest("hex");

    // Check if insight already exists for this hash
    const existingInsight = await DocumentInsight.findOne({
      conversationId: new Types.ObjectId(conversationId),
      docType,
      inputHash,
    }).lean();

    if (existingInsight && !Array.isArray(existingInsight)) {
      return NextResponse.json({
        id: String(existingInsight._id),
        conversationId: String(existingInsight.conversationId),
        docType: existingInsight.docType,
        status: existingInsight.status,
        approvalStatus: existingInsight.approvalStatus,
        createdAt: existingInsight.createdAt.toISOString(),
      });
    }

    // Create pending insight
    const insight = await DocumentInsight.create({
      conversationId: new Types.ObjectId(conversationId),
      docType,
      inputHash,
      status: "pending",
      approvalStatus: "pending",
    });

    // Process insight asynchronously (don't await to avoid blocking)
    processInsightAsync(insight._id.toString(), documentText, docType, conversationId).catch(
      (error) => {
        console.error("[Insight] Failed to process insight:", error);
      }
    );

    return NextResponse.json(
      {
        id: insight._id.toString(),
        conversationId: insight.conversationId.toString(),
        docType: insight.docType,
        status: insight.status,
        approvalStatus: insight.approvalStatus,
        createdAt: insight.createdAt.toISOString(),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Run insight error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while generating insights");
  }
}

/**
 * Process insight asynchronously (worker function)
 */
async function processInsightAsync(
  insightId: string,
  text: string,
  docType: "resume" | "cover",
  conversationId: string
): Promise<void> {
  try {
    await connectToDatabase();

    // Generate insights
    const results = await generateDocumentInsight(text, docType);

    // Update insight with results
    await DocumentInsight.findByIdAndUpdate(insightId, {
      $set: {
        status: "ready",
        resultsJson: results,
      },
    });

    // Get conversation to notify participants
    const conversation = await Conversation.findById(conversationId).lean();
    if (conversation && !Array.isArray(conversation)) {
      const title = `${docType === "resume" ? "Resume" : "Cover letter"} insights ready`;
      const body = `Insights have been generated for your ${docType}.`;
      const link = `/mentor-communication/${conversationId}`;

      // Notify mentor
      await createNotification(
        String(conversation.mentorId),
        conversationId,
        "insight_ready",
        title,
        body,
        link,
        { insightId, docType }
      ).catch((error) => {
        console.error("[Insight] Failed to notify mentor:", error);
      });

      // Notify mentee
      await createNotification(
        conversation.menteeId.toString(),
        conversationId,
        "insight_ready",
        title,
        body,
        link,
        { insightId, docType }
      ).catch((error) => {
        console.error("[Insight] Failed to notify mentee:", error);
      });

      // Broadcast insight:ready event
      const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
      broadcastToConversation(conversationId, "insight:ready", {
        insightId,
        conversationId,
        docType,
      });
    }
  } catch (error) {
    console.error("[Insight] Error processing insight:", error);
    // Mark as failed
    await DocumentInsight.findByIdAndUpdate(insightId, {
      $set: { status: "failed" },
    }).catch(() => {
      // Ignore update errors
    });
  }
}


