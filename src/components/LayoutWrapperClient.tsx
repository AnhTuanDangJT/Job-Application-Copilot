"use client";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ConversationLayoutProvider, useConversationLayout } from "@/contexts/ConversationLayoutContext";
import { useState } from "react";
import QueryProvider from "@/providers/QueryProvider";

function RoleBadge({ role }: { role: "mentee" | "mentor" | "admin" }) {
  const badgeConfig = {
    mentee: { label: "MENTEE", color: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20" },
    mentor: { label: "MENTOR", color: "bg-[#9C6A45]/10 text-[#9C6A45] border-[#9C6A45]/20" },
    admin: { label: "ADMIN", color: "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20" },
  };

  const config = badgeConfig[role] || badgeConfig.mentee;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${config.color}`}
    >
      {config.label}
    </span>
  );
}

function RightPanelSlot() {
  const { rightPanel } = useConversationLayout();
  // CRITICAL: Always render the container to maintain 3-column layout structure on desktop
  // Right panel must ALWAYS be visible on desktop, regardless of conversation state
  return (
    <aside className="hidden lg:block w-[420px] flex-shrink-0 h-full overflow-y-auto border-l border-[#CAAE92]/30 bg-[#F8F5F2] px-3 py-3">
      {rightPanel || null}
    </aside>
  );
}

function LayoutWrapperClientInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // STRICT: Route-based detection ONLY - do not infer from conversation data
  // For mentors and mentees on /mentor-communication conversation routes, ALWAYS use 3-column layout
  const isMentorCommunicationRoute = pathname?.startsWith("/mentor-communication");
  const isConversationPage = pathname?.includes("/mentor-communication/") && pathname !== "/mentor-communication";
  
  // Determine if we should use 3-column layout: route-based AND role-based ONLY
  // Only calculate when user data is available (not in loading state)
  const userRole = (user?.role as "mentee" | "mentor" | "admin") || "mentee";
  // Show 3-column layout for both mentors AND mentees on conversation pages
  const shouldUseMentorLayout = !isLoading && isMentorCommunicationRoute && (userRole === "mentor" || userRole === "mentee") && isConversationPage;

  if (isLoading) {
    return (
      <div className="flex min-h-screen md:h-screen flex-col bg-[#F8F5F2] md:overflow-hidden">
        {/* Top header */}
        <div className={shouldUseMentorLayout ? "hidden lg:block flex-shrink-0" : "flex-shrink-0"}>
          <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        </div>
        {/* IMPORTANT: constrain height + allow inner scrolling */}
        <div className="flex-1 min-h-0 md:overflow-hidden">
          {shouldUseMentorLayout ? (
            <>
              {/* Mobile: Simplified layout */}
              <div className="lg:hidden">
                <div className="conversation-mobile-layout">
                  {children}
                </div>
              </div>
              {/* Desktop: 3-column layout */}
              <div className="hidden lg:block h-full">
                <div className="flex h-full min-h-0 justify-center">
                  {/* LEFT SIDEBAR - Fixed position with padding from edge, touches chat box */}
                  <div className="pl-4 flex-shrink-0">
                    <aside className="hidden lg:block w-[240px] h-full overflow-y-auto border-r border-[#CAAE92]/30 bg-[#F8F5F2] rounded-lg sidebar-no-scrollbar">
                      <Sidebar isMobileOpen={false} onMobileClose={() => {}} />
                    </aside>
                  </div>
                  {/* CENTER CHAT - Centered on screen */}
                  <main className="w-[750px] flex-shrink-0 h-full min-h-0 overflow-hidden">
                    {children}
                  </main>
                  <div className="w-[420px] flex-shrink-0 pr-4">
                    <aside className="hidden lg:block h-full overflow-y-auto border-l border-[#CAAE92]/30 bg-[#F8F5F2] px-3 py-3"></aside>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-0">
              <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
              <main className="p-4 md:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-6 w-32 bg-[#CAAE92]/30 rounded animate-pulse"></div>
                  <div className="h-5 w-16 bg-[#CAAE92]/30 rounded animate-pulse"></div>
                </div>
                {children}
              </main>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userName = user?.name || "User";
  
  if (process.env.NODE_ENV === "development" && !user?.role) {
    console.warn("[LayoutWrapperClient] User role is missing. Defaulting to mentee.");
  }

  return (
    <div className="flex min-h-screen md:h-screen flex-col bg-[#F8F5F2] md:overflow-hidden">
      {/* Top header */}
      <div className={shouldUseMentorLayout ? "hidden lg:block flex-shrink-0" : "flex-shrink-0"}>
        <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
      </div>
      {/* IMPORTANT: constrain height + allow inner scrolling */}
      <div className="flex-1 min-h-0 md:overflow-hidden">
        {shouldUseMentorLayout ? (
          <>
            {/* Mobile: Simplified layout without header and sidebars */}
            <div className="lg:hidden">
              <div className="conversation-mobile-layout">
                {children}
              </div>
            </div>
            {/* Desktop: 3-column layout with header, sidebars, and chat */}
            <div className="hidden lg:block h-full">
              <div className="flex h-full min-h-0 justify-center">
                {/* LEFT SIDEBAR - Fixed position with padding from edge, touches chat box */}
                <div className="pl-4 flex-shrink-0">
                  <aside className="hidden lg:block w-[240px] h-full overflow-y-auto border-r border-[#CAAE92]/30 bg-[#F8F5F2] rounded-lg sidebar-no-scrollbar">
                    <Sidebar isMobileOpen={false} onMobileClose={() => {}} />
                  </aside>
                </div>
                {/* CENTER CHAT - Centered on screen */}
                <main className="w-[750px] flex-shrink-0 h-full min-h-0 overflow-hidden">
                  {children}
                </main>
                {/* RIGHT PANEL - Fixed width, touches chat box, padding from edge */}
                <div className="w-[420px] flex-shrink-0 pr-4">
                  <RightPanelSlot />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-0">
            <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
            <main className="px-4 py-4 sm:px-6 sm:py-5 md:p-6">
              {!shouldUseMentorLayout && (
                <div className="mb-4 flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-[#1F2937]">
                    Welcome, {userName}
                  </h1>
                  <RoleBadge role={userRole} />
                </div>
              )}
              {children}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LayoutWrapperClient({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ConversationLayoutProvider>
        <LayoutWrapperClientInner>{children}</LayoutWrapperClientInner>
      </ConversationLayoutProvider>
    </QueryProvider>
  );
}
