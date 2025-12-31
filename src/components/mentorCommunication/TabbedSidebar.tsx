"use client";

import { useState, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, User, AlertCircle } from "lucide-react";
import TabButton from "./TabButton";

// Lazy load all right panel components for better performance
const ProgressDashboard = lazy(() => import("./ProgressDashboard"));
const ResumeSharePanel = lazy(() => import("./ResumeSharePanel"));
const InterviewPrepPanel = lazy(() => import("./InterviewPrepPanel"));
const FeedbackPanel = lazy(() => import("./FeedbackPanel"));
const InsightsPanel = lazy(() => import("@/components/insights/InsightsPanel"));
const SkillGapScorecard = lazy(() => import("@/components/skills/SkillGapScorecard"));
const RemindersPanel = lazy(() => import("@/components/reminders/RemindersPanel"));
const MentorTasksSection = lazy(() => import("@/components/mentor/TasksSection"));
const MenteeTasksSection = lazy(() => import("@/components/mentee/TasksSection"));

// Loading skeleton for lazy-loaded panels
const PanelSkeleton = () => (
  <div className="px-3 pt-2 pb-3">
    <div className="rounded-lg border bg-white p-3 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-2 bg-gray-200 rounded w-full"></div>
      <div className="h-2 bg-gray-200 rounded w-5/6"></div>
      <div className="h-2 bg-gray-200 rounded w-4/6"></div>
    </div>
  </div>
);

interface TabbedSidebarProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
  sessionType?: "RESUME_REVIEW" | "INTERVIEW";
  otherParticipant?: {
    id: string;
    name: string;
    fullName?: string;
    email?: string;
    role: "mentee" | "mentor" | "admin";
  } | null;
}

interface Reminder {
  id: string;
  type: "follow-up" | "interview" | "thank-you";
  dueAt: string;
  status: "pending" | "triggered" | "cancelled";
}

type TabType = "progress" | "resumes" | "feedback" | "tasks" | "insights" | "skills" | "reminders";

function TabbedSidebar({
  conversationId,
  userRole,
  sessionType = "RESUME_REVIEW",
  otherParticipant,
}: TabbedSidebarProps) {
  const queryClient = useQueryClient();
  // Store activeTab in local state only - no URL navigation
  const [activeTab, setActiveTab] = useState<TabType>("progress");

  // Fetch upcoming reminders with optimized caching
  const { data: remindersData } = useQuery<{ reminders: Reminder[] }>({
    queryKey: ["reminders", conversationId, "upcoming"],
    queryFn: async () => {
      const res = await fetch(`/api/reminders?conversationId=${conversationId}`, {
        credentials: "include",
      });
      if (!res.ok) return { reminders: [] };
      return res.json();
    },
    staleTime: 30_000, // Data is fresh for 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Memoize date formatting to avoid recalculation
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Soon";
    if (diffHours < 24) return `In ${diffHours}h`;
    if (diffDays < 7) return `In ${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  // Memoize tab change handler - NO URL navigation, only local state update
  const handleTabChange = useCallback((tab: TabType) => {
    // Update state immediately for instant UI feedback
    setActiveTab(tab);
    
    // Prefetch data for likely next tabs in background
    if (tab === "progress") {
      // Prefetch resumes and feedback when on progress tab
      queryClient.prefetchQuery({
        queryKey: ["resumes", conversationId],
        queryFn: async () => {
          const res = await fetch(`/api/mentor-communication/conversations/${conversationId}/resumes`, {
            credentials: "include",
          });
          if (!res.ok) return { resumes: [] };
          return res.json();
        },
        staleTime: 60_000,
      });
      queryClient.prefetchQuery({
        queryKey: ["feedback", conversationId],
        queryFn: async () => {
          const res = await fetch(`/api/mentor-communication/conversations/${conversationId}/feedback`, {
            credentials: "include",
          });
          if (!res.ok) return { feedbacks: [] };
          return res.json();
        },
        staleTime: 60_000,
      });
    }
    // NO router.replace() - this prevents navigation/re-render of chat
  }, [conversationId, queryClient]);

  // Memoize tabs array to prevent recreation
  // Top grid buttons in exact order: Row 1: Progress, Feedback, Skills Gap | Row 2: Resumes, Insights, Reminders
  const topGridTabs: { id: TabType; label: string }[] = useMemo(() => [
    { id: "progress", label: "Progress" },
    { id: "feedback", label: "Feedback" },
    { id: "skills", label: "Skills Gap" },
    { id: "resumes", label: "Resumes" },
    { id: "insights", label: "Insights" },
    { id: "reminders", label: "Reminders" },
  ], []);
  
  // Right button (Task)
  const taskTab = useMemo(() => ({ id: "tasks" as TabType, label: "Task" }), []);
  
  // Memoize upcoming reminders to avoid recalculation
  const upcomingReminders = useMemo(() => {
    return remindersData?.reminders
      ?.filter((r) => r.status === "pending" && new Date(r.dueAt) > new Date())
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 3) || [];
  }, [remindersData?.reminders]);

  return (
    <div className="flex flex-col h-full md:rounded-lg border border-gray-200 bg-white md:shadow-sm min-w-0 overflow-hidden">
      {/* Tab Header - Toolbar with CSS Grid for top buttons and Task below */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-2 py-2">
        <div className="flex flex-col gap-1">
          {/* TOP GRID: 6 buttons in 3 columns, 2 rows - matching image order */}
          <div 
            className="grid gap-1"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(2, auto)'
            }}
          >
            {topGridTabs.map((tab) => (
              <TabButton
                key={tab.id}
                label={tab.label}
                isActive={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="!h-[32px] md:!h-[32px] !min-h-[44px] md:!min-h-0 !w-full !text-xs !px-2"
              />
            ))}
          </div>
          
          {/* TASK BUTTON: Below grid, spans full width */}
          <TabButton
            key={taskTab.id}
            label={taskTab.label}
            isActive={activeTab === taskTab.id}
            onClick={() => handleTabChange(taskTab.id)}
            className="!h-[32px] md:!h-[32px] !min-h-[44px] md:!min-h-0 !w-full !text-xs !px-2 mt-1"
          />
        </div>
      </div>

      {/* Tab Content - Fills remaining space with scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto min-w-0">
        {/* Tab content with smooth transition */}
        <div 
          key={activeTab}
          className="animate-in"
        >
          {activeTab === "progress" && (
            <div className="px-3 pt-2 pb-3">
              {/* Right Panel - Single vertical container */}
              <div className="rightPanel flex flex-col gap-3">
                  {/* Primary Section - Progress Summary */}
                  <div className="rightPanelPrimary w-full flex-shrink-0">
                    <Suspense fallback={
                      <div className="rounded-lg border bg-white p-3 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
                        <div className="h-2 bg-gray-200 rounded w-24 mb-2"></div>
                        <div className="h-1.5 bg-gray-200 rounded w-full"></div>
                      </div>
                    }>
                      <ProgressDashboard conversationId={conversationId} userRole={userRole} />
                    </Suspense>
                  </div>
              
              {/* Secondary Section - Upcoming, Mentor cards */}
              <div className="rightPanelSecondary flex flex-col gap-3 w-full">
                {/* Upcoming Reminders */}
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-2.5 w-full">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Upcoming</h3>
                  </div>
                  {upcomingReminders.length === 0 ? (
                    <p className="text-xs text-gray-500">No upcoming reminders</p>
                  ) : (
                    <div className="space-y-1.5">
                      {upcomingReminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className="text-xs p-1.5 rounded bg-gray-50 border border-gray-100"
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
                    <button
                      type="button"
                      onClick={() => handleTabChange("reminders")}
                      className="block mt-1.5 text-xs text-[#734C23] hover:text-[#9C6A45] font-medium text-left"
                    >
                      View all →
                    </button>
                  )}
                </div>

                {/* Mentee/Mentor Summary Card */}
                {otherParticipant && (
                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-2.5 w-full">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-gray-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        {userRole === "mentor" ? "Mentee" : "Mentor"}
                      </h3>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-normal text-gray-900">{otherParticipant.name}</div>
                      {otherParticipant.email && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{otherParticipant.email}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
          {activeTab === "resumes" && (
            <Suspense fallback={<PanelSkeleton />}>
              <div className="px-3 pt-2 pb-3">
                {sessionType === "INTERVIEW" ? (
                  <InterviewPrepPanel conversationId={conversationId} userRole={userRole} />
                ) : (
                  <ResumeSharePanel conversationId={conversationId} userRole={userRole} />
                )}
              </div>
            </Suspense>
          )}
          {activeTab === "feedback" && (
            <Suspense fallback={<PanelSkeleton />}>
              <div className="px-3 pt-2 pb-3">
                <FeedbackPanel
                  conversationId={conversationId}
                  userRole={userRole}
                />
              </div>
            </Suspense>
          )}
          {activeTab === "tasks" && (
            <Suspense fallback={<PanelSkeleton />}>
              <div className="px-3 pt-2 pb-3">
                {userRole === "mentor" ? (
                  <MentorTasksSection menteeEmail={otherParticipant?.email} />
                ) : (
                  <MenteeTasksSection />
                )}
              </div>
            </Suspense>
          )}
          {activeTab === "insights" && (
            <Suspense fallback={<PanelSkeleton />}>
              <div className="px-3 pt-2 pb-3">
                <InsightsPanel conversationId={conversationId} userRole={userRole} />
              </div>
            </Suspense>
          )}
          {activeTab === "skills" && (
            <Suspense fallback={<PanelSkeleton />}>
              <div className="px-3 pt-2 pb-3">
                <SkillGapScorecard conversationId={conversationId} />
              </div>
            </Suspense>
          )}
          {activeTab === "reminders" && (
            <Suspense fallback={<PanelSkeleton />}>
              <div className="px-3 pt-2 pb-3">
                <RemindersPanel conversationId={conversationId} />
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TabbedSidebar);

