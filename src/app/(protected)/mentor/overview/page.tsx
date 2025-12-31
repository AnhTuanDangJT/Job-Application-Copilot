"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { useMultipleRealtimeUpdates } from "@/hooks/useMultipleRealtimeUpdates";
import { Users, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Lazy load heavy mentor components - only load when needed
const MenteeCard = lazy(() => import("@/components/mentor/MenteeCard"));
const RecentActivityFeed = lazy(() => import("@/components/mentor/RecentActivityFeed"));
const AttentionRequired = lazy(() => import("@/components/mentor/AttentionRequired"));
const GroupsSection = lazy(() => import("@/components/mentor/GroupsSection"));
const TasksSection = lazy(() => import("@/components/mentor/TasksSection"));

interface RecentApplication {
  id: string;
  company: string;
  role: string;
  status: string;
  lastUpdated: string;
  tags: Array<{ id: string; label: string; color: string }>;
}

interface Mentee {
  conversationId: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  targetRole: string;
  targetLocations: string[];
  season: string;
  currentPhase: string;
  menteeTags: string[];
  notes: string;
  applicationsCount: number;
  interviewsCount: number;
  offersCount: number;
  rejectedCount: number;
  followUpsDueCount: number;
  recentApplications: RecentApplication[];
  lastUpdated: string;
}

interface ActivityEvent {
  id: string;
  type: "application" | "suggestion" | "reminder" | "activityLog" | "message";
  conversationId: string;
  menteeName: string;
  message: string;
  timestamp: string;
  metadata?: any;
}

function MenteeCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/20 animate-pulse">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-[#CAAE92]/30 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-[#CAAE92]/30 rounded w-1/3"></div>
              <div className="h-4 bg-[#CAAE92]/30 rounded w-2/3"></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-5 pb-5 border-b border-[#CAAE92]/30">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="text-center">
                <div className="h-6 bg-[#CAAE92]/30 rounded w-8 mx-auto mb-2"></div>
                <div className="h-3 bg-[#CAAE92]/30 rounded w-16 mx-auto"></div>
              </div>
            ))}
          </div>
          <div className="space-y-2.5 mb-5">
            <div className="h-4 bg-[#CAAE92]/30 rounded w-3/4"></div>
            <div className="h-4 bg-[#CAAE92]/30 rounded w-1/2"></div>
            <div className="h-4 bg-[#CAAE92]/30 rounded w-2/3"></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-[#CAAE92]/30">
            <div className="flex-1 h-10 bg-[#CAAE92]/30 rounded-lg"></div>
            <div className="flex-1 h-10 bg-[#CAAE92]/30 rounded-lg"></div>
            <div className="w-10 h-10 bg-[#CAAE92]/30 rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30 animate-pulse">
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg bg-white border border-[#CAAE92]/20">
            <div className="w-5 h-5 bg-[#CAAE92]/30 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[#CAAE92]/30 rounded"></div>
              <div className="h-3 bg-[#CAAE92]/30 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SimpleMenteeCardProps {
  conversationId: string;
  menteeName: string;
  menteeEmail: string;
  onEndMentorship: () => Promise<void>;
}

function SimpleMenteeCard({ conversationId, menteeName, menteeEmail, onEndMentorship }: SimpleMenteeCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleEndClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmEnd = async () => {
    setIsEnding(true);
    try {
      await onEndMentorship();
      setShowConfirm(false);
    } catch (error) {
      console.error("Error ending mentorship:", error);
    } finally {
      setIsEnding(false);
    }
  };

  const handleCancelEnd = () => {
    setShowConfirm(false);
  };

  // Handle ESC key for confirmation modal
  useEffect(() => {
    if (!showConfirm) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCancelEnd();
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

  return (
    <>
      <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/20 hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#1F2937] mb-1">{menteeName}</h3>
            <p className="text-sm text-[#6B7280]">{menteeEmail}</p>
          </div>
          <span className="px-2 py-1 rounded-lg bg-[#D1FAE5] text-[#16A34A] text-xs font-medium">
            Active
          </span>
        </div>
        
        <div className="flex gap-2 pt-4 border-t border-[#CAAE92]/30">
          <Link
            href={`/mentor-communication/${conversationId}`}
            className="flex-1 px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors text-center"
          >
            Open Chat
          </Link>
          <button
            onClick={handleEndClick}
            disabled={isEnding}
            className="px-4 py-2 rounded-lg bg-[#F4E2D4] text-[#734C23] text-sm font-medium hover:bg-[#CAAE92] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnding ? "Ending..." : "End Mentorship"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-sm w-full animate-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#734C23]">End Mentorship?</h3>
              <button
                onClick={handleCancelEnd}
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
              This will complete the current mentorship term with {menteeName}. You can start a new mentorship term with them anytime. Chat history and progress data will be preserved.
            </p>
            <div className="flex gap-3 justify-between items-center pt-4 border-t border-[#CAAE92]/30">
              <button
                onClick={handleCancelEnd}
                disabled={isEnding}
                className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnd}
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

export default function MentorOverviewPage() {
  const router = useRouter();
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMentees = async () => {
    try {
      const response = await fetch("/api/mentor/mentees");
      if (!response.ok) {
        throw new Error("Failed to fetch mentees");
      }
      const data = await response.json();
      setMentees(data.mentees || []);
    } catch (err) {
      console.error("Error fetching mentees:", err);
      setError(err instanceof Error ? err.message : "Failed to load mentees");
    }
  };

  const fetchActivity = async () => {
    try {
      const response = await fetch("/api/mentor/activity?limit=50");
      if (!response.ok) {
        throw new Error("Failed to fetch activity");
      }
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error("Error fetching activity:", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMentees(), fetchActivity()]);
      setLoading(false);
    };

    loadData();

    // Poll for updates every 30 seconds (fallback)
    const interval = setInterval(() => {
      fetchMentees();
      fetchActivity();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Set up real-time listeners for all mentee conversations
  const conversationIds = mentees.map((m) => m.conversationId);

  useMultipleRealtimeUpdates({
    conversationIds,
    enabled: conversationIds.length > 0,
    onEvent: (event) => {
      // When application is created or updated, refetch mentees to update stats
      if (event.type === "application.created" || event.type === "application.updated") {
        // Refetch mentees to get updated stats (stats are derived from ApplicationRow)
        fetchMentees();
      }
    },
  });

  const handleUpdateMentee = async (conversationId: string, updates: Partial<Mentee>) => {
    try {
      const response = await fetch(`/api/mentor/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Update failed" }));
        console.error("Mentor update failed:", err);
        throw new Error(err.message ?? "Failed to update mentee");
      }

      // Refresh mentees list
      await fetchMentees();
    } catch (err) {
      console.error("Error updating mentee:", err);
      throw err;
    }
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[#1F2937]">Mentor Dashboard</h1>
            <span className="px-2.5 py-1 rounded-lg bg-[#F4E2D4] text-[#734C23] text-xs font-medium">
              Mentor
            </span>
          </div>
          <p className="text-[#6B7280]">
            View and manage your mentees' progress and applications.
          </p>
        </div>
        <MenteeCardsSkeleton />
        <ActivitySkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[#1F2937]">Mentor Dashboard</h1>
            <span className="px-2.5 py-1 rounded-lg bg-[#F4E2D4] text-[#734C23] text-xs font-medium">
              Mentor
            </span>
          </div>
          <p className="text-[#6B7280]">
            View and manage your mentees' progress and applications.
          </p>
        </div>
        <div className="rounded-2xl border border-[#DC2626]/30 bg-[#DC2626]/10 p-4">
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      </section>
    );
  }

  // Calculate attention required items
  const attentionItems = mentees.filter(
    (m) => m.followUpsDueCount > 0 || m.interviewsCount > 0
  ).map((m) => ({
    conversationId: m.conversationId,
    menteeName: m.menteeName,
    menteeEmail: m.menteeEmail,
    followUpsDueCount: m.followUpsDueCount,
    interviewsCount: m.interviewsCount,
  }));

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-[#1F2937]">Dashboard</h1>
          <span className="px-2.5 py-1 rounded-lg bg-[#F4E2D4] text-[#734C23] text-xs font-medium">
            Mentor
          </span>
        </div>
        <p className="text-[#6B7280]">
          View and manage your mentees' progress and applications.
        </p>
      </div>

      {mentees.length === 0 ? (
        <div className="rounded-xl bg-[#F8F5F2] p-12 text-center shadow-sm">
          <p className="text-[#6B7280] mb-4">No mentees yet.</p>
          <p className="text-sm text-[#6B7280]">
            Mentees can start conversations with you from the Communication page.
          </p>
        </div>
      ) : (
        <>
          {/* SECTION 1: My Mentees */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
              <h2 className="text-xl font-semibold text-[#1F2937]">My Mentees</h2>
            </div>
            <Suspense fallback={<MenteeCardsSkeleton />}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mentees.map((mentee) => (
                  <SimpleMenteeCard
                    key={mentee.conversationId}
                    conversationId={mentee.conversationId}
                    menteeName={mentee.menteeName}
                    menteeEmail={mentee.menteeEmail}
                    onEndMentorship={async () => {
                      try {
                        const response = await fetch(`/api/mentorship/${mentee.conversationId}/end`, {
                          method: "POST",
                          credentials: "include",
                        });
                        if (response.ok) {
                          await fetchMentees();
                        } else {
                          const error = await response.json().catch(() => ({ message: "Failed to end mentorship" }));
                          alert(error.message || "Failed to end mentorship");
                        }
                      } catch (error) {
                        console.error("Error ending mentorship:", error);
                        alert("Failed to end mentorship. Please try again.");
                      }
                    }}
                  />
                ))}
              </div>
            </Suspense>
          </div>

          {/* SECTION 2: Groups */}
          <div className="space-y-4">
            <Suspense fallback={<div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm animate-pulse h-32"></div>}>
              <GroupsSection
                onGroupClick={(groupId) => {
                  router.push(`/mentor/groups/${groupId}`);
                }}
              />
            </Suspense>
          </div>

          {/* SECTION 3: Attention Required */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
              <h2 className="text-xl font-semibold text-[#1F2937]">Attention Required</h2>
            </div>
            <Suspense fallback={<div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm animate-pulse h-32"></div>}>
              <AttentionRequired items={attentionItems} />
            </Suspense>
          </div>

          {/* SECTION 4: Tasks */}
          <div className="space-y-4">
            <Suspense fallback={<div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm animate-pulse h-32"></div>}>
              <TasksSection />
            </Suspense>
          </div>

          {/* SECTION 5: Recent Activity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
              <h2 className="text-xl font-semibold text-[#1F2937]">Recent Activity</h2>
            </div>
            <Suspense fallback={<ActivitySkeleton />}>
              <RecentActivityFeed activities={activities} />
            </Suspense>
          </div>
        </>
      )}
    </section>
  );
}
