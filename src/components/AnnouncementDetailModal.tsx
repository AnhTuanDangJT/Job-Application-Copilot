"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";

interface AnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: {
    id: string;
    title: string;
    body: string;
    meta?: {
      groupName?: string;
      fullContent?: string;
    };
    createdAt: string;
  } | null;
}

export default function AnnouncementDetailModal({
  isOpen,
  onClose,
  notification,
}: AnnouncementDetailModalProps) {
  if (!isOpen || !notification) return null;

  // Use full content from meta if available, otherwise use body
  const content = notification.meta?.fullContent || notification.body;

  // Handle ESC key
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

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-0 md:p-4">
      {/* Backdrop - Light neutral overlay */}
      <div
        className="absolute inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] bg-[#F8F5F2]/95 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F4E2D4]">
              <Users className="w-5 h-5 text-[#734C23]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">Group Announcement</h2>
              {notification.meta?.groupName && (
                <p className="text-sm text-[#6B7280] mt-1">{notification.meta.groupName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose max-w-none">
            <div className="text-[#1F2937] whitespace-pre-wrap break-words">
              {content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#CAAE92]/30 bg-[#F8F5F2] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6B7280]">
                Sent on {new Date(notification.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-[#6B7280] mt-1">
                This is a read-only announcement. You cannot reply to group announcements.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  if (typeof window === "undefined") return null;

  return createPortal(modalContent, document.body);
}

