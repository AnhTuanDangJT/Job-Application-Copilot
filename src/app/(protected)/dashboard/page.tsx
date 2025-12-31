"use client";

import Link from "next/link";
import { lazy, Suspense, memo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardStatsClient from "./DashboardStatsClient";
import UploadSection from "./UploadSection";
import UserDescriptionCard from "@/components/UserDescriptionCard";
import { Plus, FileText, MessageSquare, List } from "lucide-react";

// Lazy load TasksSection for mentees
const TasksSection = lazy(() => import("@/components/mentee/TasksSection"));
// Lazy load Progress Dashboard (non-critical panel)
const ProgressDashboard = lazy(() => import("@/components/mentorCommunication/ProgressDashboard"));

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Runtime guard: Mentor accounts must NEVER be admin
  if (user?.role === "mentor" && user?.isAdmin) {
    console.error("[Dashboard] INVALID STATE: Mentor cannot be admin. Email:", user.email);
  }
  
  const userRole = user?.role;
  const isMentor = userRole === "mentor";
  
  // Dashboard rendering logic:
  // - If isAdmin: render admin dashboard (separate from mentor)
  // - Else if mentor: render mentor dashboard
  // - Else: render mentee dashboard
  const isAdmin = user?.isAdmin || false;
  
  return (
    <section className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#1F2937]">Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-[#6B7280]">
            Welcome back! Manage your job applications and track your progress.
          </p>
        </div>
      </div>

      {/* User Description Card */}
      <UserDescriptionCard />

      {isAdmin ? (
        /* Admin Dashboard - separate from mentor */
        <div className="space-y-3 sm:space-y-4">
          <div className="rounded-lg sm:rounded-xl bg-gradient-to-r from-[#DC2626] to-[#B91C1C] p-4 sm:p-6 text-white">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">System Administrator</h2>
            <p className="text-sm sm:text-base text-white/90">Manage users, mentors, mentees, and platform settings</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Link
              href="/dashboard/admin"
              className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 border border-[#CAAE92]/30 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#9C6A45]/50 transition-all duration-200 group w-full"
            >
              <div className="p-2 sm:p-3 rounded-lg bg-[#F4E2D4] group-hover:bg-[#CAAE92] transition-colors flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm sm:text-base md:text-lg text-[#1F2937]">User Management</div>
                <div className="text-xs sm:text-sm text-[#6B7280] mt-0.5 sm:mt-1">View all users, filter by role, delete users</div>
              </div>
            </Link>
          </div>
        </div>
      ) : !isMentor ? (
        <>
          {/* Section 1: Progress Overview */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 sm:w-5 sm:h-5 text-[#9C6A45]" strokeWidth={1.5} />
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#1F2937]">Progress Overview</h2>
            </div>
            <DashboardStatsClient />
          </div>

          {/* Section 2: Quick Actions - Full Width Primary Section */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-[#9C6A45]" strokeWidth={1.5} />
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#1F2937]">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Link
                href="/applications?action=add"
                className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 border border-[#CAAE92]/30 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#9C6A45]/50 transition-all duration-200 group w-full"
              >
                <div className="p-2 sm:p-3 rounded-lg bg-[#F4E2D4] group-hover:bg-[#CAAE92] transition-colors flex-shrink-0">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-base md:text-lg text-[#1F2937]">Add Application</div>
                  <div className="text-xs sm:text-sm text-[#6B7280] mt-0.5 sm:mt-1">Create a new job application</div>
                </div>
              </Link>

              <Link
                href="/applications"
                className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 border border-[#CAAE92]/30 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#9C6A45]/50 transition-all duration-200 group w-full"
              >
                <div className="p-2 sm:p-3 rounded-lg bg-[#F4E2D4] group-hover:bg-[#CAAE92] transition-colors flex-shrink-0">
                  <List className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-base md:text-lg text-[#1F2937]">Go to Applications Board</div>
                  <div className="text-xs sm:text-sm text-[#6B7280] mt-0.5 sm:mt-1">View and manage all applications</div>
                </div>
              </Link>

              <Link
                href="/mentor-communication"
                className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 border border-[#CAAE92]/30 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#9C6A45]/50 transition-all duration-200 group w-full"
              >
                <div className="p-2 sm:p-3 rounded-lg bg-[#F4E2D4] group-hover:bg-[#CAAE92] transition-colors flex-shrink-0">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-base md:text-lg text-[#1F2937]">Message Mentor</div>
                  <div className="text-xs sm:text-sm text-[#6B7280] mt-0.5 sm:mt-1">Communicate with your mentor</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Section 3: My Tasks */}
          <div className="space-y-3 sm:space-y-4">
            <Suspense fallback={<div className="rounded-lg sm:rounded-xl bg-[#F8F5F2] p-4 sm:p-6 shadow-sm animate-pulse h-24 sm:h-32"></div>}>
              <TasksSection />
            </Suspense>
          </div>

          {/* Section 4: Documents */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#9C6A45]" strokeWidth={1.5} />
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#1F2937]">Documents</h2>
            </div>
            <UploadSection />
          </div>
        </>
      ) : (
        /* Mentor Quick Actions */
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-[#9C6A45]" strokeWidth={1.5} />
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#1F2937]">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Link
              href="/mentor/overview"
              className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 border border-[#CAAE92]/30 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#9C6A45]/50 transition-all duration-200 group w-full"
            >
              <div className="p-2 sm:p-3 rounded-lg bg-[#F4E2D4] group-hover:bg-[#CAAE92] transition-colors flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm sm:text-base md:text-lg text-[#1F2937]">Mentor Overview</div>
                <div className="text-xs sm:text-sm text-[#6B7280] mt-0.5 sm:mt-1">View all mentees and progress</div>
              </div>
            </Link>

            <Link
              href="/mentor-communication"
              className="flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 border border-[#CAAE92]/30 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#9C6A45]/50 transition-all duration-200 group w-full"
            >
              <div className="p-2 sm:p-3 rounded-lg bg-[#F4E2D4] group-hover:bg-[#CAAE92] transition-colors flex-shrink-0">
                <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm sm:text-base md:text-lg text-[#1F2937]">Communication</div>
                <div className="text-xs sm:text-sm text-[#6B7280] mt-0.5 sm:mt-1">Open conversations with mentees</div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
