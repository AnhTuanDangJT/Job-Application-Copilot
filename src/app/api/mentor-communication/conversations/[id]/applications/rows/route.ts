import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationBoard } from "@/models/ApplicationBoard";
import { ApplicationRow, CellValue } from "@/models/ApplicationRow";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, validateQueryParams, isValidObjectId, createRowSchema, rowsQuerySchema } from "@/lib/validation";
import { Types } from "mongoose";
import { z } from "zod";

// Helper to validate cell value against column type
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
      return { valid: true, coerced: String(value) }; // Coerce to string

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
      // Coerce truthy/falsy
      return { valid: true, coerced: Boolean(value) };

    case "date":
      if (typeof value === "string") {
        // Accept ISO date strings or YYYY-MM-DD format
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
      // Invalid option -> set to null
      return { valid: true, coerced: null };

    default:
      return { valid: false, error: "Unknown column type" };
  }
}

export async function GET(
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

  // Validate query parameters
  const queryValidation = validateQueryParams(req.nextUrl.searchParams, rowsQuerySchema);
  if (!queryValidation.success) {
    return errors.validation(queryValidation.error);
  }

  const { page = 1, limit = 50 } = queryValidation.data;
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Get board (create if not exists)
    let board = await ApplicationBoard.findOne({ conversationId: id });
    if (!board) {
      const { getDefaultColumns } = await import("@/models/ApplicationBoard");
      board = await ApplicationBoard.create({
        conversationId: new Types.ObjectId(id),
        columns: getDefaultColumns(),
      });
    }

    // Fetch rows with pagination
    const rows = await ApplicationRow.find({ conversationId: id })
      .sort({ updatedAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(
      {
        rows: rows.map((row) => ({
          id: row._id.toString(),
          boardId: row.boardId.toString(),
          conversationId: row.conversationId.toString(),
          createdBy: row.createdBy.toString(),
          cells: row.cells,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        pagination: {
          page,
          limit,
          hasMore: rows.length === limit,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get rows error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching rows");
  }
}

export async function POST(
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

  const validation = await validateRequestBody(req, createRowSchema);
  if (!validation.success) {
    // Return detailed validation error
    const errorMessage = validation.details
      ? validation.details.issues.map((issue) => {
          const path = issue.path.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        }).join("; ")
      : validation.error;
    return errors.validation(errorMessage);
  }

  const { cells = {} } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Get board (create if not exists)
    let board = await ApplicationBoard.findOne({ conversationId: id });
    if (!board) {
      const { getDefaultColumns } = await import("@/models/ApplicationBoard");
      board = await ApplicationBoard.create({
        conversationId: new Types.ObjectId(id),
        columns: getDefaultColumns(),
      });
    }

    // Validate cells against board columns
    const validatedCells: Record<string, CellValue> = {};
    const columnMap = new Map(board.columns.map((col) => [col.key, col]));

    // Only accept keys that exist in board.columns
    for (const [key, value] of Object.entries(cells)) {
      const column = columnMap.get(key);
      if (!column) {
        // Skip unknown keys (don't error, just ignore)
        continue;
      }

      const cellValidation = validateCellValue(value, column.type, column.options);
      if (!cellValidation.valid) {
        return errors.validation(`Invalid value for column "${column.name}": ${cellValidation.error}`);
      }

      validatedCells[key] = cellValidation.coerced!;
    }

    // Check required columns - only if cells object is not empty
    if (Object.keys(cells).length > 0) {
      for (const column of board.columns) {
        if (column.required && !(column.key in validatedCells)) {
          return errors.validation(`Required column "${column.name}" is missing`);
        }
      }
    }

    // If no cells provided and no defaults, ensure at least one cell exists
    // This is handled by the frontend modal, but add safety check
    if (Object.keys(validatedCells).length === 0) {
      // Auto-fill defaults if available
      const defaultCells: Record<string, CellValue> = {};
      for (const column of board.columns) {
        if (column.key === "status" && column.type === "select" && column.options && column.options.length > 0) {
          defaultCells[column.key] = column.options[0]; // Default to first option
        } else if ((column.key === "dateApplied" || column.key === "appliedDate") && column.type === "date") {
          defaultCells[column.key] = new Date().toISOString().split("T")[0]; // Today's date
        }
      }
      // Only use defaults if we have at least one
      if (Object.keys(defaultCells).length > 0) {
        Object.assign(validatedCells, defaultCells);
      } else {
        return errors.validation("At least one cell value must be provided");
      }
    }

    // Create row
    const row = await ApplicationRow.create({
      boardId: board._id,
      conversationId: new Types.ObjectId(id),
      createdBy: new Types.ObjectId(auth.sub),
      cells: validatedCells,
    });

    // Emit real-time event
    const { broadcastToConversation } = await import("@/lib/websocket/broadcast");
    broadcastToConversation(id, "application.created", {
      conversationId: id,
      applicationId: row._id.toString(),
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
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create row error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating row");
  }
}

