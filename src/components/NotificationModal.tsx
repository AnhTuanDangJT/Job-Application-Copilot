"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Clock, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AnnouncementDetailModal from "./AnnouncementDetailModal";

interface Notification {
  id: string;
  userId: string;
  conversationId?: string;
  type: "chat_message" | "reminder_due" | "insight_ready" | "mentor_suggestion" | "GROUP_ANNOUNCEMENT";
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

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const queryClient = useQueryClient();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Notification | null>(null);

  // Fetch all notifications
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=100&unreadOnly=false", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: isOpen, // Only fetch when modal is open
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

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Filter notifications by type
  const reminderNotifications = notifications.filter((n) => n.type === "reminder_due");
  const groupAnnouncements = notifications.filter((n) => n.type === "GROUP_ANNOUNCEMENT");
  const otherNotifications = notifications.filter((n) => n.type !== "reminder_due" && n.type !== "GROUP_ANNOUNCEMENT");

  const getReminderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      "follow-up": "Follow-up",
      interview: "Interview",
      "thank-you": "Thank-you",
    };
    return labels[type] || type;
  };

  const getReminderTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "follow-up": "bg-[#F4E2D4] text-[#734C23]",
      interview: "bg-purple-100 text-purple-800",
      "thank-you": "bg-green-100 text-green-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markAsReadMutation.mutate(notification.id);
    }
    // For group announcements, show detail modal
    if (notification.type === "GROUP_ANNOUNCEMENT") {
      setSelectedAnnouncement(notification);
    } else {
      // Don't navigate - just close modal per requirements
      onClose();
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 md:p-4">
      {/* Backdrop - Light neutral overlay */}
      <div
        className="absolute inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] bg-[#F8F5F2]/95 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <h2 className="text-xl font-semibold text-[#734C23]">All Notifications</h2>
          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-[#734C23] hover:text-[#9C6A45] transition-colors px-3 py-2 md:py-1.5 rounded-lg hover:bg-[#F4E2D4]/50 min-h-[44px] md:min-h-0 flex items-center"
                disabled={markAllAsReadMutation.isPending}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-3 md:p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 min-h-[44px] md:min-h-0 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[#6B7280]">Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-12 h-12 text-[#CAAE92] mb-4" />
              <p className="text-[#6B7280] font-medium">No notifications</p>
              <p className="text-sm text-[#9C6A45] mt-2">You're all caught up!</p>
              <button
                onClick={onClose}
                className="mt-6 w-full md:w-auto px-6 py-4 md:py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 min-h-[44px]"
              >
                Return
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Reminders Section */}
              {reminderNotifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#734C23] mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Reminders ({reminderNotifications.length})
                  </h3>
                  <div className="space-y-3 md:space-y-3">
                    {reminderNotifications.map((notification) => {
                      const reminderType = notification.meta?.reminderType || "reminder";
                      const isUpcoming = !notification.readAt;
                      const status = isUpcoming ? "upcoming" : "completed";

                      return (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left rounded-lg border border-[#CAAE92]/30 p-4 md:p-4 hover:bg-[#F8F5F2] transition-colors min-h-[44px] ${
                            !notification.readAt ? "bg-[#F4E2D4]/30" : "bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className={`text-xs px-2 py-1 rounded font-medium ${getReminderTypeColor(reminderType)}`}
                                >
                                  {getReminderTypeLabel(reminderType)}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    status === "upcoming"
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {status === "upcoming" ? "Upcoming" : "Completed"}
                                </span>
                              </div>
                              <p className="font-medium text-[#734C23] text-sm mb-1">
                                {notification.title}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                <Clock className="w-3 h-3" />
                                {new Date(notification.createdAt).toLocaleString()}
                              </div>
                            </div>
                            {!notification.readAt && (
                              <div className="w-2 h-2 rounded-full bg-[#DC2626] flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group Announcements Section */}
              {groupAnnouncements.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#734C23] mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Group Announcements ({groupAnnouncements.length})
                  </h3>
                  <div className="space-y-3 md:space-y-3">
                    {groupAnnouncements.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left rounded-lg border border-[#CAAE92]/30 p-4 hover:bg-[#F8F5F2] transition-colors ${
                          !notification.readAt ? "bg-[#F4E2D4]/30" : "bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#734C23] text-sm mb-1">
                              {notification.title}
                            </p>
                            <p className="text-xs text-[#6B7280] mb-2 line-clamp-2">
                              {notification.body}
                            </p>
                            <p className="text-xs text-[#9C6A45]">
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
                </div>
              )}

              {/* Other Notifications Section */}
              {otherNotifications.length > 0 && (
                <div>
                  {(reminderNotifications.length > 0 || groupAnnouncements.length > 0) && (
                    <h3 className="text-sm font-semibold text-[#734C23] mb-3">
                      Other Notifications ({otherNotifications.length})
                    </h3>
                  )}
                  <div className="space-y-3 md:space-y-3">
                    {otherNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left rounded-lg border border-[#CAAE92]/30 p-4 hover:bg-[#F8F5F2] transition-colors ${
                          !notification.readAt ? "bg-[#F4E2D4]/30" : "bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#734C23] text-sm mb-1">
                              {notification.title}
                            </p>
                            <p className="text-xs text-[#6B7280] mb-2 line-clamp-2">
                              {notification.body}
                            </p>
                            <p className="text-xs text-[#9C6A45]">
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level to ensure it's not clipped
  if (typeof window === "undefined") return null;
  
  return (
    <>
      {createPortal(modalContent, document.body)}
      <AnnouncementDetailModal
        isOpen={selectedAnnouncement !== null}
        onClose={() => setSelectedAnnouncement(null)}
        notification={selectedAnnouncement}
      />
    </>
  );
}

