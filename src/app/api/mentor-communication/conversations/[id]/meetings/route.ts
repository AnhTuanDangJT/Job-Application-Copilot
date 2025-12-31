import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId, createMeetingSchema } from "@/lib/validation";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

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

  const { id } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }

  // Only mentors can create meetings
  if (auth.role !== "mentor") {
    return errors.forbidden("Only mentors can create meetings");
  }

  const validation = await validateRequestBody(req, createMeetingSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { title, date, timezone, notes, calendarLink } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;

    // Verify the user is the mentor in this conversation
    const userIdObj = new Types.ObjectId(auth.sub);
    if (!conversation.mentorId.equals(userIdObj)) {
      return errors.forbidden("Only the mentor in this conversation can create meetings");
    }

    // Parse date string to Date object
    const meetingDate = new Date(date);

    // Create meeting
    const meetingId = randomUUID();
    const newMeeting = {
      id: meetingId,
      title,
      date: meetingDate,
      timezone,
      notes: notes || "",
      calendarLink,
    };

    // Get or initialize meetings array
    const meetings = conversation.meetings || [];
    meetings.push(newMeeting);

    // Update conversation
    const updated = await Conversation.findByIdAndUpdate(
      id,
      { $set: { meetings } },
      { new: true }
    ).lean();

    if (!updated) {
      return errors.notFound("Conversation not found");
    }

    return NextResponse.json(
      {
        meeting: newMeeting,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create meeting error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating meeting");
  }
}

export async function GET(
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

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;

    // Get meetings (sorted by date, upcoming first)
    // Handle dates that might be Date objects or strings
    const meetings = (conversation.meetings || []).map((meeting) => ({
      ...meeting,
      date: meeting.date instanceof Date ? meeting.date : new Date(meeting.date),
    })).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    return NextResponse.json(
      {
        meetings,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get meetings error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching meetings");
  }
}

