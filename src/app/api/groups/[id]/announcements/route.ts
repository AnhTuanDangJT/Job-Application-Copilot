import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Group, GroupMember, GroupAnnouncement, Notification, Conversation, Message } from "@/models";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, createGroupAnnouncementSchema, isValidObjectId } from "@/lib/validation";
import { Types } from "mongoose";
import { broadcastToConversation } from "@/lib/websocket/broadcast";

/**
 * POST /api/groups/:id/announcements - Create a group announcement and notify all mentees
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

  const validation = await validateRequestBody(req, createGroupAnnouncementSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { content } = validation.data;

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

    // Create the announcement
    const announcement = await GroupAnnouncement.create({
      groupId,
      mentorId,
      content,
    });

    // Get all group members
    const members = await GroupMember.find({ groupId }).lean();

    // Create individual notifications for each mentee
    const notifications = members.map((member) => ({
      userId: member.menteeId,
      type: "GROUP_ANNOUNCEMENT" as const,
      title: `Group Announcement — ${group.name}`,
      body: content.length > 1000 ? content.substring(0, 997) + "..." : content, // Truncate for preview
      meta: {
        groupId: groupId.toString(),
        groupName: group.name,
        announcementId: announcement._id.toString(),
        fullContent: content, // Store full content in meta
      },
      // conversationId is optional for group announcements
    }));

    // Insert all notifications in bulk
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Create chat messages for each mentee in their 1-on-1 conversation with the mentor
    // Format: "📢 Group Announcement — {groupName}:\n\n{content}"
    // Message model has maxlength 10000, announcement content is max 5000, prefix is ~50-250 chars
    // So we're safe, but truncate if needed for safety
    const prefix = `📢 Group Announcement — ${group.name}:\n\n`;
    const MAX_MESSAGE_LENGTH = 10000;
    const maxContentLength = MAX_MESSAGE_LENGTH - prefix.length;
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength - 3) + "..." 
      : content;
    const announcementContent = prefix + truncatedContent;
    const previewText = content.length > 200 ? content.substring(0, 200) + "..." : content;
    const messagePreview = `📢 Group Announcement — ${group.name}: ${previewText}`;

    // Process each mentee to create or find conversation and create message
    const messagePromises = members.map(async (member) => {
      const menteeId = member.menteeId;

      // Find or create conversation between mentor and mentee
      let conversation = await Conversation.findOne({
        mentorId,
        menteeId,
      });

      if (!conversation) {
        // Create conversation if it doesn't exist (using same logic as conversations route)
        conversation = await Conversation.findOneAndUpdate(
          { mentorId, menteeId },
          {
            $setOnInsert: {
              mentorId,
              menteeId,
              sessionType: "RESUME",
              status: "ACTIVE",
              goal: "Improve resume and job readiness",
              startedAt: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
      }

      if (!conversation) {
        console.error(`[Group Announcement] Failed to find/create conversation for mentee ${menteeId}`);
        return null;
      }

      // Create message in conversation
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: mentorId,
        senderRole: "mentor",
        type: "TEXT",
        content: announcementContent,
        readBy: [mentorId], // Mentor has read their own message
      });

      // Update conversation lastMessagePreview and lastMessageAt
      await Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessagePreview: messagePreview,
            lastMessageAt: message.createdAt,
            updatedAt: new Date(),
          },
        }
      );

      // Broadcast message:new event in real-time
      broadcastToConversation(conversation._id.toString(), "message:new", {
        messageId: message._id.toString(),
        conversationId: conversation._id.toString(),
        senderId: mentorId.toString(),
        senderRole: "mentor",
        content: announcementContent,
        createdAt: message.createdAt.toISOString(),
      });

      return message;
    });

    // Wait for all messages to be created (don't fail if some fail)
    const createdMessages = await Promise.allSettled(messagePromises);
    const successCount = createdMessages.filter((result) => result.status === "fulfilled" && result.value !== null).length;

    // Log any failures (but don't fail the request)
    createdMessages.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[Group Announcement] Failed to create message for mentee ${members[index]?.menteeId}:`, result.reason);
      }
    });

    return NextResponse.json(
      {
        id: announcement._id.toString(),
        groupId: announcement.groupId.toString(),
        mentorId: announcement.mentorId.toString(),
        content: announcement.content,
        notifiedCount: notifications.length,
        messagesCreated: successCount,
        createdAt: announcement.createdAt.toISOString(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Create announcement error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating announcement");
  }
}

