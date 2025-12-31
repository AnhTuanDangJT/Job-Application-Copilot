import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { clearAuthCookie } from "@/lib/cookies";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/apiAuth";
import { User } from "@/models/User";
import { isSuperAdmin } from "@/lib/adminConfig";
import { errors } from "@/lib/errors";

/**
 * 🔥 SUPER ADMIN ONLY: Hard delete all user accounts and force logout
 * 
 * This endpoint completely removes all existing user accounts and invalidates
 * all login sessions, so the website behaves as if no one has ever signed up.
 * 
 * ⚠️ CRITICAL SECURITY: Only accessible by super admin email
 * Email-based authorization only - do NOT rely on role
 * 
 * Collections cleared:
 * - users (all user accounts)
 * - accounts (OAuth/credentials if exists)
 * - sessions (NextAuth sessions if exists)
 * - verificationTokens (email login tokens if exists)
 * - conversations (all conversations)
 * - messages (all messages)
 * - notifications (all notifications)
 * - groups (all groups)
 * - groupmembers (group membership)
 * - groupannouncements (group announcements)
 * - resumeshares (resume sharing data)
 * - logs (AI logs)
 * - conversationparticipants (mentor/mentee relations)
 * - reminders (all reminders)
 * - suggestions (all suggestions)
 * - feedback (all feedback)
 * - interviewpreps (interview prep data)
 * - applications (job applications)
 * - applicationboards (application boards)
 * - applicationrows (application rows)
 * - documentinsights (document insights)
 * - skillgapreports (skill gap reports)
 * - replysuggestions (reply suggestions)
 * - admininvites (admin invites)
 * - jobs (job listings - optional, commented out by default)
 */
export async function POST(req: NextRequest) {
  // 🔐 PART 3 — HARD-LOCK ADMIN CHECK (EMAIL ONLY)
  // Fetch user email from database - do NOT rely on role
  const auth = requireAuth(req);
  if (!auth) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Connect to database
    await connectToDatabase();
    
    // Fetch user to get email
    const user = await User.findById(auth.sub).lean();
    if (!user || Array.isArray(user)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Hard guard - only super admin email can access
    if (!isSuperAdmin(user.email)) {
      console.error("[DEV RESET] ❌ Unauthorized attempt to reset accounts - BLOCKED");
      return new NextResponse("Unauthorized", { status: 403 });
    }
  } catch (error) {
    console.error("[DEV RESET] ❌ Error verifying user:", error);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Database already connected, get db instance
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error("Database connection not available");
    }

    const clearedCollections: string[] = [];
    const errors: string[] = [];

    // 🧩 PART 1 — HARD DELETE ALL USER ACCOUNTS
    // Target collections (adjust names to your schema)
    const collectionsToClear = [
      // Core user data
      "users",                    // All user accounts
      "accounts",                  // OAuth / credentials if exists
      "sessions",                  // NextAuth sessions if exists
      "verificationtokens",        // Email login tokens if exists
      
      // Communication & collaboration
      "conversations",             // All conversations
      "messages",                  // All messages
      "conversationparticipants",  // Mentor/mentee relations
      
      // Groups
      "groups",                    // All groups
      "groupmembers",              // Group membership
      "groupannouncements",        // Group announcements
      
      // Notifications & reminders
      "notifications",             // All notifications
      "reminders",                 // All reminders
      
      // Documents & resumes
      "resumeshares",              // Resume sharing data
      "documentinsights",          // Document insights
      
      // Applications & jobs
      "applications",              // Job applications
      "applicationboards",         // Application boards
      "applicationrows",            // Application rows
      
      // Mentorship features
      "feedback",                  // All feedback
      "interviewpreps",            // Interview prep data
      "suggestions",               // All suggestions
      "replysuggestions",          // Reply suggestions
      "skillgapreports",           // Skill gap reports
      
      // Admin & system
      "admininvites",              // Admin invites
      "logs",                      // AI logs
      
      // Note: Uncomment below if you also want to delete job listings
      // "jobs",                   // Job listings (optional)
    ];

    console.log("[DEV RESET] 🧹 Starting hard delete of all user accounts...");
    console.log(`[DEV RESET] Clearing ${collectionsToClear.length} collections`);

    // Clear each collection using deleteMany({})
    // ⚠️ Use deleteMany({}) - Do NOT drop collections, Do NOT drop database
    for (const collectionName of collectionsToClear) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        clearedCollections.push(`${collectionName} (${result.deletedCount} documents)`);
        console.log(`[DEV RESET] ✅ Cleared ${collectionName}: ${result.deletedCount} documents`);
      } catch (error) {
        // Handle missing collections gracefully
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("does not exist") || 
            errorMessage.includes("not found") ||
            errorMessage.includes("ns not found")) {
          // Collection doesn't exist yet - this is fine, just log it
          console.log(`[DEV RESET] ⚠️ Collection ${collectionName} does not exist (skipping)`);
          clearedCollections.push(`${collectionName} (0 documents - collection doesn't exist)`);
        } else {
          errors.push(`${collectionName}: ${errorMessage}`);
          console.error(`[DEV RESET] ❌ Error clearing ${collectionName}:`, errorMessage);
        }
      }
    }

    // 🧹 PART 4 — FORCE SESSION INVALIDATION
    // Create response and clear auth cookie to invalidate all sessions
    const response = NextResponse.json({
      ok: true,
      message: "All accounts deleted",
      clearedCollections,
      errors: errors.length > 0 ? errors : undefined,
    });

    // Clear authentication cookie - this invalidates all existing sessions
    clearAuthCookie(response);

    console.log("[DEV RESET] ✅ Reset completed successfully");
    console.log(`[DEV RESET] Cleared ${clearedCollections.length} collections`);
    if (errors.length > 0) {
      console.warn(`[DEV RESET] ⚠️ ${errors.length} errors occurred (see details above)`);
    }

    return response;
  } catch (error) {
    console.error("[DEV RESET] ❌ Error during reset:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

