import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { z } from "zod";
import { sanitizeString, sanitizeTextContent } from "@/lib/sanitize";
import { Types } from "mongoose";

// Schema for updating mentoring metadata (allows empty strings for optional fields)
const UpdateMentoringSchema = z.object({
  targetRole: z.string().max(200).optional(),
  targetLocations: z.array(z.string().max(200)).max(50).optional(),
  season: z.string().max(50).optional(),
  currentPhase: z.string().max(100).optional(),
  menteeTags: z.array(z.string().max(100)).max(50).optional(),
  notes: z.string().max(10000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Authentication - must be mentor or admin
  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  try {
    // Parse and validate request body
    const body = await req.json();
    const validation = UpdateMentoringSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return errors.validation(firstError?.message || "Invalid request data");
    }

    const updates = validation.data;
    const { conversationId } = await params;

    // Validate conversationId format
    if (!Types.ObjectId.isValid(conversationId)) {
      return errors.validation("Invalid conversation ID format");
    }

    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);
    const conversationIdObj = new Types.ObjectId(conversationId);

    // Verify mentor belongs to this conversation
    const conversation = await Conversation.findOne({
      _id: conversationIdObj,
      mentorId,
    });

    if (!conversation) {
      return errors.notFound("Conversation not found or access denied");
    }

    // Get existing menteeMetadata to merge with updates
    const existingMetadata = conversation.menteeMetadata || {};
    
    // Prepare menteeMetadata update with sanitization
    // Merge with existing data - only update fields that are provided
    const menteeMetadataUpdates: any = {
      ...existingMetadata,
    };
    
    // Only update fields that are provided (undefined means don't update)
    // Sanitize string fields to prevent XSS
    if (updates.targetRole !== undefined) {
      menteeMetadataUpdates.targetRole = updates.targetRole ? sanitizeString(updates.targetRole, 200) : "";
    }
    if (updates.targetLocations !== undefined) {
      menteeMetadataUpdates.targetLocations = (updates.targetLocations || []).map((loc) =>
        loc ? sanitizeString(loc, 200) : ""
      ).filter((loc) => loc.length > 0); // Remove empty locations
    }
    if (updates.season !== undefined) {
      menteeMetadataUpdates.season = updates.season ? sanitizeString(updates.season, 50) : "";
    }
    if (updates.currentPhase !== undefined) {
      menteeMetadataUpdates.currentPhase = updates.currentPhase ? sanitizeString(updates.currentPhase, 100) : "";
    }
    if (updates.menteeTags !== undefined) {
      menteeMetadataUpdates.menteeTags = (updates.menteeTags || []).map((tag) =>
        tag ? sanitizeString(tag, 100) : ""
      ).filter((tag) => tag.length > 0); // Remove empty tags
    }
    if (updates.notes !== undefined) {
      menteeMetadataUpdates.notes = updates.notes ? sanitizeTextContent(updates.notes, 10000) : "";
    }

    // Always update timestamp and who updated it
    menteeMetadataUpdates.updatedAt = new Date();
    menteeMetadataUpdates.updatedBy = mentorId;

    // Update conversation with menteeMetadata (merge with existing)
    await Conversation.updateOne(
      { _id: conversationIdObj },
      {
        $set: {
          menteeMetadata: menteeMetadataUpdates,
        },
      }
    );

    // Fetch updated conversation to return
    const updated = await Conversation.findById(conversationIdObj)
      .select("menteeMetadata")
      .lean();

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
    console.error(
      "Update mentoring metadata error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return errors.internal("An error occurred while updating mentoring metadata");
  }
}

