/**
 * Notification helper functions
 */

import { Types } from "mongoose";
import { Notification, type NotificationType } from "@/models/Notification";
import { ConversationParticipant } from "@/models/ConversationParticipant";
import { Conversation } from "@/models/Conversation";
import { broadcastToConversation } from "@/lib/websocket/broadcast";

/**
 * Update lastSeenAt when user opens a conversation
 */
export async function updateLastSeen(conversationId: string, userId: string): Promise<void> {
  try {
    await ConversationParticipant.findOneAndUpdate(
      { conversationId: new Types.ObjectId(conversationId), userId: new Types.ObjectId(userId) },
      {
        $set: {
          lastSeenAt: new Date(),
          lastActiveAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("[updateLastSeen] Error:", error);
    // Don't throw - this is a non-critical operation
  }
}

const PRESENCE_THRESHOLD_MS = 30 * 1000; // 30 seconds

/**
 * Check if user is away from conversation
 * User is "away" (offline) if:
 * - not currently viewing that conversation OR
 * - lastActiveAt is more than 30 seconds ago (presence-based)
 */
export async function isUserAway(
  conversationId: string,
  userId: string,
  newestMessageCreatedAt: Date
): Promise<boolean> {
  try {
    const participant = await ConversationParticipant.findOne({
      conversationId: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    });

    if (!participant) {
      // No record means user hasn't seen this conversation yet
      return true;
    }

    // Check presence: user is offline if lastActiveAt is more than 30 seconds ago
    const now = new Date();
    const timeSinceLastActive = now.getTime() - participant.lastActiveAt.getTime();
    const isOffline = timeSinceLastActive >= PRESENCE_THRESHOLD_MS;

    return isOffline;
  } catch (error) {
    console.error("[isUserAway] Error:", error);
    // On error, assume user is away (safer default)
    return true;
  }
}

/**
 * Create a notification and broadcast it in real-time
 */
export async function createNotification(
  userId: string,
  conversationId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  meta?: Record<string, any>
): Promise<string> {
  try {
    const notification = await Notification.create({
      userId: new Types.ObjectId(userId),
      conversationId: new Types.ObjectId(conversationId),
      type,
      title,
      body,
      link,
      meta: meta || {},
    });

    // Broadcast notification in real-time
    broadcastToConversation(conversationId, "notification:new", {
      notificationId: notification._id.toString(),
      userId,
      conversationId,
      type,
      title,
      body,
      link,
      createdAt: notification.createdAt.toISOString(),
    });

    return notification._id.toString();
  } catch (error) {
    console.error("[createNotification] Error:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  try {
    await Notification.updateOne(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          readAt: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("[markNotificationAsRead] Error:", error);
    throw error;
  }
}

/**
 * Mark all notifications for a conversation as read
 */
export async function markConversationNotificationsAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    await Notification.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
        readAt: { $exists: false },
      },
      {
        $set: {
          readAt: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("[markConversationNotificationsAsRead] Error:", error);
    // Don't throw - this is a non-critical operation
  }
}

