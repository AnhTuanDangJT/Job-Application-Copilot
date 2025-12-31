import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { Types } from "mongoose";

const PRESENCE_THRESHOLD_MS = 30 * 1000; // 30 seconds

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return errors.validation("userId query parameter is required");
  }

  try {
    await connectToDatabase();

    const targetUserId = new Types.ObjectId(userId);
    const now = new Date();

    // Get user's lastSeenAt
    const user = await User.findById(targetUserId).select("lastSeenAt").lean();

    if (!user) {
      return NextResponse.json(
        {
          userId,
          online: false,
          lastSeenAt: null,
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // If user has no lastSeenAt, they are offline
    if (!user.lastSeenAt) {
      return NextResponse.json(
        {
          userId,
          online: false,
          lastSeenAt: null,
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // Calculate time since last seen
    const lastSeenDate = new Date(user.lastSeenAt);
    const timeSinceLastSeen = now.getTime() - lastSeenDate.getTime();
    const isOnline = timeSinceLastSeen < PRESENCE_THRESHOLD_MS;

    return NextResponse.json(
      {
        userId,
        online: isOnline,
        lastSeenAt: lastSeenDate.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get presence status error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching presence status");
  }
}


