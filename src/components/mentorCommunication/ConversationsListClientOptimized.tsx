"use client";

import { useState } from "react";
import Link from "next/link";
import { useConversations, Conversation } from "@/hooks/useConversations";
import StartConversationModal from "./StartConversationModal";
import { useAuth } from "@/contexts/AuthContext";

function RoleBadge({ role }: { role: string }) {
  const badgeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    mentee: { label: "MENTEE", color: "text-green-800", bgColor: "bg-green-100 border-green-300" },
    mentor: { label: "MENTOR", color: "text-[#734C23]", bgColor: "bg-[#F4E2D4] border-[#CAAE92]" },
    admin: { label: "ADMIN", color: "text-red-800", bgColor: "bg-red-100 border-red-300" },
  };

  const config = badgeConfig[role] || {
    label: role.toUpperCase(),
    color: "text-gray-800",
    bgColor: "bg-gray-100 border-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.bgColor} ${config.color}`}
    >
      {config.label}
    </span>
  );
}

function ConversationsSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-white p-4 sm:p-5 md:p-6 shadow-sm animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-3 sm:mb-4"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      ))}
    </div>
  );
}

export default function ConversationsListClientOptimized() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: conversations, isLoading, error } = useConversations();
  const { user } = useAuth();
  const userRole = (user?.role as "mentee" | "mentor" | "admin") || "mentee";

  if (isLoading) {
    return <ConversationsSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-6 sm:p-8 md:p-12 text-center">
        <p className="text-sm sm:text-base text-red-600 mb-3 sm:mb-4">Failed to load conversations. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-block rounded-lg bg-[#734C23] px-4 sm:px-6 py-2 text-sm sm:text-base text-white hover:bg-[#9C6A45] min-h-[44px] sm:min-h-0"
          style={{ touchAction: 'manipulation' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <>
        <div className="rounded-lg border bg-white p-6 sm:p-8 md:p-12 text-center">
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4">
            No conversations yet. Start a mentorship session with your assigned {userRole === "mentor" ? "mentee" : "mentor"}.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-block rounded-lg bg-[#734C23] px-4 sm:px-6 py-2.5 text-sm sm:text-base text-white hover:bg-[#9C6A45] transition-colors font-medium min-h-[44px] sm:min-h-0"
            style={{ touchAction: 'manipulation' }}
          >
            Start Conversation
          </button>
        </div>
        <StartConversationModal
          userRole={userRole}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-3 sm:mb-4 flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-[#734C23] px-3 sm:px-4 py-2 text-xs sm:text-sm text-white hover:bg-[#9C6A45] transition-colors font-medium min-h-[44px] sm:min-h-[36px]"
          style={{ touchAction: 'manipulation' }}
        >
          Start New Conversation
        </button>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/mentor-communication/${conv.id}`}
            className="block rounded-lg border bg-white p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 truncate">
                    {conv.otherParticipant?.fullName || conv.otherParticipant?.name || "Unknown User"}
                  </h3>
                  {conv.otherParticipant?.role && (
                    <RoleBadge role={conv.otherParticipant.role} />
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {conv.otherParticipant?.email || ""}
                </p>
                {conv.lastMessagePreview && (
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-500 line-clamp-2">
                    {conv.lastMessagePreview}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 ml-2 flex flex-col items-end gap-2">
                {conv.lastMessageAt && (
                  <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">
                    {new Date(conv.lastMessageAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <StartConversationModal
        userRole={userRole}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}



