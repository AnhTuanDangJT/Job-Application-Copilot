import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, isValidObjectId } from "@/lib/validation";
import { startConversationSchema } from "@/lib/validation";
import { Types } from "mongoose";

/**
 * POST /api/conversations/start
 * 
 * Privacy-safe endpoint to start a conversation by email.
 * 
 * Security:
 * - Does NOT reveal whether email exists
 * - Does NOT reveal user roles
 * - Uses generic error messages for all failures
 * - Validates mentor ↔ mentee relationship server-side
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Both mentor and mentee can create conversations
  const auth = requireRole(req, ["mentor", "mentee"]);
  if (auth instanceof Response) return auth;

  const validation = await validateRequestBody(req, startConversationSchema);
  if (!validation.success) {
    // Generic error - don't reveal validation details
    return errors.validation("Unable to start conversation");
  }

  const { email } = validation.data;

  try {
    await connectToDatabase();

    const userId = new Types.ObjectId(auth.sub);
    let mentorIdObj: Types.ObjectId;
    let menteeIdObj: Types.ObjectId;

    // Lookup target user by email
    const targetUser = await User.findOne({ email: email.toLowerCase().trim() })
      .select("_id role")
      .lean();

    // Generic error for all failure cases (prevents enumeration)
    const genericError = errors.validation("Unable to start conversation");

    // Validate target user exists
    if (!targetUser || Array.isArray(targetUser)) {
      return genericError;
    }

    // Prevent self-conversation
    const targetUserId = new Types.ObjectId(String(targetUser._id));
    if (targetUserId.equals(userId)) {
      return genericError;
    }

    // Determine mentorId and menteeId based on current user role
    // Note: Admins have role normalized to "mentor" in JWT, but can act as mentors
    if (auth.role === "mentee") {
      // Current user is mentee - target must be mentor/admin
      if (targetUser.role !== "mentor" && targetUser.role !== "admin") {
        return genericError;
      }
      mentorIdObj = targetUserId;
      menteeIdObj = userId;
    } else if (auth.role === "mentor") {
      // Current user is mentor (or admin normalized to mentor) - target must be mentee
      if (targetUser.role !== "mentee") {
        return genericError;
      }
      menteeIdObj = targetUserId;
      mentorIdObj = userId;
    } else {
      return genericError;
    }

    // Check if there's an active conversation first
    const existingActiveConversation = await Conversation.findOne({
      mentorId: mentorIdObj,
      menteeId: menteeIdObj,
      status: "ACTIVE",
    }).lean();

    // If there's an active conversation, return it instead of creating a new one
    if (existingActiveConversation && !Array.isArray(existingActiveConversation)) {
      const otherUserId = auth.role === "mentor" ? menteeIdObj : mentorIdObj;
      const otherUser = await User.findById(otherUserId).select("name email role").lean();
      if (!otherUser || Array.isArray(otherUser)) {
        return genericError;
      }
      return NextResponse.json(
        {
          id: String(existingActiveConversation._id),
          mentorId: String(existingActiveConversation.mentorId),
          menteeId: String(existingActiveConversation.menteeId),
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
                id: String(otherUser._id),
                name: otherUser.name,
                fullName: otherUser.name,
                email: otherUser.email,
                role: otherUser.role,
              }
            : null,
        },
        {
          status: 200,
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

    if (!conversation) {
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
      console.error("[Start Conversation] Failed to create welcome message:", msgError);
    }

    // Get other participant info for response
    const otherUserId = auth.role === "mentor" ? menteeIdObj : mentorIdObj;
    const otherUser = await User.findById(otherUserId).select("name email role").lean();
    
    if (!otherUser || Array.isArray(otherUser)) {
      return genericError;
    }

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
        otherParticipant: {
          id: String(otherUser._id),
          name: otherUser.name,
          fullName: otherUser.name,
          email: otherUser.email,
          role: otherUser.role,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Start conversation error:", error instanceof Error ? error.message : "Unknown error");
    
    // Handle duplicate key error (unique index violation)
    if (error instanceof Error && error.message.includes("E11000")) {
      // Conversation already exists, fetch it
      try {
        const userId = new Types.ObjectId(auth.sub);
        const targetUser = await User.findOne({ email: email.toLowerCase().trim() })
          .select("_id role")
          .lean();

        if (!targetUser || Array.isArray(targetUser)) {
          return errors.validation("Unable to start conversation");
        }

        const targetUserId = new Types.ObjectId(String(targetUser._id));
        if (targetUserId.equals(userId)) {
          return errors.validation("Unable to start conversation");
        }

        let mentorIdObj: Types.ObjectId | null = null;
        let menteeIdObj: Types.ObjectId | null = null;

        if (auth.role === "mentee" && (targetUser.role === "mentor" || targetUser.role === "admin")) {
          mentorIdObj = targetUserId;
          menteeIdObj = userId;
        } else if (auth.role === "mentor" && targetUser.role === "mentee") {
          menteeIdObj = targetUserId;
          mentorIdObj = userId;
        } else {
          return errors.validation("Unable to start conversation");
        }

        if (mentorIdObj && menteeIdObj) {
          const existing = await Conversation.findOne({
            mentorId: mentorIdObj,
            menteeId: menteeIdObj,
          }).lean();
          
          if (existing && !Array.isArray(existing)) {
            const otherUserId = auth.role === "mentor" ? menteeIdObj : mentorIdObj;
            const otherUser = await User.findById(otherUserId).select("name email role").lean();
            if (!otherUser || Array.isArray(otherUser)) {
              return errors.validation("Unable to start conversation");
            }
            return NextResponse.json(
              {
                id: String(existing._id),
                mentorId: String(existing.mentorId),
                menteeId: String(existing.menteeId),
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
                otherParticipant: {
                  id: String(otherUser._id),
                  name: otherUser.name,
                  fullName: otherUser.name,
                  email: otherUser.email,
                  role: otherUser.role,
                },
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
        // Fall through to generic error
      }
    }
    
    return errors.validation("Unable to start conversation");
  }
}

