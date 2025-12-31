import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { createConversationSchema } from "@/lib/validation";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  try {
    await connectToDatabase();

    let conversations;
    const userId = new Types.ObjectId(auth.sub);

    if (auth.role === "mentor") {
      // Mentor sees all ACTIVE conversations where they are the mentor
      conversations = await Conversation.find({ 
        mentorId: userId,
        status: { $in: ["ACTIVE"] } // Only show active conversations
      })
        .sort({ updatedAt: -1 })
        .lean();
    } else if (auth.role === "mentee") {
      // Mentee sees all ACTIVE conversations where they are the mentee
      conversations = await Conversation.find({ 
        menteeId: userId,
        status: { $in: ["ACTIVE"] } // Only show active conversations
      })
        .sort({ updatedAt: -1 })
        .lean();
    } else {
      // Admin can see all conversations (optional, for future use)
      conversations = await Conversation.find({ status: { $in: ["ACTIVE"] } })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
    }

    // Enrich conversations with other participant info
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.mentorId.equals(userId)
          ? conv.menteeId
          : conv.mentorId;
        
        const otherUser = await User.findById(otherUserId)
          .select("name email role")
          .lean();

        return {
          id: conv._id.toString(),
          mentorId: conv.mentorId.toString(),
          menteeId: conv.menteeId.toString(),
          goal: conv.goal,
          focusAreas: conv.focusAreas,
          sessionType: conv.sessionType,
          status: conv.status,
          startedAt: conv.startedAt,
          completedAt: conv.completedAt,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: conv.lastMessagePreview,
          updatedAt: conv.updatedAt,
          createdAt: conv.createdAt,
          otherParticipant: otherUser
            ? {
                id: otherUser._id.toString(),
                name: otherUser.name,
                fullName: otherUser.name, // Use name as fullName (field is called 'name' in User model)
                email: otherUser.email,
                role: otherUser.role,
              }
            : null,
        };
      })
    );

    return NextResponse.json(
      { conversations: enrichedConversations },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get conversations error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching conversations");
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Both mentor and mentee can create conversations
  const auth = requireRole(req, ["mentor", "mentee"]);
  if (auth instanceof Response) return auth;

  const validation = await validateRequestBody(req, createConversationSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { mentorId, menteeId } = validation.data;

  try {
    await connectToDatabase();

    // CRITICAL: User ID and role come ONLY from requireAuth (server cookie, immutable)
    // This endpoint NEVER mutates auth state - it only READS auth to create conversation
    const userId = new Types.ObjectId(auth.sub);
    let mentorIdObj: Types.ObjectId;
    let menteeIdObj: Types.ObjectId;

    // Determine mentorId and menteeId based on user role (immutable role from auth token)
    if (auth.role === "mentee") {
      // Mentee is creating - they must provide mentorId
      if (!mentorId) {
        return errors.validation("Mentor ID is required");
      }
      if (!isValidObjectId(mentorId)) {
        return errors.validation("Invalid mentor ID format");
      }
      mentorIdObj = new Types.ObjectId(mentorId);
      menteeIdObj = userId;

      // Verify the mentor exists and has the correct role
      const mentor = await User.findById(mentorIdObj).select("role").lean();
      if (!mentor) {
        return errors.notFound("Mentor not found");
      }
      if (mentor.role !== "mentor" && mentor.role !== "admin") {
        return errors.validation("Specified user is not a mentor");
      }
    } else if (auth.role === "mentor") {
      // Mentor is creating - they must provide menteeId
      if (!menteeId) {
        return errors.validation("Mentee ID is required");
      }
      if (!isValidObjectId(menteeId)) {
        return errors.validation("Invalid mentee ID format");
      }
      menteeIdObj = new Types.ObjectId(menteeId);
      mentorIdObj = userId;

      // Verify the mentee exists and has the correct role
      const mentee = await User.findById(menteeIdObj).select("role").lean();
      if (!mentee) {
        return errors.notFound("Mentee not found");
      }
      if (mentee.role !== "mentee") {
        return errors.validation("Specified user is not a mentee");
      }
    } else {
      return errors.unauthorized("Only mentors and mentees can create conversations");
    }

    // Check if there's an active conversation first
    let existingActiveConversation = await Conversation.findOne({
      mentorId: mentorIdObj,
      menteeId: menteeIdObj,
      status: "ACTIVE",
    }).lean();

    // If there's an active conversation, return it instead of creating a new one
    if (existingActiveConversation) {
      const otherUserId = auth.role === "mentor" ? menteeIdObj : mentorIdObj;
      const otherUser = await User.findById(otherUserId).select("name email role").lean();
      return NextResponse.json(
        {
          id: existingActiveConversation._id.toString(),
          mentorId: existingActiveConversation.mentorId.toString(),
          menteeId: existingActiveConversation.menteeId.toString(),
          goal: existingActiveConversation.goal,
          focusAreas: existingActiveConversation.focusAreas,
          sessionType: existingActiveConversation.sessionType,
          status: existingActiveConversation.status,
          startedAt: existingActiveConversation.startedAt,
          completedAt: existingActiveConversation.completedAt,
          lastMessageAt: existingActiveConversation.lastMessageAt,
          lastMessagePreview: existingActiveConversation.lastMessagePreview,
          updatedAt: existingActiveConversation.updatedAt,
          createdAt: existingActiveConversation.createdAt,
          otherParticipant: otherUser
            ? {
                id: otherUser._id.toString(),
                name: otherUser.name,
                fullName: otherUser.name,
                email: otherUser.email,
                role: otherUser.role,
              }
            : null,
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // Create a new conversation (previous ones are completed, so we can create a new one)
    const conversation = await Conversation.create({
      mentorId: mentorIdObj,
      menteeId: menteeIdObj,
      sessionType: "RESUME",
      status: "ACTIVE",
      goal: "Improve resume and job readiness",
      startedAt: new Date(),
    });

    // Safety check - conversation should never be null after upsert, but handle it
    if (!conversation) {
      console.error("[Create Conversation] Conversation is null after upsert");
      return errors.internal("Failed to create conversation");
    }

    // Create SYSTEM welcome message for new conversation
    try {
      await Message.create({
        conversationId: conversation._id,
        type: "SYSTEM",
        senderRole: "system",
        content: "Welcome to your mentorship session. Use this space to review resumes, discuss applications, and track progress.",
        readBy: [],
      });
    } catch (msgError) {
      // Log error but don't fail the conversation creation
      console.error("[Create Conversation] Failed to create welcome message:", msgError);
    }

    // Get other participant info for response
    const otherUserId = auth.role === "mentor" ? menteeIdObj : mentorIdObj;
    const otherUser = await User.findById(otherUserId).select("name email role").lean();

    return NextResponse.json(
      {
        id: conversation._id.toString(),
        mentorId: conversation.mentorId.toString(),
        menteeId: conversation.menteeId.toString(),
        goal: conversation.goal,
        focusAreas: conversation.focusAreas,
        sessionType: conversation.sessionType,
        status: conversation.status,
        startedAt: conversation.startedAt,
        completedAt: conversation.completedAt,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt,
        otherParticipant: otherUser
          ? {
              id: otherUser._id.toString(),
              name: otherUser.name,
              fullName: otherUser.name, // Use name as fullName
              email: otherUser.email,
              role: otherUser.role,
            }
          : null,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create conversation error:", error instanceof Error ? error.message : "Unknown error");
    
    // Handle duplicate key error (unique index violation)
    if (error instanceof Error && error.message.includes("E11000")) {
      // Conversation already exists, fetch it
      try {
        const userId = new Types.ObjectId(auth.sub);
        let mentorIdObj: Types.ObjectId | null = null;
        let menteeIdObj: Types.ObjectId | null = null;

        if (auth.role === "mentee" && mentorId) {
          mentorIdObj = new Types.ObjectId(mentorId);
          menteeIdObj = userId;
        } else if (auth.role === "mentor" && menteeId) {
          menteeIdObj = new Types.ObjectId(menteeId);
          mentorIdObj = userId;
        }

        if (mentorIdObj && menteeIdObj) {
          const existing = await Conversation.findOne({
            mentorId: mentorIdObj,
            menteeId: menteeIdObj,
          }).lean();
          
          if (existing) {
            const otherUserId = auth.role === "mentor" ? menteeIdObj : mentorIdObj;
            const otherUser = await User.findById(otherUserId).select("name email role").lean();
            return NextResponse.json(
              {
                id: existing._id.toString(),
                mentorId: existing.mentorId.toString(),
                menteeId: existing.menteeId.toString(),
                goal: existing.goal,
                focusAreas: existing.focusAreas,
                sessionType: existing.sessionType,
                status: existing.status,
                startedAt: existing.startedAt,
                completedAt: existing.completedAt,
                lastMessageAt: existing.lastMessageAt,
                lastMessagePreview: existing.lastMessagePreview,
                updatedAt: existing.updatedAt,
                createdAt: existing.createdAt,
                otherParticipant: otherUser
                  ? {
                      id: otherUser._id.toString(),
                      name: otherUser.name,
                      fullName: otherUser.name,
                      email: otherUser.email,
                      role: otherUser.role,
                    }
                  : null,
              },
              {
                headers: {
                  "Cache-Control": "private, no-store",
                },
              }
            );
          }
        }
      } catch (fetchError) {
        // Fall through to internal error
      }
    }
    
    return errors.internal("An error occurred while creating conversation");
  }
}

