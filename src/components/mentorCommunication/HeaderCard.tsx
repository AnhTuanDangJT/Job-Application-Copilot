"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Participant {
  id: string;
  name: string;
  fullName?: string;
  email?: string;
  role: "mentee" | "mentor" | "admin";
}

interface HeaderCardProps {
  participant?: Participant | null;
  conversationId?: string;
  conversationStatus?: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ENDED";
  userRole?: "mentee" | "mentor" | "admin";
  onOpenRightPanel?: () => void;
}

interface PresenceStatus {
  online: boolean;
  lastSeenAt: string | null;
}

function RoleBadge({ role, mobile = false }: { role: string; mobile?: boolean }) {
  const badgeConfig: Record<string, { label: string; mobileLabel: string; color: string; bgColor: string; mobileColor: string }> = {
    mentee: { 
      label: "🟩 MENTEE", 
      mobileLabel: "Mentee",
      color: "text-green-800", 
      bgColor: "bg-green-100 border-green-300",
      mobileColor: "text-green-700"
    },
    mentor: { 
      label: "🟦 MENTOR", 
      mobileLabel: "Mentor",
      color: "text-[#734C23]", 
      bgColor: "bg-[#F4E2D4] border-[#CAAE92]",
      mobileColor: "text-[#734C23]"
    },
    admin: { 
      label: "🟥 ADMIN", 
      mobileLabel: "Admin",
      color: "text-red-800", 
      bgColor: "bg-red-100 border-red-300",
      mobileColor: "text-red-700"
    },
  };

  const config = badgeConfig[role] || {
    label: role.toUpperCase(),
    mobileLabel: role.charAt(0).toUpperCase() + role.slice(1),
    color: "text-gray-800",
    bgColor: "bg-gray-100 border-gray-300",
    mobileColor: "text-gray-700",
  };

  if (mobile) {
    // Mobile: Simple text pill
    return (
      <span className={`text-xs font-medium ${config.mobileColor}`}>
        {config.mobileLabel}
      </span>
    );
  }

  // Desktop: Full badge with border
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${config.bgColor} ${config.color}`}
    >
      {config.label}
    </span>
  );
}

export default function HeaderCard({ participant, conversationId, conversationStatus = "ACTIVE", userRole, onOpenRightPanel }: HeaderCardProps) {
  const router = useRouter();
  const [presence, setPresence] = useState<PresenceStatus | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    router.push("/auth/login");
    router.refresh();
  };

  // Handle ESC key for confirmation modal
  useEffect(() => {
    if (!showConfirm) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowConfirm(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showConfirm]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showConfirm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showConfirm]);

  // Send heartbeat to keep current user's presence updated
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/presence/heartbeat", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        // Silently fail - presence is non-critical
      }
    };

    // Send initial heartbeat
    sendHeartbeat();
    // Send heartbeat every 20 seconds to keep user online
    const heartbeatInterval = setInterval(sendHeartbeat, 20000);

    return () => clearInterval(heartbeatInterval);
  }, []);

  // Fetch presence status with real-time updates
  useEffect(() => {
    if (!participant) return;

    const fetchPresence = async () => {
      try {
        const url = `/api/presence/status?userId=${participant.id}`;
        const response = await fetch(url, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setPresence(data);
        }
      } catch (error) {
        console.error("Failed to fetch presence:", error);
      }
    };

    fetchPresence();
    // Update presence every 3 seconds for real-time feel
    const interval = setInterval(fetchPresence, 3000);

    return () => clearInterval(interval);
  }, [participant?.id]);

  const formatLastSeen = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return "Never";
    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return lastSeen.toLocaleDateString();
  };

  const handleEndMentorship = async () => {
    if (!conversationId) return;
    setIsEnding(true);
    try {
      const response = await fetch(`/api/mentorship/${conversationId}/end`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        // Reload page to reflect ended status
        window.location.reload();
      } else {
        const error = await response.json().catch(() => ({ message: "Failed to end mentorship" }));
        alert(error.message || "Failed to end mentorship");
        setIsEnding(false);
      }
    } catch (error) {
      console.error("Error ending mentorship:", error);
      alert("Failed to end mentorship. Please try again.");
      setIsEnding(false);
    }
  };

  const handleBack = () => {
    router.push("/mentor-communication");
  };

  return (
    <>
      {participant ? (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 py-1 md:py-0">
          {/* Mobile: 3-section layout - Left: Back + Avatar, Center: Name, Right: Tools + End */}
          <div className="flex md:hidden items-center justify-between gap-2 w-full">
            {/* Left Section: Back Button + Avatar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] active:bg-[#CAAE92] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Back to conversations"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#734C23] to-[#9C6A45] flex items-center justify-center text-white font-semibold text-xs shadow-sm flex-shrink-0">
                {(participant.fullName || participant.name || "U")[0].toUpperCase()}
              </div>
            </div>

            {/* Center Section: Name + Online Status */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-center px-2">
              <h1 className="text-sm font-semibold text-gray-900 truncate">
                {participant.fullName || participant.name || "Unknown User"}
              </h1>
              {presence && (
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    presence.online ? "bg-green-500" : "bg-gray-400"
                  }`}
                  title={
                    presence.online
                      ? "Online"
                      : `Last seen: ${formatLastSeen(presence.lastSeenAt)}`
                  }
                />
              )}
            </div>

            {/* Right Section: Tools Button + End Button + Logout */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Tools Button */}
              {onOpenRightPanel && (
                <button
                  onClick={onOpenRightPanel}
                  className="px-3 py-1.5 text-xs font-medium text-[#734C23] bg-[#F4E2D4] rounded-lg hover:bg-[#CAAE92] transition-colors min-h-[36px] flex items-center justify-center gap-1.5"
                  aria-label="Open Tools"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>Tools</span>
                </button>
              )}
              {conversationStatus === "ACTIVE" && conversationId && (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={isEnding}
                  className="px-3 py-1.5 text-xs font-medium text-[#734C23] bg-[#F4E2D4] rounded-lg hover:bg-[#CAAE92] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                >
                  End
                </button>
              )}
              {/* Logout Button - Only on mobile (Navbar shows on desktop) */}
              <button
                onClick={handleLogout}
                className="lg:hidden px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors min-h-[36px]"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Desktop: Full layout */}
          <div className="hidden md:flex md:items-center md:gap-3 md:flex-1 md:min-w-0">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#734C23] to-[#9C6A45] flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0">
              {(participant.fullName || participant.name || "U")[0].toUpperCase()}
            </div>
            
            {/* Name, Email, Online Status */}
            <div className="flex flex-col gap-0 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-gray-900">
                  {participant.fullName || participant.name || "Unknown User"}
                </h1>
                {presence && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        presence.online ? "bg-green-500" : "bg-gray-400"
                      }`}
                      title={
                        presence.online
                          ? "Online"
                          : `Last seen: ${formatLastSeen(presence.lastSeenAt)}`
                      }
                    />
                    <span className="text-xs text-gray-500">
                      {presence.online 
                        ? "Online" 
                        : presence.lastSeenAt 
                          ? `Last seen ${formatLastSeen(presence.lastSeenAt)}`
                          : "Offline"}
                    </span>
                  </div>
                )}
              </div>
              {participant.email && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {participant.email}
                </div>
              )}
            </div>
          </div>
          
          {/* Desktop: Right Section - Role button and End Mentorship */}
          <div className="hidden md:flex md:items-center md:gap-2 md:flex-shrink-0">
            {/* MENTEE button - green */}
            {participant.role === "mentee" && (
              <button
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                MENTEE
              </button>
            )}
            {/* MENTOR button - brown/tan */}
            {participant.role === "mentor" && (
              <button
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#9C6A45] rounded-lg hover:bg-[#734C23] transition-colors"
              >
                MENTOR
              </button>
            )}
            {conversationStatus === "ACTIVE" && conversationId && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isEnding}
                className="px-3 py-1.5 text-xs font-medium text-[#734C23] bg-[#F4E2D4] rounded-lg hover:bg-[#CAAE92] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                End Mentorship
              </button>
            )}
            {/* Logout Button - Only on mobile (Navbar shows on desktop) */}
            <button
              onClick={handleLogout}
              className="lg:hidden px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 md:gap-3 min-h-[56px] md:min-h-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-xs md:text-sm flex-shrink-0">
            ?
          </div>
          <div className="flex flex-col md:flex-col">
            <h1 className="text-sm md:text-lg font-semibold text-gray-900">Loading conversation...</h1>
            <div className="hidden md:block text-xs text-gray-500 mt-0.5">Please wait</div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-sm w-full animate-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#734C23]">
                End Mentorship?
              </h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                aria-label="Close"
                disabled={isEnding}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mb-6">
              This will complete the current mentorship term with {participant?.name || "this user"}. You can start a new mentorship term with them anytime. Chat history and progress data will be preserved.
            </p>
            <div className="flex gap-3 justify-between items-center pt-4 border-t border-[#CAAE92]/30">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isEnding}
                className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEndMentorship}
                disabled={isEnding}
                className="px-6 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-red-400/40 focus:ring-offset-2"
              >
                {isEnding ? "Ending..." : "End Mentorship"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

