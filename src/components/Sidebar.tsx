"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import TutorialModal from "./TutorialModal";
import { useAuth } from "@/contexts/AuthContext";

type UserRole = "mentee" | "mentor";

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialContext, setTutorialContext] = useState<"mentee" | "mentor">("mentee");
  const { user } = useAuth();

  // Use role from AuthContext
  useEffect(() => {
    if (user?.role) {
      const roleForTools = user.role === "admin" ? null : (user.role as UserRole);
      setUserRole(roleForTools);
    }
  }, [user?.role]);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/");
  };

  const showAdminTools = user?.isAdmin || false;
  
  // STRICT: Route-based detection ONLY - determine if we're on mentor-communication routes
  const isMentorCommunicationRoute = pathname?.startsWith("/mentor-communication");
  const isConversationPage = pathname?.includes("/mentor-communication/") && pathname !== "/mentor-communication";
  
  // STRICT: For mentors on /mentor-communication routes, ALWAYS show mentor tools, hide mentee tools
  // Route-based AND role-based ONLY - do not infer from conversation data
  const showMenteeTools = (isMentorCommunicationRoute && userRole === "mentor") ? false : ((userRole === "mentee" && !showAdminTools) || false);
  const showMentorTools = (userRole === "mentor" && !showAdminTools) || false;
  
  const sidebarWidth = isConversationPage ? "w-[240px]" : "md:w-64";

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  // Mobile drawer overlay
  const mobileOverlay = isMobileOpen ? (
    <div
      className="mobile-menu-overlay fixed inset-0 bg-black/50 z-[150] md:hidden"
      onClick={onMobileClose}
      aria-hidden="true"
      style={{ pointerEvents: 'auto' }}
    />
  ) : null;

  // Sidebar content
  const sidebarContent = (
    <>
      <div className="p-4 space-y-4 text-sm">
        <div className="text-[#6B7280] uppercase tracking-wide text-xs font-semibold">MAIN NAVIGATION</div>
        {/* Mobile header with close button */}
        <div className="md:hidden flex items-center justify-between mb-4 pb-4 border-b border-[#CAAE92]/30">
          <h2 className="text-lg font-semibold text-[#734C23]">Menu</h2>
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul className="space-y-2 md:space-y-1">
          <li>
            <Link 
              href="/dashboard"
              onClick={handleLinkClick}
              className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
                isActive("/dashboard") && pathname === "/dashboard" 
                  ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" 
                  : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
              }`}
            >
              Dashboard
            </Link>
          </li>
          {/* Hide Browse Jobs for mentors and on conversation pages */}
          {!isConversationPage && (userRole === "mentee" || showAdminTools) && (
            <li>
              <Link 
                href="/jobs"
                onClick={handleLinkClick}
                className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
                  isActive("/jobs") ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
                }`}
              >
                Browse Jobs
              </Link>
            </li>
          )}
        </ul>

        {showMenteeTools && (
          <>
            <div className="pt-4 border-t border-[#CAAE92]/30">
              <div className="text-[#6B7280] uppercase tracking-wide text-xs font-semibold flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#9C6A45]"></span>
                RESUMES
              </div>
              <ul className="space-y-2 md:space-y-1 mt-2">
                <li>
                  <Link 
                    href="/resumes/cover-letter-generator"
                    onClick={handleLinkClick}
                    className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
                      isActive("/resumes/cover-letter-generator") ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
                    }`}
                  >
                    Cover Letter Generator
                  </Link>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-[#CAAE92]/30">
              <div className="text-[#6B7280] uppercase tracking-wide text-xs font-semibold flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#16A34A]"></span>
                MENTEE TOOLS
              </div>
              <ul className="space-y-2 md:space-y-1 mt-2">
                <li>
                  <MentorCommunicationLink isActive={isActive("/mentor-communication")} onLinkClick={handleLinkClick} />
                </li>
                <li>
                  <ApplicationsLink 
                    isActive={isActive("/mentor-communication")}
                    onLinkClick={handleLinkClick}
                  />
                </li>
                <li>
                  <button
                    onClick={() => {
                      setTutorialContext("mentee");
                      setIsTutorialOpen(true);
                    }}
                    className="w-full text-left block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23] min-h-[44px] md:min-h-0 flex items-center"
                  >
                    How to Use
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}

        {showMentorTools && (
            <div className="pt-4 border-t border-[#CAAE92]/30">
              <div className="text-[#6B7280] uppercase tracking-wide text-xs font-semibold">MENTOR TOOLS</div>
            <ul className="space-y-1 mt-2">
              <li>
                <Link 
                  href="/mentor/overview"
                  onClick={handleLinkClick}
                  className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
                    isActive("/mentor/overview") ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
                  }`}
                >
                  Mentor Overview
                </Link>
              </li>
              <li>
                <MentorCommunicationLink isActive={isActive("/mentor-communication")} onLinkClick={handleLinkClick} />
              </li>
              <li>
                <ApplicationsLink 
                  isActive={isActive("/mentor-communication")}
                  onLinkClick={handleLinkClick}
                />
              </li>
              <li>
                <button
                  onClick={() => {
                    setTutorialContext("mentor");
                    setIsTutorialOpen(true);
                  }}
                  className="w-full text-left block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23] min-h-[44px] md:min-h-0 flex items-center"
                >
                  How to Use
                </button>
              </li>
            </ul>
          </div>
        )}

        {showAdminTools && (
          <div className="pt-4 border-t border-[#CAAE92]/30">
            <div className="text-[#6B7280] uppercase tracking-wide text-xs font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626]"></span>
              ADMIN TOOLS
            </div>
            <ul className="space-y-1 mt-2">
              <li>
                <Link 
                  href="/dashboard/admin"
                  onClick={handleLinkClick}
                  className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
                    isActive("/dashboard/admin") ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
                  }`}
                >
                  Admin Management
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        userRole={userRole}
        context={tutorialContext}
      />
    </>
  );

  return (
    <>
      {mobileOverlay}
      {/* Desktop sidebar - hidden on mobile */}
      <aside className={`hidden md:block ${sidebarWidth} border-r border-[#CAAE92]/30 min-h-[calc(100vh-64px)] bg-[#F8F5F2]`}>
        {sidebarContent}
      </aside>
      {/* Mobile drawer - visible on mobile when open */}
      <aside
        className={`mobile-menu fixed top-16 left-0 h-[calc(100dvh-64px)] w-64 bg-[#F8F5F2] border-r border-[#CAAE92]/30 z-[150] transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ pointerEvents: 'auto' }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

// Client component to handle Mentor Communication navigation
function MentorCommunicationLink({ isActive, onLinkClick }: { isActive: boolean; onLinkClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const conversationMatch = pathname?.match(/^\/mentor-communication\/([^\/]+)$/);
  const isApplicationsView = conversationMatch && searchParams?.get("view") === "applications";
  const shouldHighlight = isActive && !isApplicationsView;

  const handleClick = (e: React.MouseEvent) => {
    if (conversationMatch) {
      e.preventDefault();
      const conversationId = conversationMatch[1];
      router.push(`/mentor-communication/${conversationId}`);
    }
    if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <Link 
      href="/mentor-communication" 
      onClick={handleClick}
      className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
        shouldHighlight ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
      }`}
    >
      Communication
    </Link>
  );
}

// Client component to handle Applications navigation
function ApplicationsLink({ isActive, onLinkClick }: { isActive: boolean; onLinkClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  const conversationMatch = pathname?.match(/^\/mentor-communication\/([^\/]+)$/);
  const isApplicationsView = conversationMatch && searchParams?.get("view") === "applications";

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isNavigating) return;

    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      router.push(`/mentor-communication/${conversationId}?view=applications`);
      return;
    }

    setIsNavigating(true);
    try {
      const response = await fetch("/api/mentor-communication/conversations", {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.conversations && data.conversations.length > 0) {
          const firstConv = data.conversations[0];
          router.push(`/mentor-communication/${firstConv.id}?view=applications`);
        } else {
          router.push("/mentor-communication");
        }
      } else {
        router.push("/mentor-communication");
      }
    } catch (error) {
      router.push("/mentor-communication");
    } finally {
      setIsNavigating(false);
      if (onLinkClick) {
        onLinkClick();
      }
    }
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={`block rounded-lg px-3 py-3 md:py-2 transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center ${
        isActive && isApplicationsView ? "bg-[#F4E2D4] text-[#734C23] font-medium shadow-sm" : "text-[#6B7280] hover:bg-[#F4E2D4]/50 hover:text-[#734C23]"
      }`}
    >
      Applications
    </a>
  );
}
