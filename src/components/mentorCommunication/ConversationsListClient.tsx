"use client";

import { useState } from "react";
import Link from "next/link";
import StartConversationModal from "./StartConversationModal";

interface ConversationWithParticipant {
  id: string;
  mentorId: string;
  menteeId: string;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  updatedAt: Date;
  createdAt: Date;
  otherParticipant: {
    id: string;
    name: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

interface ConversationsListClientProps {
  conversations: ConversationWithParticipant[];
  userRole: "mentee" | "mentor" | "admin";
}

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

export default function ConversationsListClient({
  conversations,
  userRole,
}: ConversationsListClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (conversations.length === 0) {
    return (
      <>
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-gray-600 mb-4">
            No conversations yet. Start a mentorship session with your assigned {userRole === "mentor" ? "mentee" : "mentor"}.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-block rounded-lg bg-[#734C23] px-6 py-2 text-white hover:bg-[#9C6A45] transition-colors font-medium"
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
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-[#734C23] px-4 py-2 text-white hover:bg-[#9C6A45] transition-colors text-sm font-medium"
        >
          Start New Conversation
        </button>
      </div>

      <div className="space-y-4">
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/mentor-communication/${conv.id}`}
            className="block rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {conv.otherParticipant?.fullName || conv.otherParticipant?.name || "Unknown User"}
                  </h3>
                  {conv.otherParticipant?.role && (
                    <RoleBadge role={conv.otherParticipant.role} />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {conv.otherParticipant?.email || ""}
                </p>
                {conv.lastMessagePreview && (
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {conv.lastMessagePreview}
                  </p>
                )}
              </div>
              <div className="ml-4 flex flex-col items-end gap-2">
                {conv.lastMessageAt && (
                  <p className="text-xs text-gray-500">
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

