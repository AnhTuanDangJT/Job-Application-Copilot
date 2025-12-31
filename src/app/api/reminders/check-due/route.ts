/**
 * POST /api/reminders/check-due - Check for due reminders and create notifications
 * This endpoint should be called periodically (e.g., every minute via cron or scheduled task)
 * 
 * In production, set up a cron job to call this endpoint:
 * - Vercel Cron: https://vercel.com/docs/cron-jobs
 * - Or use an external service like EasyCron, cron-job.org
 * - Or use a worker process that calls this endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Reminder } from "@/models/Reminder";
import { Conversation } from "@/models/Conversation";
import { createNotification } from "@/lib/notifications";
import { Types } from "mongoose";

/**
 * POST /api/reminders/check-due - Check for due reminders
 * This is a protected endpoint that should be called by a cron service or worker
 * You can add authentication/authorization here if needed
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const now = new Date();
    
    // Find all pending reminders that are due (dueAt <= now)
    const dueReminders = await Reminder.find({
      status: "pending",
      dueAt: { $lte: now },
    }).lean();

    let processedCount = 0;
    let errorCount = 0;

    // Process each due reminder
    for (const reminder of dueReminders) {
      try {
        // Mark reminder as triggered
        await Reminder.updateOne(
          { _id: reminder._id },
          { $set: { status: "triggered" } }
        );

        // Get conversation to find participants
        const conversation = await Conversation.findById(reminder.conversationId).lean();
        if (!conversation) {
          console.error(`[Reminder Scheduler] Conversation not found: ${reminder.conversationId}`);
          errorCount++;
          continue;
        }

        // Create notifications for both participants
        const reminderTypeLabels: Record<string, string> = {
          "follow-up": "Follow-up reminder",
          "interview": "Interview reminder",
          "thank-you": "Thank-you note reminder",
        };

        const title = reminderTypeLabels[reminder.type] || "Reminder";
        const body = `Reminder: ${title} is due now.`;
        const link = reminder.applicationId
          ? `/mentor-communication/${reminder.conversationId}/applications`
          : `/mentor-communication/${reminder.conversationId}`;

        // Notify mentor
        await createNotification(
          conversation.mentorId.toString(),
          reminder.conversationId.toString(),
          "reminder_due",
          title,
          body,
          link,
          {
            reminderId: reminder._id.toString(),
            reminderType: reminder.type,
            applicationId: reminder.applicationId?.toString(),
          }
        ).catch((error) => {
          console.error(`[Reminder Scheduler] Failed to create notification for mentor:`, error);
        });

        // Notify mentee
        await createNotification(
          conversation.menteeId.toString(),
          reminder.conversationId.toString(),
          "reminder_due",
          title,
          body,
          link,
          {
            reminderId: reminder._id.toString(),
            reminderType: reminder.type,
            applicationId: reminder.applicationId?.toString(),
          }
        ).catch((error) => {
          console.error(`[Reminder Scheduler] Failed to create notification for mentee:`, error);
        });

        processedCount++;
      } catch (error) {
        console.error(`[Reminder Scheduler] Error processing reminder ${reminder._id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      totalDue: dueReminders.length,
    });
  } catch (error) {
    console.error("[Reminder Scheduler] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reminders/check-due - Health check for reminder scheduler
 */
export async function GET() {
  return NextResponse.json({
    message: "Reminder scheduler endpoint is active",
    timestamp: new Date().toISOString(),
  });
}




