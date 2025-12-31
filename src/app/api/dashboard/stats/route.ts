import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { ApplicationRow } from "@/models/ApplicationRow";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { Types } from "mongoose";

/**
 * GET /api/dashboard/stats
 * 
 * Returns dashboard statistics derived from ApplicationRow (single source of truth).
 * For mentees: finds their conversation and queries ApplicationRow by conversationId.
 * Stats are computed dynamically from ApplicationRow.cells.status.
 */
export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);

    // Find active conversation for this mentee (only show stats for active mentorship)
    const conversationRaw = await Conversation.findOne({ 
      menteeId: userId,
      status: "ACTIVE"
    }).lean();
    
    if (!conversationRaw || Array.isArray(conversationRaw)) {
      // No conversation yet - return zero stats
      return NextResponse.json(
        {
          applicationsCount: 0,
          interviewsCount: 0,
          offersCount: 0,
          rejectedCount: 0,
          conversationId: null,
        },
        {
          headers: {
            "Cache-Control": "private, no-store", // No cache to ensure real-time updates
          },
        }
      );
    }

    const conversation = conversationRaw as unknown as { _id: Types.ObjectId | string };
    const conversationId = conversation._id instanceof Types.ObjectId ? conversation._id : new Types.ObjectId(conversation._id);

    // Get all ApplicationRows for this conversation (single source of truth)
    const rows = await ApplicationRow.find({ conversationId }).lean();

    // Compute stats from ApplicationRow.cells.status
    // Status is stored in cells.status field
    // Note: Status values may be capitalized ("Applied", "Interview", "Offer", "Rejected")
    // or lowercase, so we normalize for comparison
    let applicationsCount = 0;
    let interviewsCount = 0;
    let offersCount = 0;
    let rejectedCount = 0;

    for (const row of rows) {
      const status = row.cells?.status;
      if (status) {
        applicationsCount++;
        // Normalize status to lowercase for comparison (handles "Applied", "Interview", etc.)
        const normalizedStatus = String(status).toLowerCase().trim();
        if (normalizedStatus === "interview") {
          interviewsCount++;
        } else if (normalizedStatus === "offer") {
          offersCount++;
        } else if (normalizedStatus === "rejected") {
          rejectedCount++;
        }
        // "applied" or "submitted" are counted in applicationsCount but not in specific categories
      } else {
        // Count rows without status as applications
        applicationsCount++;
      }
    }

    return NextResponse.json(
      {
        applicationsCount,
        interviewsCount,
        offersCount,
        rejectedCount,
        conversationId: conversationId.toString(), // Return conversationId for real-time updates
      },
      {
        headers: {
          "Cache-Control": "private, no-store", // No cache to ensure real-time updates
        },
      }
    );
  } catch (error) {
    console.error("Get dashboard stats error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching dashboard stats");
  }
}

