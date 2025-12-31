import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { DocumentInsight } from "@/models/DocumentInsight";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateQueryParams, isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";

const insightsQuerySchema = z.object({
  conversationId: z.string().min(1).max(100),
  docType: z.enum(["resume", "cover"]).optional(),
});

/**
 * GET /api/insights - Get insights for a conversation
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
  const queryValidation = validateQueryParams(req.nextUrl.searchParams, insightsQuerySchema);
  if (!queryValidation.success) {
    return errors.validation(queryValidation.error);
  }

  const { conversationId, docType } = queryValidation.data;

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

    // Build query
    const query: any = { conversationId: new Types.ObjectId(conversationId) };
    if (docType) {
      query.docType = docType;
    }

    // Fetch insights
    const insights = await DocumentInsight.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
      insights: insights.map((insight) => ({
        id: (insight._id as unknown as Types.ObjectId).toString(),
          conversationId: insight.conversationId.toString(),
          docType: insight.docType,
          status: insight.status,
          resultsJson: insight.resultsJson,
          approvalStatus: insight.approvalStatus,
          createdAt: insight.createdAt.toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get insights error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching insights");
  }
}


