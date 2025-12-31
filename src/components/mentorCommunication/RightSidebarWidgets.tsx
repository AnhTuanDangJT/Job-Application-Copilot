"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, User, AlertCircle } from "lucide-react";
import Link from "next/link";
import ProgressDashboard from "./ProgressDashboard";
import ResumeSharePanel from "./ResumeSharePanel";
import InterviewPrepPanel from "./InterviewPrepPanel";

interface RightSidebarWidgetsProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
  otherParticipant?: {
    id: string;
    name: string;
    fullName?: string;
    email?: string;
    role: "mentee" | "mentor" | "admin";
  } | null;
  sessionType?: "RESUME_REVIEW" | "INTERVIEW";
}

interface Reminder {
  id: string;
  type: "follow-up" | "interview" | "thank-you";
  dueAt: string;
  status: "pending" | "triggered" | "cancelled";
}

export default function RightSidebarWidgets({
  conversationId,
  userRole,
  otherParticipant,
  sessionType = "RESUME_REVIEW",
}: RightSidebarWidgetsProps) {
  // Fetch upcoming reminders
  const { data: remindersData } = useQuery<{ reminders: Reminder[] }>({
    queryKey: ["reminders", conversationId, "upcoming"],
    queryFn: async () => {
      const res = await fetch(`/api/reminders?conversationId=${conversationId}`, {
        credentials: "include",
      });
      if (!res.ok) return { reminders: [] };
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get upcoming reminders (next 3, sorted by due date)
  const upcomingReminders = remindersData?.reminders
    ?.filter((r) => r.status === "pending" && new Date(r.dueAt) > new Date())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 3) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Soon";
    if (diffHours < 24) return `In ${diffHours}h`;
    if (diffDays < 7) return `In ${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {/* Progress Summary - Top of right sidebar */}
      <div className="flex-shrink-0">
        <ProgressDashboard conversationId={conversationId} userRole={userRole} />
      </div>
      
      {/* Resumes Section - Main content, takes remaining space and fills height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {sessionType === "INTERVIEW" ? (
          <div className="h-full overflow-y-auto">
            <InterviewPrepPanel conversationId={conversationId} userRole={userRole} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <ResumeSharePanel conversationId={conversationId} userRole={userRole} />
          </div>
        )}
      </div>
      
      {/* Widgets - Bottom section */}
      <div className="flex-shrink-0 space-y-3 pt-3 border-t border-gray-200">
        {/* Upcoming Reminders */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Upcoming</h3>
          </div>
          {upcomingReminders.length === 0 ? (
            <p className="text-xs text-gray-500">No upcoming reminders</p>
          ) : (
            <div className="space-y-2">
              {upcomingReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="text-xs p-2 rounded bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 capitalize">
                        {reminder.type.replace("-", " ")}
                      </div>
                      <div className="text-gray-500 mt-0.5">{formatDate(reminder.dueAt)}</div>
                    </div>
                    {new Date(reminder.dueAt).getTime() - Date.now() < 24 * 60 * 60 * 1000 && (
                      <AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {upcomingReminders.length > 0 && (
            <Link
              href={`/mentor-communication/${conversationId}?tab=reminders`}
              className="block mt-2 text-xs text-[#734C23] hover:text-[#9C6A45] font-medium"
            >
              View all →
            </Link>
          )}
        </div>

        {/* Mentee Summary */}
        {otherParticipant && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                {userRole === "mentor" ? "Mentee" : "Mentor"}
              </h3>
            </div>
            <div className="text-xs">
              <div className="font-medium text-gray-900">{otherParticipant.name}</div>
              {otherParticipant.email && (
                <div className="text-gray-500 mt-0.5 truncate">{otherParticipant.email}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

