/**
 * GET /api/reminders/[id]/calendar - Generate .ics calendar file for reminder
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Reminder } from "@/models/Reminder";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isValidObjectId } from "@/lib/validation";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";

/**
 * Generate .ics file content for a reminder
 */
function generateICS(
  reminderId: string,
  type: string,
  dueAt: Date,
  conversationId: string
): string {
  const reminderTypeLabels: Record<string, string> = {
    "follow-up": "Follow-up Reminder",
    "interview": "Interview Reminder",
    "thank-you": "Thank-you Note Reminder",
  };

  const title = reminderTypeLabels[type] || "Reminder";
  const startDate = dueAt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const endDate = new Date(dueAt.getTime() + 30 * 60 * 1000) // 30 minutes duration
    .toISOString()
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `reminder-${reminderId}@job-app-copilot`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Job Application Copilot//Reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${title} for job application`,
    `LOCATION:Online`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${title} in 15 minutes`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * GET /api/reminders/[id]/calendar - Get .ics calendar file
 */
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

  if (!isValidObjectId(id)) {
    return errors.validation("Invalid reminder ID");
  }

  try {
    await connectToDatabase();

    // Find reminder
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return errors.notFound("Reminder not found");
    }

    // Check conversation access
    const accessCheck = await assertConversationAccess(
      reminder.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // Generate .ics content
    const icsContent = generateICS(
      reminder._id.toString(),
      reminder.type,
      reminder.dueAt,
      reminder.conversationId.toString()
    );

    // Return .ics file
    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="reminder-${id}.ics"`,
      },
    });
  } catch (error) {
    console.error("Generate calendar error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while generating calendar file");
  }
}





