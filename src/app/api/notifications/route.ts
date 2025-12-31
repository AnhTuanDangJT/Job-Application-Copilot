import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateQueryParams, isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";
import { z } from "zod";

const notificationsQuerySchema = z.object({
  page: z.string().optional().transform((val) => {
    if (!val) return 1;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }),
  limit: z.string().optional().transform((val) => {
    if (!val) return 30;
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) return 30;
    return parsed > 100 ? 100 : parsed;
  }),
  conversationId: z.string().optional(),
  unreadOnly: z.string().optional().transform((val) => val === "true"),
});

/**
 * GET /api/notifications - Get user's notifications
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
  const queryValidation = validateQueryParams(req.nextUrl.searchParams, notificationsQuerySchema);
  if (!queryValidation.success) {
    return errors.validation(queryValidation.error);
  }

  const { page = 1, limit = 30, conversationId, unreadOnly = false } = queryValidation.data;
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);

    // Build query
    const query: any = { userId };
    if (conversationId && isValidObjectId(conversationId)) {
      query.conversationId = new Types.ObjectId(conversationId);
    }
    if (unreadOnly) {
      query.readAt = { $exists: false };
    }

    // Fetch notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      userId,
      readAt: { $exists: false },
    });

    return NextResponse.json(
      {
        notifications: notifications.map((notif) => ({
          id: notif._id.toString(),
          userId: notif.userId.toString(),
          conversationId: notif.conversationId ? notif.conversationId.toString() : undefined,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          link: notif.link,
          readAt: notif.readAt ? notif.readAt.toISOString() : undefined,
          meta: notif.meta,
          createdAt: notif.createdAt.toISOString(),
        })),
        unreadCount,
        pagination: {
          page,
          limit,
          hasMore: notifications.length === limit,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get notifications error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching notifications");
  }
}

