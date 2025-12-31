import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { updateLastSeen, markConversationNotificationsAsRead } from "@/lib/notifications";

/**
 * POST /api/mentor-communication/conversations/[id]/seen - Update lastSeenAt for conversation
 */
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

  let id: string;
  try {
    const paramsObj = await params;
    id = paramsObj?.id || "";
  } catch (paramsError) {
    console.error("[SEEN] Error parsing params:", paramsError instanceof Error ? paramsError.message : String(paramsError));
    return errors.validation("Invalid request parameters");
  }

  if (!id || typeof id !== "string" || !isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Update lastSeenAt (non-critical, don't fail if it errors)
    try {
      await updateLastSeen(id, auth.sub);
    } catch (updateError) {
      console.error("[SEEN] Error updating lastSeenAt:", updateError instanceof Error ? updateError.message : String(updateError));
      // Continue - this is non-critical
    }

    // Mark conversation notifications as read (non-critical, don't fail if it errors)
    try {
      await markConversationNotificationsAsRead(id, auth.sub);
    } catch (notificationError) {
      console.error("[SEEN] Error marking notifications as read:", notificationError instanceof Error ? notificationError.message : String(notificationError));
      // Continue - this is non-critical
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEEN] Unexpected error:", {
      conversationId: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errors.internal("An error occurred while updating seen status");
  }
}




