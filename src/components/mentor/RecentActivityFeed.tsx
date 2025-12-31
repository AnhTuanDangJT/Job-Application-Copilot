"use client";

import Link from "next/link";

interface ActivityEvent {
  id: string;
  type: "application" | "suggestion" | "reminder" | "activityLog" | "message";
  conversationId: string;
  menteeName: string;
  message: string;
  timestamp: string | Date;
  metadata?: any;
}

interface RecentActivityFeedProps {
  activities: ActivityEvent[];
}

export default function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "application":
        return (
          <svg className="w-5 h-5 text-[#9C6A45]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "suggestion":
        return (
          <svg className="w-5 h-5 text-[#9C6A45]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case "reminder":
        return (
          <svg className="w-5 h-5 text-[#9C6A45]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "activityLog":
        return (
          <svg className="w-5 h-5 text-[#9C6A45]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case "message":
        return (
          <svg className="w-5 h-5 text-[#9C6A45]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-[#9C6A45]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (activities.length === 0) {
    return (
      <div className="rounded-xl bg-[#F8F5F2] p-8 text-center shadow-sm border border-[#CAAE92]/30">
        <p className="text-sm text-[#6B7280] font-medium">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30">
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {activities.map((activity) => (
          <Link
            key={activity.id}
            href={`/mentor-communication/${activity.conversationId}${activity.metadata?.applicationId ? `/applications` : ""}`}
            className="flex gap-3 p-3 rounded-lg bg-white hover:bg-[#F4E2D4]/50 border border-[#CAAE92]/20 hover:border-[#9C6A45]/30 transition-all duration-200"
          >
            <div className="flex-shrink-0 mt-0.5">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1F2937]">
                <span className="font-medium text-[#734C23]">{activity.menteeName}</span>: {activity.message}
              </p>
              {activity.metadata?.company && (
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {activity.metadata.company} - {activity.metadata.role}
                </p>
              )}
              <p className="text-xs text-[#9C6A45] mt-1">
                {formatTime(activity.timestamp)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

