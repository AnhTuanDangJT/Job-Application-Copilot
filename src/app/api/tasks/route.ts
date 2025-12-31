import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody } from "@/lib/validation";
import { z } from "zod";
import { Types } from "mongoose";

// Validation schema for creating a task
const createTaskSchema = z.object({
  menteeEmail: z.string().email("Invalid email address").max(255, "Email too long"),
  title: z.string().min(1, "Title is required").max(500, "Title must be at most 500 characters"),
  description: z.string().max(5000, "Description must be at most 5000 characters").optional(),
});

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Only mentors can create tasks
  const auth = requireRole(req, ["mentor"]);
  if (auth instanceof Response) return auth;

  const validation = await validateRequestBody(req, createTaskSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { menteeEmail, title, description } = validation.data;

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);

    // Verify mentor exists and has MENTOR role
    const mentor = await User.findById(mentorId).lean();
    if (!mentor || Array.isArray(mentor)) {
      return errors.notFound("Mentor not found");
    }
    if (mentor.role !== "mentor") {
      return errors.forbidden("Only mentors can create tasks");
    }

    // Find mentee by email
    const mentee = await User.findOne({ email: menteeEmail }).lean();
    if (!mentee) {
      // Generic error message to prevent email enumeration
      return errors.notFound("Mentee not found or not assigned to you");
    }

    // Verify mentee has MENTEE role
    if (mentee.role !== "mentee") {
      return errors.forbidden("Invalid mentee role");
    }

    // Verify mentor and mentee are different
    if (mentor._id.toString() === mentee._id.toString()) {
      return errors.validation("Mentor and mentee cannot be the same user");
    }

    // Verify mentor-mentee relationship exists (ACTIVE conversation)
    const conversation = await Conversation.findOne({
      mentorId,
      menteeId: mentee._id,
      status: "ACTIVE",
    }).lean();

    if (!conversation) {
      // Generic error message to prevent email enumeration
      return errors.forbidden("Mentee not found or not assigned to you");
    }

    // Create task
    const task = await Task.create({
      title,
      description,
      completed: false,
      mentorId,
      menteeId: mentee._id,
    });

    // Populate mentor and mentee names for response
    const populatedTask = await Task.findById(task._id)
      .populate("mentorId", "name email")
      .populate("menteeId", "name email")
      .lean();

    return NextResponse.json(
      {
        id: populatedTask!._id.toString(),
        title: populatedTask!.title,
        description: populatedTask!.description,
        completed: populatedTask!.completed,
        mentorId: populatedTask!.mentorId.toString(),
        menteeId: populatedTask!.menteeId.toString(),
        menteeName: (populatedTask!.menteeId as any).name,
        menteeEmail: (populatedTask!.menteeId as any).email,
        createdAt: populatedTask!.createdAt,
        updatedAt: populatedTask!.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create task error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating the task");
  }
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Allow mentors and mentees to view tasks
  const auth = requireRole(req, ["mentor", "mentee"]);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);

    // Get user to determine role
    const user = await User.findById(userId).lean();
    if (!user || Array.isArray(user)) {
      return errors.notFound("User not found");
    }

    let tasks;

    if (user.role === "mentor") {
      // Mentors see all tasks they created
      tasks = await Task.find({ mentorId: userId })
        .populate("menteeId", "name email")
        .sort({ createdAt: -1 })
        .lean();
    } else if (user.role === "mentee") {
      // Mentees see all tasks assigned to them
      tasks = await Task.find({ menteeId: userId })
        .populate("mentorId", "name email")
        .sort({ createdAt: -1 })
        .lean();
    } else {
      return errors.forbidden("Invalid role");
    }

    // Format response
    const formattedTasks = tasks.map((task) => {
      const menteePopulated = task.menteeId && typeof task.menteeId === "object" && "name" in task.menteeId;
      const mentorPopulated = task.mentorId && typeof task.mentorId === "object" && "name" in task.mentorId;
      
      return {
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        completed: task.completed,
        mentorId: typeof task.mentorId === "object" && task.mentorId?._id 
          ? task.mentorId._id.toString() 
          : task.mentorId.toString(),
        menteeId: typeof task.menteeId === "object" && task.menteeId?._id 
          ? task.menteeId._id.toString() 
          : task.menteeId.toString(),
        ...(user.role === "mentor"
          ? {
              menteeName: menteePopulated ? (task.menteeId as any).name : "Unknown",
              menteeEmail: menteePopulated ? (task.menteeId as any).email : "",
            }
          : {
              mentorName: mentorPopulated ? (task.mentorId as any).name : "Unknown",
              mentorEmail: mentorPopulated ? (task.mentorId as any).email : "",
            }),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });

    return NextResponse.json(
      { tasks: formattedTasks },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get tasks error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching tasks");
  }
}

