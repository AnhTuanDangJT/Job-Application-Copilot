import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { SkillGapReport } from "@/models/SkillGapReport";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateQueryParams, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";

const skillGapQuerySchema = z.object({
  conversationId: z.string().min(1).max(100),
});

/**
 * GET /api/skill-gap - Get skill gap reports for a conversation
 */
export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  // Validate query parameters
  const queryValidation = validateQueryParams(req.nextUrl.searchParams, skillGapQuerySchema);
  if (!queryValidation.success) {
    return errors.validation(queryValidation.error);
  }

  const { conversationId } = queryValidation.data;

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

    // Fetch skill gap reports
    const reports = await SkillGapReport.find({
      conversationId: new Types.ObjectId(conversationId),
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        reports: reports.map((report) => ({
          id: report._id.toString(),
          conversationId: report.conversationId.toString(),
          targetRole: report.targetRole,
          detectedSkills: report.detectedSkills,
          missingSkills: report.missingSkills,
          score: report.score,
          recommendations: report.recommendations,
          createdAt: report.createdAt.toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get skill gap error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching skill gap reports");
  }
}




