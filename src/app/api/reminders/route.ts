import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Reminder } from "@/models/Reminder";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, validateQueryParams, isValidObjectId } from "@/lib/validation";
import { createReminderSchema } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";

const remindersQuerySchema = z.object({
  conversationId: z.string().min(1).max(100),
  applicationId: z.string().optional(),
  status: z.enum(["pending", "triggered", "cancelled"]).optional(),
});

/**
 * GET /api/reminders - Get reminders for a conversation
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
  const queryValidation = validateQueryParams(req.nextUrl.searchParams, remindersQuerySchema);
  if (!queryValidation.success) {
    return errors.validation(queryValidation.error);
  }

  const { conversationId, applicationId, status } = queryValidation.data;

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
    if (applicationId && isValidObjectId(applicationId)) {
      query.applicationId = new Types.ObjectId(applicationId);
    }
    if (status) {
      query.status = status;
    }

    // Fetch reminders
    const reminders = await Reminder.find(query)
      .sort({ dueAt: 1 })
      .lean();

    return NextResponse.json(
      {
        reminders: reminders.map((reminder) => ({
          id: reminder._id.toString(),
          conversationId: reminder.conversationId.toString(),
          applicationId: reminder.applicationId?.toString(),
          type: reminder.type,
          dueAt: reminder.dueAt.toISOString(),
          createdBy: reminder.createdBy.toString(),
          status: reminder.status,
          createdAt: reminder.createdAt.toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get reminders error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching reminders");
  }
}

/**
 * POST /api/reminders - Create a new reminder
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, createReminderSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { conversationId, applicationId, type, dueAt } = validation.data;

  if (!isValidObjectId(conversationId)) {
    return errors.validation("Invalid conversation ID");
  }

  if (applicationId && !isValidObjectId(applicationId)) {
    return errors.validation("Invalid application ID");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(conversationId, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Create reminder
    const reminder = await Reminder.create({
      conversationId: new Types.ObjectId(conversationId),
      applicationId: applicationId ? new Types.ObjectId(applicationId) : undefined,
      type,
      dueAt: new Date(dueAt),
      createdBy: new Types.ObjectId(auth.sub),
      status: "pending",
    });

    return NextResponse.json(
      {
        id: reminder._id.toString(),
        conversationId: reminder.conversationId.toString(),
        applicationId: reminder.applicationId?.toString(),
        type: reminder.type,
        dueAt: reminder.dueAt.toISOString(),
        createdBy: reminder.createdBy.toString(),
        status: reminder.status,
        createdAt: reminder.createdAt.toISOString(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create reminder error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating reminder");
  }
}




