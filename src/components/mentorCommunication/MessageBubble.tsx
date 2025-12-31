"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import ImageViewerModal from "./ImageViewerModal";

interface MessageBubbleProps {
  message: {
    id: string;
    senderId?: string;
    senderRole?: "mentee" | "mentor" | "system";
    type: "TEXT" | "FILE" | "FEEDBACK" | "SYSTEM";
    content?: string;
    imageUrl?: string;
    resumeShareId?: string;
    replyToMessageId?: string;
    createdAt: string;
    deletedAt?: string;
    deletedBy?: string;
  };
  currentUserId: string;
  showRoleLabel?: boolean;
  isGrouped?: boolean;
  showAvatar?: boolean;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  repliedMessage?: {
    id: string;
    senderId?: string;
    senderRole?: "mentee" | "mentor" | "system";
    content?: string;
    imageUrl?: string;
  } | null;
  messageRef?: React.RefObject<HTMLDivElement>;
}

function RoleBadgeSmall({ role, isOwn }: { role?: "mentee" | "mentor"; isOwn: boolean }) {
  const roleConfig = {
    mentee: { label: "Mentee", color: "text-[#16A34A]", bgColor: "bg-[#D1FAE5]" },
    mentor: { label: "Mentor", color: "text-[#9C6A45]", bgColor: "bg-[#F4E2D4]" },
  };

  const config = role ? (roleConfig[role] || { label: role, color: "text-gray-700", bgColor: "bg-gray-100" }) : { label: "User", color: "text-gray-700", bgColor: "bg-gray-100" };

  if (isOwn) {
    return (
      <span className={`text-sm sm:text-xs ${config.color} opacity-90`}>
        You • {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-sm sm:text-xs font-medium ${config.bgColor} ${config.color}`}>
      {config.label}
    </span>
  );
}

function MessageBubble({ message, currentUserId, showRoleLabel = true, isGrouped = false, showAvatar = false, onDelete, onReply, repliedMessage, messageRef }: MessageBubbleProps) {
  const isOwnMessage = message.senderId === currentUserId;
  const isSystemMessage = message.type === "SYSTEM";
  const isFeedbackMessage = message.type === "FEEDBACK";
  const isDeleted = !!message.deletedAt;
  const isDeletedByCurrentUser = isDeleted && message.deletedBy === currentUserId;
  // Determine alignment based on role: Mentee = RIGHT, Mentor = LEFT
  const isMentee = message.senderRole === "mentee";
  const isMentor = message.senderRole === "mentor";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Only allow deleting own non-system, non-feedback, non-deleted messages
  const canDelete = isOwnMessage && !isSystemMessage && !isFeedbackMessage && !isDeleted && onDelete;
  // Only allow replying to non-system, non-feedback, non-deleted messages
  const canReply = !isSystemMessage && !isFeedbackMessage && !isDeleted && onReply;
  // Show menu for all messages (at least Copy), but only show Delete for own messages
  const canShowMenu = !isSystemMessage && !isFeedbackMessage && !isDeleted;

  // Calculate menu position when opened
  const updateMenuPosition = useCallback(() => {
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const menuWidth = 160; // Approximate menu width
      const gap = 8; // Gap between button and menu
      
      // Position menu below the button, aligned to the right for own messages, left for others
      let left = rect.left;
      let top = rect.bottom + gap;
      
      // For own messages, align menu to the right edge of button
      if (isOwnMessage) {
        left = rect.right - menuWidth;
      }
      
      // Ensure menu doesn't go off screen
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 8;
      }
      if (left < 8) {
        left = 8;
      }
      
      // If menu would go off bottom, position above button
      if (top + 100 > window.innerHeight) {
        top = rect.top - 100;
      }
      
      setMenuPosition({ top, left });
    }
  }, [isOwnMessage]);

  // Update position when menu opens or window resizes
  useEffect(() => {
    if (isMenuOpen) {
      updateMenuPosition();
    }
  }, [isMenuOpen, updateMenuPosition]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleResize = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMenuOpen, updateMenuPosition]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen]);

  // Close menu on ESC key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isMenuOpen]);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleCopyMessage = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setIsMenuOpen(false);
  };

  const handleReplyClick = () => {
    if (onReply) {
      onReply(message.id);
    }
    setIsMenuOpen(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setIsMenuOpen(false);
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(message.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Handle ESC key for delete confirmation
  useEffect(() => {
    if (!showDeleteConfirm) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCancelDelete();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDeleteConfirm]);

  // Prevent body scroll when delete modal is open
  useEffect(() => {
    if (showDeleteConfirm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeleteConfirm]);

  const getMessageTypeLabel = () => {
    switch (message.type) {
      case "FILE":
        return "📄 Shared a resume";
      case "FEEDBACK":
        return "💬 Feedback";
      default:
        return null;
    }
  };

  // SYSTEM and FEEDBACK messages are centered and styled differently
  if (isSystemMessage || isFeedbackMessage) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-[#9C6A45] border border-[#9C6A45] rounded-xl px-4 py-2.5 max-w-[85%] shadow-md">
          {isFeedbackMessage && getMessageTypeLabel() && (
            <div className="text-sm sm:text-xs mb-1.5 opacity-90 text-white">
              {getMessageTypeLabel()}
            </div>
          )}
          <p className={`text-base sm:text-sm text-white ${isSystemMessage ? "text-center italic" : ""}`}>
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Deleted messages: show placeholder (Messenger-style)
  if (isDeleted) {
    const placeholderText = isDeletedByCurrentUser 
      ? "You deleted a message"
      : "This message was deleted";
    
    return (
      <div
        className={`message-row ${isOwnMessage ? "own-message" : "other-message"} ${!isGrouped ? "mb-3" : "mb-1.5"}`}
      >
        {/* Avatar - only for mentor messages on the left */}
        {isMentor && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-xs font-medium text-gray-600 mr-2">
            M
          </div>
        )}
        
        <div className="bubble-wrapper">
          {showRoleLabel && !isOwnMessage && (
            <div className="mb-1.5 px-1">
              <RoleBadgeSmall role={message.senderRole} isOwn={false} />
            </div>
          )}
          
          {/* Deleted message placeholder - no bubble background, just text */}
          <div className="px-4 py-2.5">
            <p className="text-sm text-gray-500 italic">
              {placeholderText}
            </p>
          </div>
          
          {/* Timestamp for deleted messages */}
          {showRoleLabel && (
            <div className="timestamp">
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Bubble styles based on role - matching image exactly
  const getBubbleStyles = () => {
    if (isMentee) {
      // Mentee message bubble (brown) - RIGHT side - rounded brown bubble
      return "bg-[#8B7355] text-white rounded-xl";
    }
    // Mentor message bubble (light beige/champagne) - LEFT side
    return "bg-[#F5E6D3] text-[#333] rounded-xl";
  };

  // Menu content to be rendered via portal
  const menuContent = isMenuOpen && canShowMenu ? (
    <div
      ref={menuRef}
      className="fixed rounded-lg border border-[#CAAE92]/30 bg-white shadow-lg min-w-[160px] py-1"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        zIndex: 20000,
      }}
    >
      <button
        type="button"
        onClick={handleCopyMessage}
        className="w-full text-left px-4 py-2 text-sm text-[#734C23] hover:bg-[#F8F5F2] transition-colors"
      >
        Copy message
      </button>
      {canReply && (
        <button
          type="button"
          onClick={handleReplyClick}
          className="w-full text-left px-4 py-2 text-sm text-[#734C23] hover:bg-[#F8F5F2] transition-colors"
        >
          Reply
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="w-full text-left px-4 py-2 text-sm text-[#DC2626] hover:bg-[#F8F5F2] transition-colors"
        >
          Delete
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      <div
        data-message-id={message.id}
        className={`message-row ${isOwnMessage ? "own-message" : "other-message"} ${!isGrouped ? "mb-3" : "mb-1.5"} group relative`}
      >
        {/* Avatar - only for mentor messages on the left */}
        {isMentor && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-xs font-medium text-gray-600 mr-2">
            M
          </div>
        )}
        
        <div className="bubble-wrapper">
          {/* Role label - show above first message in group for non-own messages */}
          {showRoleLabel && !isOwnMessage && (
            <div className="mb-1.5 px-1">
              <RoleBadgeSmall role={message.senderRole} isOwn={false} />
            </div>
          )}
          
          {/* Message bubble with menu button */}
          <div className={`flex items-center gap-1 ${isMentee ? "flex-row-reverse" : "flex-row"}`}>
            {/* 3-dot menu button - visible on hover for messages that can show menu */}
            {canShowMenu && (
              <button
                ref={menuButtonRef}
                onClick={handleMenuToggle}
                className="message-actions w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F4E2D4] active:bg-[#CAAE92] flex-shrink-0 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-all duration-150 ease-in-out"
                aria-label="Message options"
                type="button"
              >
                <svg
                  className="w-4 h-4 text-[#734C23]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            )}
            <div
              ref={messageRef}
              className={`bubble ${getBubbleStyles()}`}
            >
              {getMessageTypeLabel() && (
                <div className={`text-sm sm:text-xs mb-1.5 ${isMentee ? "opacity-90" : "opacity-75"}`}>
                  {getMessageTypeLabel()}
                </div>
              )}
              {/* Quoted message preview */}
              {repliedMessage && (
                <div
                  className={`mb-2 pl-3 border-l-2 ${
                    isMentee ? "border-white/50" : "border-[#CAAE92]/50"
                  } cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Scroll to original message will be handled by parent
                    if (message.replyToMessageId) {
                      const targetElement = document.querySelector(
                        `[data-message-id="${message.replyToMessageId}"]`
                      );
                      if (targetElement) {
                        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
                        // Highlight briefly
                        targetElement.classList.add("ring-2", "ring-[#9C6A45]", "ring-offset-2");
                        setTimeout(() => {
                          targetElement.classList.remove("ring-2", "ring-[#9C6A45]", "ring-offset-2");
                        }, 2000);
                      }
                    }
                  }}
                >
                  <div className={`text-sm sm:text-xs font-medium mb-0.5 ${isMentee ? "text-white/80" : "text-[#734C23]"}`}>
                    {repliedMessage.senderId === currentUserId
                      ? "You"
                      : repliedMessage.senderRole === "mentor"
                      ? "Mentor"
                      : "Mentee"}
                  </div>
                  <div className={`text-sm sm:text-xs truncate ${isMentee ? "text-white/70" : "text-[#6B7280]"}`}>
                    {repliedMessage.imageUrl ? "Image" : repliedMessage.content || ""}
                  </div>
                </div>
              )}
              {message.content && (
                <p className={`text-base sm:text-sm whitespace-pre-wrap break-words leading-relaxed ${isMentee ? "text-white" : "text-[#333]"} ${message.imageUrl ? "mb-2" : ""}`}>
                  {message.content}
                </p>
              )}
              {message.imageUrl && (
                <div className={`${message.content ? "mt-2" : ""}`}>
                  <img
                    src={message.imageUrl}
                    alt="Shared image"
                    className="max-w-full max-h-[400px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxWidth: "100%", height: "auto" }}
                    onClick={() => setShowImageModal(true)}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Timestamp - only show on last message in group or standalone */}
          {showRoleLabel && (
            <div className="timestamp">
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              {isOwnMessage && (
                <span className="ml-2">
                  <RoleBadgeSmall role={message.senderRole} isOwn={true} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Render menu via portal to document.body */}
      {typeof window !== "undefined" && menuContent
        ? createPortal(menuContent, document.body)
        : null}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-sm w-full animate-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#734C23]">Delete this message?</h3>
              <button
                onClick={handleCancelDelete}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mb-6">
              This message will be deleted for everyone. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-between items-center pt-4 border-t border-[#CAAE92]/30">
              <button
                onClick={handleCancelDelete}
                className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] transition-all duration-200 shadow-md focus:ring-2 focus:ring-red-400/40 focus:ring-offset-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image viewer modal */}
      {showImageModal && message.imageUrl && (
        <ImageViewerModal
          imageUrl={message.imageUrl}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  );
}

export default memo(MessageBubble, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.imageUrl === nextProps.message.imageUrl &&
    prevProps.message.deletedAt === nextProps.message.deletedAt &&
    prevProps.message.replyToMessageId === nextProps.message.replyToMessageId &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.showRoleLabel === nextProps.showRoleLabel &&
    prevProps.isGrouped === nextProps.isGrouped &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.repliedMessage?.id === nextProps.repliedMessage?.id &&
    prevProps.repliedMessage?.content === nextProps.repliedMessage?.content
  );
});

