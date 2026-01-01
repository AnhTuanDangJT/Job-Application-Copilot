import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Message } from "@/models/Message";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody, validateQueryParams, isValidObjectId } from "@/lib/validation";
import { sendMessageSchema } from "@/lib/validation";
import { assertConversationAccess, getOtherParticipant } from "@/lib/mentorCommunication/access";
import { Types } from "mongoose";
import { z } from "zod";
import { isUserAway, createNotification } from "@/lib/notifications";
import { broadcastToConversation } from "@/lib/websocket/broadcast";
// Removed saveUserFile import - using Base64 for Vercel serverless compatibility

const messagesQuerySchema = z.object({
  page: z.string().optional().transform((val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }),
  limit: z.string().optional().transform((val) => {
    const parsed = parseInt(val, 10);
    // Enforce max limit of 100 to prevent abuse
    if (isNaN(parsed) || parsed < 1) return 30;
    return parsed > 100 ? 100 : parsed;
  }),
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
  
  // Validate query parameters
  const queryValidation = validateQueryParams(req.nextUrl.searchParams, messagesQuerySchema);
  if (!queryValidation.success) {
    return errors.validation(queryValidation.error);
  }

  const { page = 1, limit = 30 } = queryValidation.data;
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Fetch messages with pagination (sorted ascending by createdAt for chat view)
    // CRITICAL: Always return deleted messages (they have deletedAt set but are not filtered out)
    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 }) // Ascending for chat view (oldest first)
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(
      {
        messages: messages.map((msg) => ({
          id: msg._id.toString(),
          conversationId: msg.conversationId.toString(),
          senderId: msg.senderId?.toString(),
          senderRole: msg.senderRole,
          type: msg.type,
          content: msg.content,
          imageUrl: msg.imageUrl,
          resumeShareId: msg.resumeShareId?.toString(),
          replyToMessageId: msg.replyToMessageId?.toString(),
          readBy: msg.readBy.map((id) => id.toString()),
          deletedAt: msg.deletedAt ? msg.deletedAt.toISOString() : undefined,
          deletedBy: msg.deletedBy?.toString(),
          createdAt: msg.createdAt,
        })),
        pagination: {
          page,
          limit,
          hasMore: messages.length === limit,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get messages error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching messages");
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

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { id } = await params;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);
    
    // Check if conversation is completed, cancelled, or ended
    if (conversation.status === "COMPLETED" || conversation.status === "CANCELLED" || conversation.status === "ENDED") {
      return errors.validation("Cannot send messages to a completed mentorship term. Please start a new mentorship to continue.");
    }
    
    // Determine sender role
    const senderRole: "mentee" | "mentor" = conversation.mentorId.equals(userId)
      ? "mentor"
      : "mentee";

    // Check if request is multipart/form-data (for image upload)
    const contentType = req.headers.get("content-type") || "";
    let content: string | undefined = undefined;
    let imageUrl: string | undefined = undefined;
    let replyToMessageId: Types.ObjectId | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart/form-data request
      const formData = await req.formData();
      const textField = formData.get("text");
      const imageFile = formData.get("image") as File | null;
      const replyToField = formData.get("replyToMessageId");

      // Get text content
      if (textField && typeof textField === "string") {
        content = textField.trim() || undefined;
      }

      // Get replyToMessageId
      if (replyToField && typeof replyToField === "string" && replyToField.trim()) {
        if (isValidObjectId(replyToField)) {
          replyToMessageId = new Types.ObjectId(replyToField);
        } else {
          return errors.validation("Invalid replyToMessageId format");
        }
      }

      // Handle image upload
      if (imageFile && imageFile instanceof File) {
        // Validate file type
        if (!imageFile.type.startsWith("image/")) {
          return errors.validation("Invalid file type. Only image files are allowed.");
        }

        // Validate file size (10MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (imageFile.size > MAX_FILE_SIZE) {
          const fileSizeMB = (imageFile.size / (1024 * 1024)).toFixed(2);
          return errors.validation(`Image size (${fileSizeMB}MB) exceeds 10MB limit`);
        }

        // Convert to Base64 data URL for Vercel serverless compatibility
        // TODO: Migrate to cloud storage (S3/Cloudinary) for production scalability
        try {
          const arrayBuffer = await imageFile.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Validate buffer is not empty
          if (!buffer || buffer.length === 0) {
            return errors.validation("Invalid image data");
          }
          
          // Convert to Base64 data URL
          const base64 = buffer.toString("base64");
          imageUrl = `data:${imageFile.type};base64,${base64}`;
        } catch (uploadError) {
          console.error("[Send Message] Image upload error:", uploadError);
          return errors.internal("Failed to process image. Please try again.");
        }
      }

      // Validate that at least one of content or imageUrl is provided
      if (!content && !imageUrl) {
        return errors.validation("Either text or image must be provided");
      }
    } else {
      // Handle JSON request (backward compatibility)
      // Parse JSON body manually to get all fields including replyToMessageId
      let body: any = {};
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch (parseError) {
        return errors.validation("Invalid JSON in request body");
      }
      
      // Validate message content using schema (this validates content/imageUrl)
      const validation = sendMessageSchema.safeParse(body);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        return errors.validation(firstError?.message || "Invalid message data");
      }
      content = validation.data.content;
      imageUrl = validation.data.imageUrl;
      
      // Get replyToMessageId from parsed body (not in schema, so extract separately)
      if (body.replyToMessageId && typeof body.replyToMessageId === "string") {
        if (isValidObjectId(body.replyToMessageId)) {
          replyToMessageId = new Types.ObjectId(body.replyToMessageId);
        } else {
          return errors.validation("Invalid replyToMessageId format");
        }
      }
    }

    // Validate replyToMessageId exists in conversation if provided
    if (replyToMessageId) {
      const repliedMessage = await Message.findOne({
        _id: replyToMessageId,
        conversationId: new Types.ObjectId(id),
      });
      if (!repliedMessage) {
        return errors.validation("Replied message not found in this conversation");
      }
    }

    // Create message
    const message = await Message.create({
      conversationId: new Types.ObjectId(id),
      senderId: userId,
      senderRole,
      type: "TEXT",
      content: content || undefined,
      imageUrl: imageUrl || undefined,
      replyToMessageId: replyToMessageId || undefined,
      readBy: [userId], // Sender has read their own message
    });

    // Update conversation lastMessagePreview and lastMessageAt
    // Use updateOne and don't await - fire and forget to avoid blocking
    // CRITICAL: Only update mutable fields (never mentorId/menteeId)
    // If this fails, the message is still created, which is acceptable
    const previewText = content || (imageUrl ? "[Image]" : "");
    const preview = previewText.length > 200 ? previewText.substring(0, 200) + "..." : previewText;
    Conversation.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: {
          lastMessagePreview: preview,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      }
    ).catch((updateError) => {
      // Log but don't fail the request
      console.error("[Send Message] Failed to update conversation:", updateError);
    });

    // Broadcast message:new event in real-time
    broadcastToConversation(id, "message:new", {
      messageId: message._id.toString(),
      conversationId: id,
      senderId: auth.sub,
      senderRole,
      content: content || undefined,
      imageUrl: imageUrl || undefined,
      createdAt: message.createdAt.toISOString(),
    });

    // Check if recipient is offline and create notification
    try {
      const { otherUserId } = getOtherParticipant(conversation, auth.sub);
      const away = await isUserAway(id, otherUserId, message.createdAt);
      if (away) {
        // Create notification asynchronously (don't await to avoid blocking)
        createNotification(
          otherUserId,
          id,
          "NEW_MESSAGE",
          senderRole === "mentor" ? "New message from mentor" : "New message from mentee",
          preview,
          `/mentor-communication/${id}`
        ).catch((notifError) => {
          console.error("[Send Message] Failed to create notification:", notifError);
        });
      }
    } catch (error) {
      // If getOtherParticipant fails, just log and continue
      console.error("[Send Message] Failed to get other participant:", error);
    }

    return NextResponse.json(
      {
        id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        senderId: message.senderId?.toString(),
        senderRole: message.senderRole,
        type: message.type,
        content: message.content,
        imageUrl: message.imageUrl,
        resumeShareId: message.resumeShareId?.toString(),
        replyToMessageId: message.replyToMessageId?.toString(),
        readBy: message.readBy.map((id) => id.toString()),
        deletedAt: message.deletedAt ? message.deletedAt.toISOString() : undefined,
        deletedBy: message.deletedBy?.toString(),
        createdAt: message.createdAt,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Send message error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while sending message");
  }
}

