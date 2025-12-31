import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { Types } from "mongoose";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  try {
    await connectToDatabase();

    // Safely create ObjectId
    let userId: Types.ObjectId;
    try {
      userId = new Types.ObjectId(auth.sub);
    } catch (error) {
      console.error("[HEARTBEAT] Invalid userId format:", auth.sub, error);
      return errors.validation("Invalid user ID");
    }

    const now = new Date();

    // Update user.lastSeenAt for presence tracking
    try {
      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            lastSeenAt: now,
          },
        },
        { new: true }
      );
    } catch (dbError) {
      console.error("[HEARTBEAT] Database update error:", dbError instanceof Error ? dbError.message : String(dbError));
      // Don't fail completely - presence is non-critical
      return NextResponse.json(
        { success: true, lastSeenAt: now.toISOString(), warning: "Presence update may not have been saved" },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    return NextResponse.json(
      { success: true, lastSeenAt: now.toISOString() },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("[HEARTBEAT] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errors.internal("An error occurred while updating presence");
  }
}


