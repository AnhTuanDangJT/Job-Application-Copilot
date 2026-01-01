import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Reminder } from "@/models/Reminder";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { updateReminderSchema } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";

/**
 * PATCH /api/reminders/[id] - Update a reminder
 */
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

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid reminder ID");
  }

  const validation = await validateRequestBody(req, updateReminderSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    await connectToDatabase();

    // Find reminder
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return errors.notFound("Reminder not found");
    }

    // Check conversation access
    const accessCheck = await assertConversationAccess(
      reminder.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Update reminder
    const updateData: any = {};
    if (validation.data.type) updateData.type = validation.data.type;
    if (validation.data.dueAt) updateData.dueAt = new Date(validation.data.dueAt);
    if (validation.data.status) updateData.status = validation.data.status;

    Object.assign(reminder, updateData);
    await reminder.save();

    return NextResponse.json({
      id: reminder._id.toString(),
      conversationId: reminder.conversationId.toString(),
      applicationId: reminder.applicationId?.toString(),
      type: reminder.type,
      dueAt: reminder.dueAt.toISOString(),
      createdBy: reminder.createdBy.toString(),
      status: reminder.status,
      createdAt: reminder.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Update reminder error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating reminder");
  }
}

/**
 * DELETE /api/reminders/[id] - Delete a reminder
 */
export async function DELETE(
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

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid reminder ID");
  }

  try {
    await connectToDatabase();

    // Find reminder
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return errors.notFound("Reminder not found");
    }

    // Check conversation access
    const accessCheck = await assertConversationAccess(
      reminder.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Delete reminder
    await Reminder.deleteOne({ _id: reminder._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete reminder error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while deleting reminder");
  }
}





