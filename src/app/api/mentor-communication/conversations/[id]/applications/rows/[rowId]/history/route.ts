import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationRow } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { id, rowId } = await params;

  // Validate ObjectId formats
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }
  if (!isValidObjectId(rowId)) {
    return errors.validation("Invalid row ID format");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Find application row and verify it belongs to this conversation
    const applicationRow = await ApplicationRow.findOne({
      _id: rowId,
      conversationId: id,
    }).lean();

    if (!applicationRow) {
      return errors.notFound("Application row not found in this conversation");
    }

    // Get query parameters for pagination
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const skip = (page - 1) * limit;

    // Get history entries (sorted by timestamp, newest first)
    const history = (applicationRow.history || []).map((entry) => ({
      ...entry,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
    })).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const paginatedHistory = history.slice(skip, skip + limit);

    return NextResponse.json(
      {
        history: paginatedHistory,
        pagination: {
          page,
          limit,
          total: history.length,
          hasMore: skip + limit < history.length,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get history error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching history");
  }
}





