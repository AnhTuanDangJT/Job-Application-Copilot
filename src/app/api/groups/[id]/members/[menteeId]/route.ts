import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Group, GroupMember } from "@/models";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * DELETE /api/groups/:id/members/:menteeId - Remove a mentee from a group
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; menteeId: string }> }
) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id, menteeId } = await params;

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid group ID format");
  }

  if (!isValidObjectId(menteeId)) {
    return errors.validation("Invalid mentee ID format");
  }

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);
    const groupId = new Types.ObjectId(id);
    const menteeIdObj = new Types.ObjectId(menteeId);

    // Verify mentor owns this group
    const group = await Group.findOne({
      _id: groupId,
      mentorId,
    });

    if (!group) {
      return errors.notFound("Group not found or access denied");
    }

    // Remove the member
    const result = await GroupMember.deleteOne({
      groupId,
      menteeId: menteeIdObj,
    });

    if (result.deletedCount === 0) {
      return errors.notFound("Member not found in group");
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Remove group member error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while removing member from group");
  }
}

