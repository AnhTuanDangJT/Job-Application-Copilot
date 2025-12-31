import { Types } from "mongoose";
import { Conversation } from "@/models/Conversation";
import { errors } from "@/lib/errors";

export interface ConversationAccessResult {
  conversation: Awaited<ReturnType<typeof Conversation.findById>>;
  otherUserId: string;
  otherRole: "mentee" | "mentor";
}

/**
 * Assert that the user has access to the conversation
 * Throws/returns error response if access is denied
 */
export async function assertConversationAccess(
  conversationId: string,
  userId: string
): Promise<{ success: true; conversation: NonNullable<Awaited<ReturnType<typeof Conversation.findById>>> } | { success: false; response: ReturnType<typeof errors.forbidden> }> {
  if (!Types.ObjectId.isValid(conversationId)) {
    return { success: false, response: errors.notFound("Conversation not found") };
  }

  const conversation = await Conversation.findById(conversationId).lean();
  
  if (!conversation) {
    return { success: false, response: errors.notFound("Conversation not found") };
  }

  const userIdObj = new Types.ObjectId(userId);
  const isMentor = conversation.mentorId.equals(userIdObj);
  const isMentee = conversation.menteeId.equals(userIdObj);

  if (!isMentor && !isMentee) {
    return { success: false, response: errors.forbidden("Access denied to this conversation") };
  }

  return { success: true, conversation: conversation as NonNullable<typeof conversation> };
}

/**
 * Get conversation for user if they have access, else return null
 */
export async function getConversationForUser(
  conversationId: string,
  userId: string
): Promise<NonNullable<Awaited<ReturnType<typeof Conversation.findById>>> | null> {
  if (!Types.ObjectId.isValid(conversationId)) {
    return null;
  }

  const conversation = await Conversation.findById(conversationId).lean();
  
  if (!conversation) {
    return null;
  }

  const userIdObj = new Types.ObjectId(userId);
  const isMentor = conversation.mentorId.equals(userIdObj);
  const isMentee = conversation.menteeId.equals(userIdObj);

  if (!isMentor && !isMentee) {
    return null;
  }

  return conversation as NonNullable<typeof conversation>;
}

/**
 * Get the other participant's info from a conversation
 */
export function getOtherParticipant(
  conversation: { mentorId: Types.ObjectId; menteeId: Types.ObjectId },
  userId: string
): { otherUserId: string; otherRole: "mentee" | "mentor" } {
  const userIdObj = new Types.ObjectId(userId);
  
  if (conversation.mentorId.equals(userIdObj)) {
    return {
      otherUserId: conversation.menteeId.toString(),
      otherRole: "mentee",
    };
  } else if (conversation.menteeId.equals(userIdObj)) {
    return {
      otherUserId: conversation.mentorId.toString(),
      otherRole: "mentor",
    };
  }
  
  throw new Error("User is not a participant in this conversation");
}






