import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { InterviewPrep } from "@/models/InterviewPrep";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { z } from "zod";
import { Types } from "mongoose";

const createInterviewPrepSchema = z.object({
  question: z.string().min(1).max(1000),
  assessment: z.enum(["WEAK", "AVERAGE", "STRONG"]).optional(),
  notes: z.string().max(10000).optional(),
});

const updateInterviewPrepSchema = z.object({
  question: z.string().min(1).max(1000).optional(),
  assessment: z.enum(["WEAK", "AVERAGE", "STRONG"]).optional(),
  notes: z.string().max(10000).optional(),
});

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

    // Get interview prep questions for this conversation
    const interviewPreps = await InterviewPrep.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        interviewPreps: interviewPreps.map((prep) => ({
          id: prep._id.toString(),
          conversationId: prep.conversationId.toString(),
          question: prep.question,
          assessment: prep.assessment,
          notes: prep.notes,
          createdAt: prep.createdAt,
          updatedAt: prep.updatedAt,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get interview prep error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching interview prep");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentors can create interview prep questions
  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    return errors.validation("Invalid conversation ID format");
  }

  const validation = await validateRequestBody(req, createInterviewPrepSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { question, assessment, notes } = validation.data;

  try {
    await connectToDatabase();

    // Check conversation access (must match mentorId)
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);

    // Verify user is the mentor
    if (!conversation.mentorId.equals(userId)) {
      return errors.forbidden("Only the assigned mentor can create interview prep questions");
    }

    // Create interview prep question
    const interviewPrep = await InterviewPrep.create({
      conversationId: new Types.ObjectId(id),
      question: question.trim(),
      assessment,
      notes: notes?.trim(),
    });

    return NextResponse.json(
      {
        id: interviewPrep._id.toString(),
        conversationId: interviewPrep.conversationId.toString(),
        question: interviewPrep.question,
        assessment: interviewPrep.assessment,
        notes: interviewPrep.notes,
        createdAt: interviewPrep.createdAt,
        updatedAt: interviewPrep.updatedAt,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create interview prep error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating interview prep");
  }
}







