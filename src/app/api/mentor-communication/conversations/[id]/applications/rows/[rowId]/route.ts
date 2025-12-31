import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationBoard } from "@/models/ApplicationBoard";
import { ApplicationRow, CellValue } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, updateRowSchema } from "@/lib/validation";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

// Helper to validate cell value against column type (reused from rows route)
function validateCellValue(
  value: CellValue,
  columnType: string,
  options?: string[]
): { valid: boolean; coerced?: CellValue; error?: string } {
  if (value === null) {
    return { valid: true, coerced: null };
  }

  switch (columnType) {
    case "text":
    case "longtext":
      if (typeof value === "string") {
        return { valid: true, coerced: value };
      }
      return { valid: true, coerced: String(value) };

    case "number":
      if (typeof value === "number") {
        return { valid: true, coerced: value };
      }
      if (typeof value === "string") {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          return { valid: true, coerced: num };
        }
      }
      return { valid: false, error: "Value must be a number" };

    case "checkbox":
      if (typeof value === "boolean") {
        return { valid: true, coerced: value };
      }
      return { valid: true, coerced: Boolean(value) };

    case "date":
      if (typeof value === "string") {
        const dateRegex = /^\d{4}-\d{2}-\d{2}/;
        if (dateRegex.test(value)) {
          return { valid: true, coerced: value };
        }
      }
      return { valid: false, error: "Date must be in YYYY-MM-DD format" };

    case "select":
      if (typeof value === "string" && options && options.includes(value)) {
        return { valid: true, coerced: value };
      }
      return { valid: true, coerced: null };

    default:
      return { valid: false, error: "Unknown column type" };
  }
}

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

  const validation = await validateRequestBody(req, updateRowSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { cells } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Find row and verify it belongs to this conversation
    const row = await ApplicationRow.findOne({
      _id: rowId,
      conversationId: id,
    });
    if (!row) {
      return errors.notFound("Row not found");
    }

    // Get board
    const board = await ApplicationBoard.findById(row.boardId);
    if (!board) {
      return errors.notFound("Board not found");
    }

    // Validate cells against board columns
    const columnMap = new Map(board.columns.map((col) => [col.key, col]));
    const updatedCells = { ...row.cells };

    // Track changes for history
    const conversation = accessCheck.conversation;
    const userIdObj = new Types.ObjectId(auth.sub);
    const changedBy = conversation.mentorId.equals(userIdObj) ? "mentor" : "mentee";

    // Update only provided cells and track history
    if (!row.history) {
      row.history = [];
    }
    
    for (const [key, value] of Object.entries(cells)) {
      const column = columnMap.get(key);
      if (!column) {
        // Skip unknown keys
        continue;
      }

      const validation = validateCellValue(value, column.type, column.options);
      if (!validation.valid) {
        return errors.validation(`Invalid value for column "${column.name}": ${validation.error}`);
      }

      const oldValue = row.cells[key];
      const newValue = validation.coerced!;

      // Only add history entry if value actually changed
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        row.history.push({
          id: randomUUID(),
          field: key,
          oldValue,
          newValue,
          changedBy,
          timestamp: new Date(),
        });
      }

      updatedCells[key] = newValue;
    }

    // Check required columns are still present
    for (const column of board.columns) {
      if (column.required && !(column.key in updatedCells)) {
        return errors.validation(`Required column "${column.name}" cannot be removed`);
      }
    }

    // Update row
    row.cells = updatedCells;
    await row.save();

    // Emit real-time event
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(id, "application.updated", {
      conversationId: id,
      applicationId: row._id.toString(),
      changes: cells,
      application: {
        id: row._id.toString(),
        cells: row.cells,
      },
    });

    return NextResponse.json(
      {
        id: row._id.toString(),
        boardId: row.boardId.toString(),
        conversationId: row.conversationId.toString(),
        createdBy: row.createdBy.toString(),
        cells: row.cells,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update row error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating row");
  }
}

export async function DELETE(
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

    // Find and delete row (must belong to this conversation)
    const result = await ApplicationRow.deleteOne({
      _id: rowId,
      conversationId: id,
    });

    if (result.deletedCount === 0) {
      return errors.notFound("Row not found");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete row error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while deleting row");
  }
}

