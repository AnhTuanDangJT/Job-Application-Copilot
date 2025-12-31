import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationBoard } from "@/models/ApplicationBoard";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, updateColumnsSchema } from "@/lib/validation";
import { Types } from "mongoose";

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

  const { id } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }

  const validation = await validateRequestBody(req, updateColumnsSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { columns } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Find board (create if not exists)
    let board = await ApplicationBoard.findOne({ conversationId: id });
    if (!board) {
      const { getDefaultColumns } = await import("@/models/ApplicationBoard");
      board = await ApplicationBoard.create({
        conversationId: new Types.ObjectId(id),
        columns: getDefaultColumns(),
      });
    }

    // Validate columns
    // 1. All keys must be unique
    const keys = columns.map((col) => col.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      return errors.validation("Column keys must be unique");
    }

    // 2. For select type, options must be provided
    for (const col of columns) {
      if (col.type === "select" && (!col.options || col.options.length === 0)) {
        return errors.validation(`Column "${col.name}" of type "select" must have options`);
      }
    }

    // Create a map of existing columns by key for preserving _id
    const existingColumnMap = new Map(
      board.columns.map((col) => [col.key, col])
    );

    // Convert to mongoose schema format, preserving _id if column key matches
    const columnsData = columns.map((col) => {
      const existing = existingColumnMap.get(col.key);
      // Preserve existing _id if column key matches (for existing columns)
      // For new columns, mongoose will generate _id automatically
      const columnId = existing?._id || new Types.ObjectId();
      
      return {
        _id: columnId,
        key: col.key,
        name: col.name,
        type: col.type,
        required: col.required || false,
        options: col.type === "select" ? (col.options || []) : [],
        width: col.width,
        order: col.order,
      };
    });

    // Update board columns
    board.columns = columnsData;
    await board.save();

    return NextResponse.json(
      {
        id: board._id.toString(),
        conversationId: board.conversationId.toString(),
        columns: board.columns.map((col) => ({
          _id: col._id.toString(),
          key: col.key,
          name: col.name,
          type: col.type,
          required: col.required || false,
          options: col.options || [],
          width: col.width,
          order: col.order,
        })),
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update columns error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating columns");
  }
}

