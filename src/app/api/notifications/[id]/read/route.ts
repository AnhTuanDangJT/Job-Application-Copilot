import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * PATCH /api/notifications/[id]/read - Mark notification as read
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
    return errors.validation("Invalid notification ID");
  }

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);

    // Update notification
    const notification = await Notification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        userId,
      },
      {
        $set: {
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return errors.notFound("Notification not found");
    }

    return NextResponse.json({
      id: notification._id.toString(),
      readAt: notification.readAt?.toISOString(),
    });
  } catch (error) {
    console.error("Mark notification as read error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while marking notification as read");
  }
}





