import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { SkillGapReport } from "@/models/SkillGapReport";
import { DocumentInsight } from "@/models/DocumentInsight";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";
import { calculateSkillGap } from "@/lib/skills/calculateSkillGap";

const generateSkillGapSchema = z.object({
  conversationId: z.string().min(1).max(100),
  targetRole: z.string().min(1).max(200),
});

/**
 * POST /api/skill-gap/generate - Generate skill gap report
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, generateSkillGapSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { conversationId, targetRole } = validation.data;

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

    // Get latest resume insight
    const insight = await DocumentInsight.findOne({
      conversationId: new Types.ObjectId(conversationId),
      docType: "resume",
      status: "ready",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!insight || !insight.resultsJson) {
      return errors.validation("Resume insights not found. Please generate insights first.");
    }

    const detectedSkills = insight.resultsJson.detectedSkills || [];

    // Calculate skill gap
    const { score, missingSkills, recommendations } = calculateSkillGap(detectedSkills, targetRole);

    // Create or update skill gap report
    const report = await SkillGapReport.findOneAndUpdate(
      {
        conversationId: new Types.ObjectId(conversationId),
        targetRole,
      },
      {
        $set: {
          detectedSkills,
          missingSkills,
          score,
          recommendations,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(
      {
        id: report._id.toString(),
        conversationId: report.conversationId.toString(),
        targetRole: report.targetRole,
        detectedSkills: report.detectedSkills,
        missingSkills: report.missingSkills,
        score: report.score,
        recommendations: report.recommendations,
        createdAt: report.createdAt.toISOString(),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Generate skill gap error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while generating skill gap report");
  }
}





