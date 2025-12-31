import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { ApplicationRow } from "@/models/ApplicationRow";
import { Suggestion } from "@/models/Suggestion";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { Types } from "mongoose";

interface ActivityEvent {
  id: string;
  type: "application" | "suggestion" | "reminder" | "activityLog" | "message";
  conversationId: string;
  menteeName: string;
  message: string;
  timestamp: Date;
  metadata?: any;
}

export async function GET(req: NextRequest) {
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["mentor", "admin"]);
  if (auth instanceof Response) return auth;

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  try {
    await connectToDatabase();

    const mentorId = new Types.ObjectId(auth.sub);

    // Get all conversations where user is mentor
    const conversations = await Conversation.find({ mentorId })
      .populate("menteeId", "name")
      .lean();

    const conversationMap = new Map(
      conversations.map((conv) => [conv._id.toString(), conv])
    );

    const allActivities: ActivityEvent[] = [];

    // Collect activity from application rows (tags, reminders, activity log)
    for (const conv of conversations) {
      const conversationId = conv._id.toString();
      const menteeName = (conv.menteeId as any).name || "Unknown";

      const rows = await ApplicationRow.find({
        conversationId: conv._id,
      })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();

      for (const row of rows) {
        // Activity log entries
        if (row.activityLog && Array.isArray(row.activityLog)) {
          for (const entry of row.activityLog.slice(-5)) {
            allActivities.push({
              id: `${row._id}-activity-${entry.id}`,
              type: "activityLog",
              conversationId,
              menteeName,
              message: entry.message,
              timestamp: entry.timestamp,
              metadata: {
                applicationId: row._id.toString(),
                authorRole: entry.authorRole,
                company: row.cells?.company || "",
                role: row.cells?.position || row.cells?.role || "",
              },
            });
          }
        }

        // Reminders (only upcoming ones)
        if (row.reminders && Array.isArray(row.reminders)) {
          const now = new Date();
          for (const reminder of row.reminders) {
            if (reminder.date && new Date(reminder.date) >= now) {
              allActivities.push({
                id: `${row._id}-reminder-${reminder.id}`,
                type: "reminder",
                conversationId,
                menteeName,
                message: `Reminder: ${reminder.type} for ${row.cells?.company || "application"}`,
                timestamp: new Date(reminder.date),
                metadata: {
                  applicationId: row._id.toString(),
                  reminderType: reminder.type,
                  company: row.cells?.company || "",
                  role: row.cells?.position || row.cells?.role || "",
                },
              });
            }
          }
        }

        // Application updates (from history)
        if (row.history && Array.isArray(row.history) && row.history.length > 0) {
          const latestHistory = row.history[row.history.length - 1];
          allActivities.push({
            id: `${row._id}-history-${latestHistory.id}`,
            type: "application",
            conversationId,
            menteeName,
            message: `${latestHistory.changedBy === "mentor" ? "Mentor" : "Mentee"} updated ${latestHistory.field}`,
            timestamp: latestHistory.timestamp,
            metadata: {
              applicationId: row._id.toString(),
              field: latestHistory.field,
              changedBy: latestHistory.changedBy,
              company: row.cells?.company || "",
              role: row.cells?.position || row.cells?.role || "",
            },
          });
        }
      }
    }

    // Collect suggestion events
    const suggestions = await Suggestion.find({
      conversationId: { $in: conversations.map((c) => c._id) },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    for (const suggestion of suggestions) {
      const conv = conversationMap.get(suggestion.conversationId.toString());
      if (conv) {
        const menteeName = (conv.menteeId as any).name || "Unknown";
        allActivities.push({
          id: `suggestion-${suggestion._id}`,
          type: "suggestion",
          conversationId: suggestion.conversationId.toString(),
          menteeName,
          message: `New suggestion for ${suggestion.field}`,
          timestamp: suggestion.createdAt,
          metadata: {
            suggestionId: suggestion._id.toString(),
            applicationId: suggestion.applicationId.toString(),
            status: suggestion.status,
            field: suggestion.field,
          },
        });
      }
    }

    // Collect recent messages
    const messages = await Message.find({
      conversationId: { $in: conversations.map((c) => c._id) },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    for (const message of messages) {
      const conv = conversationMap.get(message.conversationId.toString());
      if (conv) {
        const menteeName = (conv.menteeId as any).name || "Unknown";
        const preview = (message.content || "").substring(0, 100);
        const senderRole = message.senderRole || "system";
        allActivities.push({
          id: `message-${message._id}`,
          type: "message",
          conversationId: message.conversationId.toString(),
          menteeName,
          message: senderRole === "mentee" ? `Mentee: ${preview}` : `Mentor: ${preview}`,
          timestamp: message.createdAt,
          metadata: {
            messageId: message._id.toString(),
            authorRole: senderRole,
          },
        });
      }
    }

    // Sort by timestamp and limit
    allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivities = allActivities.slice(0, limit);

    return NextResponse.json(
      { activities: recentActivities },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get activity error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching activity");
  }
}

