import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Application } from "@/models/Application";
import { ApplicationRow } from "@/models/ApplicationRow";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, updateMenteeMetadataSchema } from "@/lib/validation";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);

    // Get all ACTIVE conversations where user is mentor
    const conversations = await Conversation.find({ 
      mentorId,
      status: "ACTIVE" // Only show active relationships
    })
      .populate("menteeId", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    // Get stats and recent applications for each mentee
    const mentees = await Promise.all(
      conversations.map(async (conv) => {
        const conversationId = conv._id.toString();
        const mentee = conv.menteeId as any;
        const menteeUserId = mentee._id;

        // IMPORTANT: Use ApplicationRow as single source of truth (not Application table)
        // ApplicationRow is where users update applications in the Applications board
        const allRows = await ApplicationRow.find({ conversationId: conv._id })
          .sort({ updatedAt: -1 })
          .lean();

        // Derive counts from ApplicationRow.cells.status (single source of truth)
        // Note: Status values may be capitalized ("Applied", "Interview", "Offer", "Rejected")
        // or lowercase, so we normalize for comparison
        let applicationsCount = 0;
        let interviewsCount = 0;
        let offersCount = 0;
        let rejectedCount = 0;

        for (const row of allRows) {
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

        // Count reminders due soon from ApplicationRow
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        let followUpsDueCount = 0;
        
        for (const row of allRows) {
          if (row.reminders && Array.isArray(row.reminders)) {
            followUpsDueCount += row.reminders.filter((reminder: any) => {
              if (!reminder.date) return false;
              const reminderDate = new Date(reminder.date);
              return reminderDate >= now && reminderDate <= sevenDaysFromNow;
            }).length;
          }
        }

        // Get recent applications (last 5) from ApplicationRow
        const recentApplications = allRows.slice(0, 5).map((row) => {
          const company = row.cells?.company || row.cells?.companyName || "";
          const role = row.cells?.role || row.cells?.position || row.cells?.jobTitle || "";
          const status = row.cells?.status || "submitted";
          const tags = row.tags || [];
          
          return {
            id: row._id.toString(),
            company: typeof company === "string" ? company : "",
            role: typeof role === "string" ? role : "",
            status: typeof status === "string" ? status : "submitted",
            lastUpdated: row.updatedAt,
            tags: tags.map((tag: any) => ({
              id: tag.id || "",
              label: tag.label || "",
              color: tag.color || "#CAAE92",
            })),
          };
        });

        return {
          conversationId: conversationId,
          menteeId: mentee._id.toString(),
          menteeName: mentee.name || "Unknown",
          menteeEmail: mentee.email || "",
          targetRole: conv.menteeMetadata?.targetRole || "",
          targetLocations: conv.menteeMetadata?.targetLocations || [],
          season: conv.menteeMetadata?.season || "",
          currentPhase: conv.menteeMetadata?.currentPhase || "",
          menteeTags: conv.menteeMetadata?.menteeTags || [],
          notes: conv.menteeMetadata?.notes || "",
          applicationsCount,
          interviewsCount,
          offersCount,
          rejectedCount,
          followUpsDueCount,
          recentApplications,
          lastUpdated: conv.updatedAt,
        };
      })
    );

    return NextResponse.json(
      { mentees },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get mentees error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching mentees");
  }
}

export async function PATCH(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const validation = await validateRequestBody(req, updateMenteeMetadataSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { conversationId, ...updates } = validation.data;

  try {

    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);
    const conversationIdObj = new Types.ObjectId(conversationId);

    // Verify mentor owns this conversation
    const conversation = await Conversation.findOne({
      _id: conversationIdObj,
      mentorId,
    });

    if (!conversation) {
      return errors.notFound("Conversation not found or access denied");
    }

    // Prepare menteeMetadata update
    const menteeMetadataUpdates: any = {};
    if (updates.targetRole !== undefined) menteeMetadataUpdates.targetRole = updates.targetRole;
    if (updates.targetLocations !== undefined) menteeMetadataUpdates.targetLocations = updates.targetLocations;
    if (updates.season !== undefined) menteeMetadataUpdates.season = updates.season;
    if (updates.currentPhase !== undefined) menteeMetadataUpdates.currentPhase = updates.currentPhase;
    if (updates.menteeTags !== undefined) menteeMetadataUpdates.menteeTags = updates.menteeTags;
    if (updates.notes !== undefined) menteeMetadataUpdates.notes = updates.notes;

    menteeMetadataUpdates.updatedAt = new Date();
    menteeMetadataUpdates.updatedBy = mentorId;

    // Update conversation with menteeMetadata
    await Conversation.updateOne(
      { _id: conversationIdObj },
      {
        $set: {
          menteeMetadata: menteeMetadataUpdates,
        },
      }
    );

    // Fetch updated conversation
    const updated = await Conversation.findById(conversationIdObj).lean();

    return NextResponse.json(
      {
        success: true,
        menteeMetadata: updated?.menteeMetadata,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update mentee metadata error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating mentee metadata");
  }
}

