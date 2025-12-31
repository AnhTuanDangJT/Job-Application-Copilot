import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ApplicationBoard, getDefaultColumns } from "@/models/ApplicationBoard";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

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

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Find or create board atomically (lazy initialization)
    const conversationIdObj = new Types.ObjectId(id);
    const defaultColumns = getDefaultColumns();
    
    const board = await ApplicationBoard.findOneAndUpdate(
      { conversationId: conversationIdObj },
      {
        $setOnInsert: {
          conversationId: conversationIdObj,
          columns: defaultColumns,
        },
      },
      {
        upsert: true,
        new: true,
        lean: true,
        setDefaultsOnInsert: true,
      }
    );

    // Safety check: ensure board exists and has columns
    if (!board) {
      console.error(`[Board] Failed to create/find board for conversation ${id}`);
      return errors.internal("Failed to initialize board");
    }

    // Ensure columns array exists and is valid
    const columns = Array.isArray(board.columns) && board.columns.length > 0 
      ? board.columns 
      : defaultColumns;

    // Log initialization only when board was just created (createdAt equals updatedAt)
    if (board.createdAt && board.updatedAt) {
      const createdAt = new Date(board.createdAt).getTime();
      const updatedAt = new Date(board.updatedAt).getTime();
      // If timestamps are identical or within 100ms, board was just created
      if (Math.abs(updatedAt - createdAt) < 100) {
        console.log(`Application board initialized for conversation ${id}`);
      }
    }

    return NextResponse.json(
      {
        id: board._id.toString(),
        conversationId: board.conversationId.toString(),
        columns: columns.map((col) => ({
          _id: col._id?.toString() || new Types.ObjectId().toString(),
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
    console.error("Get board error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching board");
  }
}

// Optional POST endpoint to force-create/reset board (mentor-only)
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

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Only mentor can reset board
    const userId = new Types.ObjectId(auth.sub);
    if (!accessCheck.conversation.mentorId.equals(userId) && auth.role !== "admin") {
      return errors.forbidden("Only the mentor can reset the board");
    }

    // Delete existing board (cascading delete of rows handled by application logic)
    await ApplicationBoard.deleteOne({ conversationId: id });

    // Create new board with defaults
    const defaultColumns = getDefaultColumns();
    const newBoard = await ApplicationBoard.create({
      conversationId: new Types.ObjectId(id),
      columns: defaultColumns,
    });

    return NextResponse.json(
      {
        id: newBoard._id.toString(),
        conversationId: newBoard.conversationId.toString(),
        columns: newBoard.columns.map((col) => ({
          _id: col._id.toString(),
          key: col.key,
          name: col.name,
          type: col.type,
          required: col.required || false,
          options: col.options || [],
          width: col.width,
          order: col.order,
        })),
        createdAt: newBoard.createdAt,
        updatedAt: newBoard.updatedAt,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create/reset board error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating board");
  }
}

