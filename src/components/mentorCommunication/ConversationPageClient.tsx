"use client";

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ChatInterface from "./ChatInterface";
import ApplicationTracker from "./ApplicationTracker";
import HeaderCard from "./HeaderCard";
import PreventBodyScroll from "./PreventBodyScroll";
import TabbedSidebar from "./TabbedSidebar";
import MobileBottomSheet from "./MobileBottomSheet";
import { useConversationLayout } from "@/contexts/ConversationLayoutContext";

type ViewMode = 'communication' | 'applications';

interface ConversationPageClientProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
  otherParticipant: {
    id: string;
    name: string;
    fullName?: string;
    email?: string;
    role: "mentee" | "mentor" | "admin";
  } | null;
  sessionType?: "RESUME_REVIEW" | "INTERVIEW";
  conversationStatus?: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ENDED";
}

function ConversationPageClient({
  conversationId,
  userRole,
  otherParticipant,
  sessionType = "RESUME_REVIEW",
  conversationStatus = "ACTIVE",
}: ConversationPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get("view");
  
  // Initialize viewMode from URL param, default to 'communication'
  const [viewMode, setViewMode] = useState<ViewMode>(
    viewParam === "applications" ? "applications" : "communication"
  );
  
  // Mobile right panel state
  const [isMobileRightPanelOpen, setIsMobileRightPanelOpen] = useState(false);

  // Sync viewMode with URL param changes
  useEffect(() => {
    const newViewMode = viewParam === "applications" ? "applications" : "communication";
    setViewMode(newViewMode);
  }, [viewParam]);

  const { setRightPanel } = useConversationLayout();

  // Stable callback for opening mobile right panel
  const handleOpenRightPanel = useCallback(() => {
    setIsMobileRightPanelOpen(true);
  }, []);

  // Stable callback for closing mobile right panel
  const handleCloseRightPanel = useCallback(() => {
    setIsMobileRightPanelOpen(false);
  }, []);

  // Memoize ChatInterface props to prevent unnecessary re-renders
  const chatInterfaceProps = useMemo(
    () => ({
      conversationId,
      userRole,
      otherParticipant,
      conversationStatus,
      onOpenRightPanel: handleOpenRightPanel,
    }),
    [conversationId, userRole, otherParticipant, conversationStatus, handleOpenRightPanel]
  );

  // Update lastSeenAt when conversation is opened
  useEffect(() => {
    const updateSeen = async () => {
      try {
        await fetch(`/api/mentor-communication/conversations/${conversationId}/seen`, {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("Failed to update seen status:", error);
      }
    };

    updateSeen();
  }, [conversationId]);

  // MANDATORY: Right panel must ALWAYS render in communication mode on desktop
  // Route-based rendering - not conditional on conversation state, message count, or other data
  // CRITICAL: Always set right panel in communication mode - it will be rendered by LayoutWrapperClient
  // Don't memoize JSX - render TabbedSidebar directly to ensure React Query context is available
  useEffect(() => {
    // Always show right panel in communication mode - layout context handles role-based display
    if (viewMode === 'communication') {
      setRightPanel(
        <TabbedSidebar
          conversationId={conversationId}
          userRole={userRole}
          sessionType={sessionType}
          otherParticipant={otherParticipant}
        />
      );
    } else {
      // Only clear when switching to applications view
      setRightPanel(null);
    }
  }, [viewMode, conversationId, userRole, sessionType, otherParticipant, setRightPanel]);

  // Separate cleanup effect - only clear on actual unmount/navigation away
  useEffect(() => {
    return () => {
      // Clear right panel when navigating away from conversation page
      setRightPanel(null);
    };
  }, [setRightPanel]);

  return (
    <>
      <PreventBodyScroll />
      {/* CRITICAL: h-full min-h-0 to allow proper flex constraints for scrolling */}
      <div className="h-full min-h-0 flex flex-col min-w-0 relative z-0">
        {viewMode === 'communication' ? (
          // Chat area only - right panel is handled by layout context (desktop) or bottom sheet (mobile)
          <>
            {/* CENTER CHAT COLUMN: flex column with constrained height */}
            {/* CRITICAL: ChatInterface is memoized and props are stable - won't re-render on tab changes */}
            <div className="h-full min-h-0 flex flex-col min-w-0">
              <ChatInterface {...chatInterfaceProps} />
            </div>
            
            {/* Mobile Bottom Sheet for Right Panel */}
            <MobileBottomSheet
              isOpen={isMobileRightPanelOpen}
              onClose={handleCloseRightPanel}
              title="Tools"
            >
              <TabbedSidebar
                conversationId={conversationId}
                userRole={userRole}
                sessionType={sessionType}
                otherParticipant={otherParticipant}
              />
            </MobileBottomSheet>
          </>
        ) : (
          // Applications view - Full width board
          <div className="flex-1 min-h-0 flex flex-col min-w-0">
            {/* Header Card - Same style as chat header */}
            <div className="flex-shrink-0 mb-4">
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <HeaderCard 
                    participant={otherParticipant || undefined} 
                    conversationId={conversationId}
                    conversationStatus={conversationStatus}
                    userRole={userRole}
                  />
                </div>
              </div>
            </div>
            
            {/* Application Tracker - Full width, fills remaining space */}
            <div className="flex-1 min-h-0 min-w-0">
              <ApplicationTracker conversationId={conversationId} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(ConversationPageClient);
