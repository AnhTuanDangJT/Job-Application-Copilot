"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import NotificationModal from "./NotificationModal";

interface Notification {
  id: string;
  userId: string;
  conversationId?: string;
  type: "chat_message" | "NEW_MESSAGE" | "reminder_due" | "insight_ready" | "mentor_suggestion" | "GROUP_ANNOUNCEMENT";
  title: string;
  body: string;
  link?: string;
  readAt?: string;
  meta?: Record<string, any>;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=10&unreadOnly=false", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Calculate dropdown position when opened or window resized
  const updateDropdownPosition = useCallback(() => {
    if (bellButtonRef.current) {
      const rect = bellButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 360; // w-[360px]
      const gap = 8; // 8px gap (mt-2 equivalent)
      
      // Position dropdown below the bell button, aligned to the right
      let right = window.innerWidth - rect.right;
      
      // Ensure dropdown doesn't go off the left edge on small screens
      if (right + dropdownWidth > window.innerWidth) {
        right = Math.max(8, window.innerWidth - dropdownWidth - 8);
      }
      
      setDropdownPosition({
        top: rect.bottom + gap,
        right: right,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
    }
  }, [isOpen, updateDropdownPosition]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      updateDropdownPosition();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Listen for real-time notification events
  useEffect(() => {
    // This will be handled by the global real-time update hook
    // For now, we rely on polling (refetchInterval)
    // TODO: Integrate with SSE/WebSocket for real-time updates
  }, []);

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markAsReadMutation.mutate(notification.id);
    }
    setIsOpen(false);
    // For group announcements, open the notification modal which will show detail modal
    // For other notifications, they're handled in the notification modal
    // Don't navigate - user requirement: clicking notification opens modal, no navigation
  };

  const handleViewAllNotifications = () => {
    setIsOpen(false);
    setIsNotificationModalOpen(true);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  // Dropdown content to be rendered via portal
  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed w-[360px] rounded-lg border border-[#CAAE92]/30 bg-white shadow-lg max-h-[320px] overflow-hidden flex flex-col"
      style={{
        top: `${dropdownPosition.top}px`,
        right: `${dropdownPosition.right}px`,
        zIndex: 10000,
      }}
    >
      <div className="flex items-center justify-between p-4 border-b border-[#CAAE92]/30 flex-shrink-0">
        <h3 className="font-semibold text-[#734C23]">Notifications</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="text-xs text-[#734C23] hover:text-[#9C6A45] transition-colors"
            disabled={markAllAsReadMutation.isPending}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1" style={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
        {isLoading ? (
          <div className="p-4 text-center text-[#6B7280]">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-[#6B7280]">No notifications</div>
        ) : (
          <div className="divide-y divide-[#CAAE92]/20">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-4 hover:bg-[#F8F5F2] transition-colors ${
                  !notification.readAt ? "bg-[#F4E2D4]/30" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    <p className="font-semibold text-[#734C23] text-sm mb-1">{notification.title}</p>
                    <p className="text-xs text-[#6B7280] mt-1 mb-2" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{notification.body}</p>
                    <p className="text-xs text-[#9C6A45] mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.readAt && (
                    <div className="w-2 h-2 rounded-full bg-[#DC2626] flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-2 border-t border-[#CAAE92]/30 flex-shrink-0">
          <button
            type="button"
            onClick={handleViewAllNotifications}
            className="block w-full text-center text-sm text-[#734C23] hover:text-[#9C6A45] transition-colors py-2"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={bellButtonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-[#6B7280] hover:text-[#734C23] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Render dropdown via portal to document.body */}
      {typeof window !== "undefined" && dropdownContent
        ? createPortal(dropdownContent, document.body)
        : null}

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </>
  );
}

