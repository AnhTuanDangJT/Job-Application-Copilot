import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationRow } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";
import { randomUUID } from "crypto";
import { z } from "zod";
import { tagSchema } from "@/lib/validation";

const updateTagsSchema = z.object({
  tags: z.array(tagSchema).max(50), // Max 50 tags per application
});

export async function PATCH(
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

  const validation = await validateRequestBody(req, updateTagsSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { tags } = validation.data;

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
    });

    if (!applicationRow) {
      return errors.notFound("Application row not found in this conversation");
    }

    // Update tags
    applicationRow.tags = tags;

    await applicationRow.save();

    return NextResponse.json(
      {
        tags: applicationRow.tags,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update tags error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating tags");
  }
}

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

    return NextResponse.json(
      {
        tags: applicationRow.tags || [],
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get tags error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching tags");
  }
}





