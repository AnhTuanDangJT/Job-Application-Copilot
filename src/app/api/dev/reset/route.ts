import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { clearAuthCookie } from "@/lib/cookies";
import mongoose from "mongoose";

/**
 * DEV-ONLY: Reset all application data
 * 
 * This endpoint deletes all user-related data from the database
 * and clears authentication state. It is ONLY available in development.
 * 
 * Collections cleared:
 * - users
 * - conversations
 * - messages
 * - notifications
 * - groups
 * - resumes (ResumeShare)
 * - aiLogs (Log)
 * - mentor/mentee relations (ConversationParticipant, GroupMember)
 * - Related data (GroupAnnouncement, Reminder, Suggestion, Feedback, etc.)
 */
export async function POST(req: NextRequest) {
  // 🔐 MANDATORY: Production guard - NEVER allow in production
  if (process.env.NODE_ENV === "production") {
    console.error("[DEV RESET] Attempted to call reset API in production - BLOCKED");
    return new NextResponse("Not allowed", { status: 403 });
  }

  try {
    // Connect to database
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error("Database connection not available");
    }

    const clearedCollections: string[] = [];
    const errors: string[] = [];

    // List of collections to clear
    const collectionsToClear = [
      "users",
      "conversations",
      "messages",
      "notifications",
      "groups",
      "resumeshares", // ResumeShare model
      "logs", // Log model (aiLogs)
      "conversationparticipants", // ConversationParticipant model
      "groupmembers", // GroupMember model
      "groupannouncements", // GroupAnnouncement model
      "reminders", // Reminder model
      "suggestions", // Suggestion model
      "feedback", // Feedback model
      "interviewpreps", // InterviewPrep model
      "applications", // Application model
      "applicationboards", // ApplicationBoard model
      "applicationrows", // ApplicationRow model
      "documentinsights", // DocumentInsight model
      "skillgapreports", // SkillGapReport model
      "replysuggestions", // ReplySuggestion model
      "admininvites", // AdminInvite model
    ];

    // Clear each collection using deleteMany({})
    for (const collectionName of collectionsToClear) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        clearedCollections.push(`${collectionName} (${result.deletedCount} documents)`);
        console.log(`[DEV RESET] Cleared ${collectionName}: ${result.deletedCount} documents`);
      } catch (error) {
        // Handle missing collections gracefully
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("does not exist") || errorMessage.includes("not found")) {
          // Collection doesn't exist yet - this is fine, just log it
          console.log(`[DEV RESET] Collection ${collectionName} does not exist (skipping)`);
        } else {
          errors.push(`${collectionName}: ${errorMessage}`);
          console.error(`[DEV RESET] Error clearing ${collectionName}:`, errorMessage);
        }
      }
    }

    // Create response and clear auth cookie
    const response = NextResponse.json({
      ok: true,
      message: "Application data reset successfully",
      clearedCollections,
      errors: errors.length > 0 ? errors : undefined,
    });

    // Clear authentication cookie
    clearAuthCookie(response);

    console.log("[DEV RESET] Reset completed successfully");
    console.log(`[DEV RESET] Cleared ${clearedCollections.length} collections`);

    return response;
  } catch (error) {
    console.error("[DEV RESET] Error during reset:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}


