export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getServerAuth } from "@/lib/serverAuth";
import { connectToDatabase } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { User } from "@/models/User";
import { Types } from "mongoose";
import { isValidObjectId, isValidConversationId } from "@/lib/validation";
import ConversationPageClient from "@/components/mentorCommunication/ConversationPageClient";

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

async function getConversationData(conversationId: string): Promise<{
  conversation: {
    id: string;
    mentorId: string;
    menteeId: string;
    goal?: string;
    focusAreas?: string[];
    sessionType?: "RESUME_REVIEW" | "INTERVIEW" | undefined;
    status?: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ENDED";
    startedAt?: Date;
    completedAt?: Date;
  };
  otherParticipant: {
    id: string;
    name: string;
    fullName?: string;
    email?: string;
    role: "mentee" | "mentor" | "admin";
  } | null;
  mentorInfo: { name: string; role: string } | null;
  menteeInfo: { name: string; role: string } | null;
  userRole: "mentee" | "mentor" | "admin";
  currentUserName: string;
} | null> {
  try {
    // A) Validate conversationId before querying - CRITICAL: Never fetch with invalid IDs
    if (!isValidConversationId(conversationId)) {
      console.error("[CONVERSATION] Invalid conversationId format:", conversationId);
      // Return null instead of calling notFound() - caller will handle fallback UI
      return null;
    }

    const payload = await getServerAuth();
    if (!payload) {
      redirect("/auth/login");
    }

    // Connect to database with error handling
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("[CONVERSATION] Database connection error:", dbError instanceof Error ? dbError.message : String(dbError));
      throw new Error("Database connection failed");
    }

    // Safely create ObjectId for userId
    let userId: Types.ObjectId;
    try {
      userId = new Types.ObjectId(payload.sub);
    } catch (error) {
      console.error("[CONVERSATION] Invalid userId format:", payload.sub);
      redirect("/auth/login");
    }

    // B) Handle null conversation - return notFound instead of redirect
    const conversationRaw = await Conversation.findById(conversationId).lean();

    if (!conversationRaw || Array.isArray(conversationRaw)) {
      console.error("[CONVERSATION] Conversation not found:", conversationId);
      notFound();
    }

    // Type assertion: findById with lean returns a single document or null
    const conversation = conversationRaw as unknown as {
      _id: Types.ObjectId;
      mentorId: Types.ObjectId | string;
      menteeId: Types.ObjectId | string;
      goal?: string;
      focusAreas?: string[];
      sessionType?: "RESUME" | "INTERVIEW" | "JOB_SEARCH";
      status?: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ENDED";
      startedAt?: Date;
      completedAt?: Date;
      endedAt?: Date;
      lastMessageAt?: Date;
      lastMessagePreview?: string;
      createdAt: Date;
      updatedAt: Date;
    };

    // C) Enforce access - return notFound for forbidden (security: don't reveal existence)
    // CRITICAL: Check access and validate role consistency
    // User ID comes ONLY from server auth (immutable during chat flow)
    let mentorIdStr: string;
    let menteeIdStr: string;
    try {
      mentorIdStr = (conversation.mentorId instanceof Types.ObjectId ? conversation.mentorId : new Types.ObjectId(conversation.mentorId)).toString();
      menteeIdStr = (conversation.menteeId instanceof Types.ObjectId ? conversation.menteeId : new Types.ObjectId(conversation.menteeId)).toString();
    } catch (error) {
      console.error("[CONVERSATION] Invalid mentorId/menteeId format in conversation:", conversationId, error);
      notFound();
    }

    const userIdStr = userId.toString();
    const isMentor = mentorIdStr === userIdStr;
    const isMentee = menteeIdStr === userIdStr;

    if (!isMentor && !isMentee) {
      console.error("[CONVERSATION] Access denied - user not in conversation:", conversationId, "userId:", userIdStr);
      notFound(); // Return 404 instead of 403 to not reveal conversation existence
    }

    // DEFENSIVE: Verify role matches conversation role (safety check)
    // If user is mentor, they must be in mentorId field; if mentee, must be in menteeId field
    if (payload.role === "mentor" && !isMentor) {
      console.error("[AUTH] Role mismatch: User has mentor role but is not in conversation.mentorId");
      notFound();
    }
    if (payload.role === "mentee" && !isMentee) {
      console.error("[AUTH] Role mismatch: User has mentee role but is not in conversation.menteeId");
      notFound();
    }

    // D) Prevent undefined usage - use optional chaining and safe ObjectId creation
    // Get other participant (read-only, derived from conversation document)
    const otherUserId = isMentor ? conversation.menteeId : conversation.mentorId;
    let otherUserIdObj: Types.ObjectId;
    try {
      otherUserIdObj = otherUserId instanceof Types.ObjectId ? otherUserId : new Types.ObjectId(otherUserId);
    } catch (error) {
      console.error("[CONVERSATION] Invalid otherUserId format:", otherUserId);
      notFound();
    }

    const otherUserRaw = await User.findById(otherUserIdObj).select("name email role").lean();

    // DEFENSIVE: Ensure other participant has opposite role (never show current user as other participant)
    const otherUser = otherUserRaw && !Array.isArray(otherUserRaw) ? otherUserRaw as unknown as { name: string; email: string; role: string; _id: Types.ObjectId } : null;
    if (otherUser && otherUser.role === payload.role) {
      console.error("[AUTH] Role conflict: Other participant has same role as current user");
      notFound();
    }

    // Get mentor and mentee info for context card with safe ObjectId creation
    let mentorIdObj: Types.ObjectId;
    let menteeIdObj: Types.ObjectId;
    try {
      mentorIdObj = conversation.mentorId instanceof Types.ObjectId ? conversation.mentorId : new Types.ObjectId(conversation.mentorId);
      menteeIdObj = conversation.menteeId instanceof Types.ObjectId ? conversation.menteeId : new Types.ObjectId(conversation.menteeId);
    } catch (error) {
      console.error("[CONVERSATION] Invalid mentorId/menteeId format:", error);
      notFound();
    }

    const mentorRaw = await User.findById(mentorIdObj).select("name role").lean();
    const menteeRaw = await User.findById(menteeIdObj).select("name role").lean();
    const mentor = mentorRaw && !Array.isArray(mentorRaw) ? mentorRaw as unknown as { name: string; role: string; _id: Types.ObjectId } : null;
    const mentee = menteeRaw && !Array.isArray(menteeRaw) ? menteeRaw as unknown as { name: string; role: string; _id: Types.ObjectId } : null;

    // Map database sessionType to component's expected type
    const sessionType = conversation.sessionType === "RESUME" ? "RESUME_REVIEW" : conversation.sessionType === "JOB_SEARCH" ? undefined : conversation.sessionType;

    return {
      conversation: {
        id: conversation._id.toString(),
        mentorId: conversation.mentorId.toString(),
        menteeId: conversation.menteeId.toString(),
        goal: conversation.goal,
        focusAreas: conversation.focusAreas,
        sessionType: sessionType as "RESUME_REVIEW" | "INTERVIEW" | undefined,
        status: conversation.status,
        startedAt: conversation.startedAt,
        completedAt: conversation.completedAt,
      },
      otherParticipant: otherUser
        ? {
            id: otherUser._id.toString(),
            name: otherUser.name,
            fullName: otherUser.name,
            email: otherUser.email,
            role: otherUser.role as "mentee" | "mentor" | "admin",
          }
        : null,
      mentorInfo: mentor
        ? {
            name: mentor.name,
            role: mentor.role,
          }
        : null,
      menteeInfo: mentee
        ? {
            name: mentee.name,
            role: mentee.role,
          }
        : null,
      userRole: payload.role as "mentee" | "mentor" | "admin",
      currentUserName: (mentor && isMentor ? mentor.name : mentee?.name) || "",
    };
  } catch (error) {
    // 2) Reproduce and locate the real error - log with conversationId
    console.error("[CONVERSATION] Error fetching conversation data:", {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // If it's a notFound() call, re-throw it
    if (error && typeof error === "object" && "digest" in error) {
      throw error; // Re-throw Next.js notFound() error
    }
    
    // For other errors, return notFound to show friendly UI instead of 500
    notFound();
  }
}

// Safe fallback UI component for invalid conversationIds
function ConversationLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#734C23] mx-auto"></div>
        <p className="text-gray-600 text-lg">Preparing conversation...</p>
      </div>
    </div>
  );
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  try {
    const { conversationId } = await params;
    
    // CRITICAL: Early validation - check for invalid IDs BEFORE any data fetching
    // This prevents 404 crashes when conversationId is "uploading..." or other invalid values
    if (!isValidConversationId(conversationId)) {
      console.log("[CONVERSATION] Invalid conversationId detected (likely placeholder), showing loading state:", conversationId);
      // Return safe fallback UI instead of calling notFound() - prevents crash during uploads
      return <ConversationLoadingFallback />;
    }

    // Only fetch data if conversationId is valid
    const data = await getConversationData(conversationId);

    // Handle case where getConversationData returns null (invalid ID was caught inside)
    if (!data) {
      console.log("[CONVERSATION] getConversationData returned null for invalid ID:", conversationId);
      return <ConversationLoadingFallback />;
    }

    // D) Prevent undefined usage in UI - guard every usage
    if (!data.conversation || !data.userRole) {
      console.error("[CONVERSATION] Missing required data fields:", { conversationId, hasConversation: !!data.conversation, hasUserRole: !!data.userRole });
      // Return fallback UI instead of crashing
      return <ConversationLoadingFallback />;
    }

    return (
      <ConversationPageClient
        conversationId={conversationId}
        userRole={data.userRole}
        otherParticipant={data.otherParticipant}
        sessionType={data.conversation.sessionType}
        conversationStatus={data.conversation.status}
      />
    );
  } catch (error) {
    // Catch any unexpected errors and show friendly UI
    console.error("[CONVERSATION] Unexpected error in ConversationPage:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // If it's a notFound() call, re-throw it (for legitimate 404s, not invalid placeholders)
    if (error && typeof error === "object" && "digest" in error) {
      throw error; // Re-throw Next.js notFound() error
    }
    
    // For other errors, show fallback UI instead of crashing
    return <ConversationLoadingFallback />;
  }
}

