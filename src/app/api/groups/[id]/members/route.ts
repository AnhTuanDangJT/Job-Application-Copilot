import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Group, GroupMember } from "@/models";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, addGroupMemberSchema, isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * GET /api/groups/:id/members - Get all members of a group
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
    const group = await Group.findOne({
      _id: groupId,
      mentorId,
    });

    if (!group) {
      return errors.notFound("Group not found or access denied");
    }

    // Get all members with user details
    const members = await GroupMember.find({ groupId })
      .populate("menteeId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        members: members.map((member) => ({
          id: (member._id as unknown as Types.ObjectId).toString(),
          menteeId: (member.menteeId as any)._id.toString(),
          menteeName: (member.menteeId as any).name || "Unknown",
          menteeEmail: (member.menteeId as any).email || "",
          createdAt: (member.createdAt as Date).toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get group members error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching group members");
  }
}

/**
 * POST /api/groups/:id/members - Add a mentee to a group
 */
export async function POST(
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

  const validation = await validateRequestBody(req, addGroupMemberSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { menteeId } = validation.data;

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

    // Verify mentee exists and is actually a mentee
    const mentee = await User.findById(menteeIdObj);
    if (!mentee) {
      return errors.notFound("Mentee not found");
    }

    if (mentee.role !== "mentee") {
      return errors.validation("User is not a mentee");
    }

    // Check if mentee is already in the group
    const existingMember = await GroupMember.findOne({
      groupId,
      menteeId: menteeIdObj,
    });

    if (existingMember) {
      return errors.validation("Mentee is already in this group");
    }

    // Add the member
    const member = await GroupMember.create({
      groupId,
      menteeId: menteeIdObj,
    });

    // Populate for response
    await member.populate("menteeId", "name email");

    return NextResponse.json(
      {
        id: member._id.toString(),
        menteeId: (member.menteeId as any)._id.toString(),
        menteeName: (member.menteeId as any).name || "Unknown",
        menteeEmail: (member.menteeId as any).email || "",
        createdAt: member.createdAt.toISOString(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Add group member error:", error instanceof Error ? error.message : "Unknown error");
    // Handle duplicate key error (unique index)
    if (error instanceof Error && error.message.includes("E11000")) {
      return errors.validation("Mentee is already in this group");
    }
    return errors.internal("An error occurred while adding member to group");
  }
}

