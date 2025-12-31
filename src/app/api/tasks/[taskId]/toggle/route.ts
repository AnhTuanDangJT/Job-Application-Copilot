import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentees can toggle task completion
  const auth = requireRole(req, ["mentee"]);
  if (auth instanceof Response) return auth;

  const { taskId } = params;

  // Validate taskId format
  if (!taskId || !isValidObjectId(taskId)) {
    return errors.validation("Invalid task ID");
  }

  try {
    await connectToDatabase();

    const menteeId = new Types.ObjectId(auth.sub);

    // Verify mentee exists and has MENTEE role
    const mentee = await User.findById(menteeId).lean();
    if (!mentee || Array.isArray(mentee)) {
      return errors.notFound("Mentee not found");
    }
    if (mentee.role !== "mentee") {
      return errors.forbidden("Only mentees can toggle task completion");
    }

    // Find task and verify it's assigned to this mentee
    const task = await Task.findById(taskId).lean();
    if (!task) {
      return errors.notFound("Task not found");
    }

    // Verify task is assigned to this mentee
    if (task.menteeId.toString() !== menteeId.toString()) {
      return errors.forbidden("You can only toggle tasks assigned to you");
    }

    // Toggle completion status
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { completed: !task.completed },
      { new: true }
    )
      .populate("mentorId", "name email")
      .populate("menteeId", "name email")
      .lean();

    if (!updatedTask) {
      return errors.notFound("Task not found");
    }

    return NextResponse.json(
      {
        id: updatedTask._id.toString(),
        title: updatedTask.title,
        description: updatedTask.description,
        completed: updatedTask.completed,
        mentorId: updatedTask.mentorId.toString(),
        menteeId: updatedTask.menteeId.toString(),
        mentorName: (updatedTask.mentorId as any).name,
        mentorEmail: (updatedTask.mentorId as any).email,
        createdAt: updatedTask.createdAt,
        updatedAt: updatedTask.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Toggle task error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while toggling the task");
  }
}


