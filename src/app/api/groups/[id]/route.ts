import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Group, GroupMember } from "@/models";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, updateGroupSchema, isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * GET /api/groups/:id - Get a specific group with members
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid group ID format");
  }

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);
    const groupId = new Types.ObjectId(id);

    // Verify mentor owns this group
    const groupRaw = await Group.findOne({
      _id: groupId,
      mentorId,
    }).lean();

    if (!groupRaw || Array.isArray(groupRaw)) {
      return errors.notFound("Group not found or access denied");
    }

    const group = groupRaw as unknown as {
      _id: Types.ObjectId | string;
      mentorId: Types.ObjectId | string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    };

    // Get all members with user details
    const members = await GroupMember.find({ groupId })
      .populate("menteeId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const memberCount = members.length;

    const groupIdObj = group._id instanceof Types.ObjectId ? group._id : new Types.ObjectId(group._id);
    const groupMentorIdObj = group.mentorId instanceof Types.ObjectId ? group.mentorId : new Types.ObjectId(group.mentorId);

    return NextResponse.json(
      {
        id: groupIdObj.toString(),
        mentorId: groupMentorIdObj.toString(),
        name: group.name,
        memberCount,
        members: members.map((member) => ({
          id: (member._id as unknown as Types.ObjectId).toString(),
          menteeId: (member.menteeId as any)._id.toString(),
          menteeName: (member.menteeId as any).name || "Unknown",
          menteeEmail: (member.menteeId as any).email || "",
          createdAt: (member.createdAt as Date).toISOString(),
        })),
        createdAt: (group.createdAt as Date).toISOString(),
        updatedAt: (group.updatedAt as Date).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get group error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching group");
  }
}

/**
 * PUT /api/groups/:id - Update a group (rename)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid group ID format");
  }

  const validation = await validateRequestBody(req, updateGroupSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { name } = validation.data;

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);
    const groupId = new Types.ObjectId(id);

    // Verify mentor owns this group
    const group = await Group.findOne({
      _id: groupId,
      mentorId,
    });

    if (!group) {
      return errors.notFound("Group not found or access denied");
    }

    // Update the group
    group.name = name;
    await group.save();

    return NextResponse.json(
      {
        id: group._id.toString(),
        mentorId: group.mentorId.toString(),
        name: group.name,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Update group error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while updating group");
  }
}

/**
 * DELETE /api/groups/:id - Delete a group
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid group ID format");
  }

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);
    const groupId = new Types.ObjectId(id);

    // Verify mentor owns this group
    const group = await Group.findOne({
      _id: groupId,
      mentorId,
    });

    if (!group) {
      return errors.notFound("Group not found or access denied");
    }

    // Delete all members first
    await GroupMember.deleteMany({ groupId });

    // Delete the group
    await Group.deleteOne({ _id: groupId });

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Delete group error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while deleting group");
  }
}

