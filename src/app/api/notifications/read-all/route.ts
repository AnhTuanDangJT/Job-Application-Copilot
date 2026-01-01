import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";
import { z } from "zod";

const readAllSchema = z.object({
  conversationId: z.string().optional(),
});

/**
 * PATCH /api/notifications/read-all - Mark all notifications as read
 */
export async function PATCH(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  try {
    const body = await req.json().catch(() => ({}));
    const validation = readAllSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.issues[0]?.message || "Invalid request");
    }

    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);

    // Build query
    const query: any = {
      userId,
      readAt: { $exists: false },
    };

    if (validation.data.conversationId && isValidObjectId(validation.data.conversationId)) {
      query.conversationId = new Types.ObjectId(validation.data.conversationId);
    }

    // Update all unread notifications
    const result = await Notification.updateMany(query, {
      $set: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while marking notifications as read");
  }
}





