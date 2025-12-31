import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Group, GroupMember } from "@/models";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, createGroupSchema, isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * GET /api/groups - Get all groups for the authenticated mentor
 */
export async function GET(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);

    // Get all groups for this mentor
    const groups = await Group.find({ mentorId })
      .sort({ createdAt: -1 })
      .lean();

    // Get member counts for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (groupRaw) => {
        const group = groupRaw as unknown as {
          _id: Types.ObjectId | string;
          mentorId: Types.ObjectId | string;
          name: string;
          createdAt: Date;
          updatedAt: Date;
        };
        const groupId = group._id instanceof Types.ObjectId ? group._id : new Types.ObjectId(group._id);
        const memberCount = await GroupMember.countDocuments({
          groupId,
        });

        const mentorId = group.mentorId instanceof Types.ObjectId ? group.mentorId : new Types.ObjectId(group.mentorId);
        return {
          id: groupId.toString(),
          mentorId: mentorId.toString(),
          name: group.name,
          memberCount,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json(
      { groups: groupsWithCounts },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get groups error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching groups");
  }
}

/**
 * POST /api/groups - Create a new group
 */
export async function POST(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const validation = await validateRequestBody(req, createGroupSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { name } = validation.data;

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);

    // Create the group
    const group = await Group.create({
      mentorId,
      name,
    });

    return NextResponse.json(
      {
        id: group._id.toString(),
        mentorId: group.mentorId.toString(),
        name: group.name,
        memberCount: 0,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create group error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating group");
  }
}

