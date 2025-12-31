"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Virtuoso } from "react-virtuoso";
import MessageBubble from "./MessageBubble";
import HeaderCard from "./HeaderCard";

interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderRole?: "mentee" | "mentor" | "system";
  type: "TEXT" | "FILE" | "FEEDBACK" | "SYSTEM";
  content?: string;
  imageUrl?: string;
  resumeShareId?: string;
  replyToMessageId?: string;
  readBy: string[];
  createdAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
  otherParticipant?: {
    id: string;
    name: string;
    fullName?: string;
    email?: string;
    role: "mentee" | "mentor" | "admin";
  } | null;
  conversationStatus?: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ENDED";
  onOpenRightPanel?: () => void;
}

function ChatInterface({ conversationId, userRole, otherParticipant, conversationStatus = "ACTIVE", onOpenRightPanel }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [repliedMessagesMap, setRepliedMessagesMap] = useState<Map<string, Message>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef<boolean>(false); // Guard to prevent concurrent fetches
  const shouldAutoScrollRef = useRef<boolean>(true); // Track if we should auto-scroll
  const lastMessageCountRef = useRef<number>(0); // Track last message count to detect new messages
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imagePreviewUrlRef = useRef<string | null>(null); // Track current preview URL for cleanup
  const router = useRouter();

  // Get current user ID - READ-ONLY: This only reads auth state, never mutates it
  // Auth state comes from server cookie via /api/auth/me (read-only endpoint)
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store", // Always fetch fresh auth state
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.id);
        } else if (response.status === 401) {
          router.push("/auth/login");
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    }
    fetchUser();
  }, [router]);

  // Fetch messages - memoized to prevent stale closures
  // READ-ONLY: This endpoint only reads data, never mutates auth state
  const fetchMessages = useCallback(async () => {
    // Guard: Don't fetch if conversationId is invalid
    if (!conversationId || conversationId.trim() === "") {
      setError("Invalid conversation ID");
      setLoading(false);
      return;
    }

    // Guard: Prevent concurrent fetches to avoid race conditions
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    try {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/messages?page=1&limit=100`,
        {
          credentials: "include",
          cache: "no-store", // Always fetch fresh messages
        }
      );

      if (response.ok) {
        const data = await response.json();
        // CRITICAL FIX: Use functional update to prevent race conditions
        // This ensures we always work with the latest state, even if multiple fetches are queued
        setMessages((prevMessages) => {
          const newMessages = data.messages || [];
          // Preserve scroll position: only update if messages actually changed
          // This prevents unnecessary re-renders that cause layout shifts
          const prevIds = new Set(prevMessages.map(m => m.id));
          const newIds = new Set(newMessages.map(m => m.id));
          const idsChanged = prevIds.size !== newIds.size || 
            ![...prevIds].every(id => newIds.has(id));
          
          // Only update if messages actually changed
          if (idsChanged || newMessages.length !== prevMessages.length) {
            // Build replied messages map
            const repliedMap = new Map<string, Message>();
            newMessages.forEach((msg: Message) => {
              if (msg.replyToMessageId) {
                const repliedMsg = newMessages.find((m: Message) => m.id === msg.replyToMessageId);
                if (repliedMsg) {
                  repliedMap.set(msg.id, repliedMsg);
                }
              }
            });
            setRepliedMessagesMap(repliedMap);
            return newMessages;
          }
          
          // Messages are the same, but check if content changed (for updates)
          const hasContentChange = newMessages.some((newMsg: Message, idx: number) => {
            const prevMsg = prevMessages[idx];
            return !prevMsg || prevMsg.id !== newMsg.id || 
              prevMsg.content !== newMsg.content ||
              prevMsg.imageUrl !== newMsg.imageUrl ||
              prevMsg.deletedAt !== newMsg.deletedAt ||
              prevMsg.replyToMessageId !== newMsg.replyToMessageId;
          });
          
          if (hasContentChange) {
            // Rebuild replied messages map
            const repliedMap = new Map<string, Message>();
            newMessages.forEach((msg: Message) => {
              if (msg.replyToMessageId) {
                const repliedMsg = newMessages.find((m: Message) => m.id === msg.replyToMessageId);
                if (repliedMsg) {
                  repliedMap.set(msg.id, repliedMsg);
                }
              }
            });
            setRepliedMessagesMap(repliedMap);
          }
          
          return hasContentChange ? newMessages : prevMessages;
        });
        setLoading(false);
        setError(null); // Clear error on successful fetch
      } else if (response.status === 401) {
        // Auth error: redirect to login (don't mutate auth here, just redirect)
        setError("Authentication required");
        setLoading(false);
        router.push("/auth/login");
      } else if (response.status === 403 || response.status === 404) {
        setError("Conversation not found or access denied");
        setLoading(false);
        // Redirect after a short delay - stop polling on error
        setTimeout(() => {
          router.push("/mentor-communication");
        }, 2000);
      } else {
        console.error("Failed to fetch messages");
        setLoading(false);
        setError("Failed to load messages. Please refresh.");
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setLoading(false);
      setError("Network error. Please check your connection.");
    } finally {
      fetchingRef.current = false;
    }
  }, [conversationId, router]);

  // Initial load - only run once on mount
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, fetchMessages is stable

  // Cleanup object URL on component unmount
  useEffect(() => {
    return () => {
      // Revoke object URL when component unmounts to prevent memory leaks
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    };
  }, []); // Only run on mount/unmount

  // Heartbeat: send presence update every 15 seconds
  useEffect(() => {
    if (!conversationId) return;

    const sendHeartbeat = async () => {
      try {
        // Update global presence
        await fetch("/api/presence/heartbeat", {
          method: "POST",
          credentials: "include",
        });
        // Also update conversation-specific lastSeenAt
        await fetch(`/api/mentor-communication/conversations/${conversationId}/seen`, {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("Failed to send heartbeat:", error);
      }
    };

    // Send heartbeat immediately
    sendHeartbeat();

    // Then send every 15 seconds
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);

    // Also send heartbeat when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [conversationId]);

  // Poll for new messages every 4 seconds
  // CRITICAL: Only poll when conversationId exists, not in error state, and not loading
  useEffect(() => {
    // Stop polling if: error state, no conversationId, or still loading initial data
    if (error || !conversationId || loading) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling interval
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 4000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, error, loading]); // fetchMessages is stable, don't include in deps

  // Check if user is near bottom of chat (within 100px)
  const isNearBottom = useCallback(() => {
    if (!chatScrollContainerRef.current) return true;
    const container = chatScrollContainerRef.current;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Update shouldAutoScroll when user manually scrolls
  useEffect(() => {
    const container = chatScrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // If user scrolls up, disable auto-scroll
      // If user scrolls back to bottom, re-enable auto-scroll
      shouldAutoScrollRef.current = isNearBottom();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isNearBottom]);

  // Auto-scroll chat container to bottom ONLY when new messages arrive AND user is near bottom
  // CRITICAL: Only scroll the chat container, never the page
  // CRITICAL: Use requestAnimationFrame to ensure DOM is updated before scrolling
  useEffect(() => {
    const currentMessageCount = messages.length;
    const isNewMessage = currentMessageCount > lastMessageCountRef.current;
    lastMessageCountRef.current = currentMessageCount;

    // Only auto-scroll if:
    // 1. New message arrived (count increased)
    // 2. User is near bottom (or it's initial load)
    // 3. Container exists
    if (!isNewMessage || !shouldAutoScrollRef.current) {
      return;
    }

    const scrollChatToBottom = () => {
      if (!chatScrollContainerRef.current) return;
      
      const container = chatScrollContainerRef.current;
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        if (chatScrollContainerRef.current) {
          chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
        }
      });
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(scrollChatToBottom, 0);
    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  // CRITICAL FIX: Sort messages by createdAt to ensure consistent order
  // This prevents messages from jumping positions when state updates
  // MUST be declared BEFORE any early returns to maintain hook order
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      // If times are equal, use ID for stable sort
      return timeA !== timeB ? timeA - timeB : a.id.localeCompare(b.id);
    });
  }, [messages]);

  // Precompute message display properties for virtualization
  // This avoids recalculating grouping on every render
  const messageDisplayProps = useMemo(() => {
    return sortedMessages.map((message, index) => {
      // SYSTEM and FEEDBACK messages are never grouped and are centered
      if (message.type === "SYSTEM" || message.type === "FEEDBACK") {
        return {
          message,
          showRoleLabel: false,
          isGrouped: false,
          showAvatar: false,
          repliedMessage: null,
        };
      }

      // Group consecutive messages from same sender (within 5 minutes)
      const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
      const isGrouped = prevMessage && 
        prevMessage.type !== "SYSTEM" &&
        prevMessage.type !== "FEEDBACK" &&
        prevMessage.senderId === message.senderId &&
        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000; // 5 minutes
      
      // Check NEXT message to determine if this is the last in a group
      const nextMessage = index < sortedMessages.length - 1 ? sortedMessages[index + 1] : null;
      const isLastInGroup = !nextMessage || 
        nextMessage.type === "SYSTEM" ||
        nextMessage.type === "FEEDBACK" ||
        nextMessage.senderId !== message.senderId ||
        new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime() >= 5 * 60 * 1000; // 5 minutes
      
      // Show role label if it's the first message in a group or a standalone message
      const showRoleLabel = !isGrouped || index === 0;
      
      // Show avatar on the LAST message in a group (left-aligned for non-own messages)
      const showAvatar = isLastInGroup && message.senderId !== currentUserId;
      
      const repliedMessage = message.replyToMessageId
        ? repliedMessagesMap.get(message.id) || null
        : null;

      return {
        message,
        showRoleLabel,
        isGrouped: !!isGrouped,
        showAvatar,
        repliedMessage,
      };
    });
  }, [sortedMessages, currentUserId, repliedMessagesMap]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
      textarea.style.height = `${newHeight}px`;
    }
  }, [messageContent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter: new line
    // Enter: send message
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((messageContent.trim() || selectedImage) && !sending && !uploadingImage) {
        handleSendMessage(e as any);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // Reset input value even if no file selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      // Reset input value
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      // Reset input value
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Revoke previous preview URL if exists (cleanup)
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }

    // Store file in state
    setSelectedImage(file);
    setError(null);

    // Create preview URL using URL.createObjectURL (better performance than FileReader)
    const previewUrl = URL.createObjectURL(file);
    imagePreviewUrlRef.current = previewUrl; // Store in ref for cleanup
    setImagePreview(previewUrl);

    // Reset input value immediately so user can re-select same image if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    // Revoke object URL to free memory
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageContent.trim() && !selectedImage) || sending || uploadingImage) return;

    setSending(true);
    setError(null);

    const contentToSend = messageContent.trim() || undefined;
    const replyToMessageId = replyingTo?.id;

    // CRITICAL FIX: Optimistic update using functional state update
    // This ensures messages appear immediately and are appended correctly even if sent quickly
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempMessageId,
      conversationId,
      senderId: currentUserId,
      senderRole: userRole === "mentee" ? "mentee" : "mentor",
      type: "TEXT",
      content: contentToSend,
      imageUrl: selectedImage ? "uploading..." : undefined,
      replyToMessageId: replyToMessageId,
      readBy: [],
      createdAt: new Date().toISOString(),
    };

    // Add optimistic message immediately using functional update
    // Ensure we're at bottom before adding message to maintain scroll position
    shouldAutoScrollRef.current = isNearBottom();
    setMessages((prev) => [...prev, optimisticMessage]);
    
    // Store current image file and preview for cleanup after send
    const imageFileToSend = selectedImage;
    const previewUrlToCleanup = imagePreviewUrlRef.current;
    
    // Clear input immediately
    setMessageContent("");
    setSelectedImage(null);
    setImagePreview(null);
    setReplyingTo(null); // Clear reply state
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      // Send as multipart/form-data if image exists, otherwise JSON
      let response: Response;
      
      if (imageFileToSend) {
        setUploadingImage(true);
        const formData = new FormData();
        if (contentToSend) {
          formData.append("text", contentToSend);
        }
        formData.append("image", imageFileToSend);
        if (replyToMessageId) {
          formData.append("replyToMessageId", replyToMessageId);
        }

        response = await fetch(
          `/api/mentor-communication/conversations/${conversationId}/messages`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
            // Don't set Content-Type header - browser will set it automatically with boundary for FormData
          }
        );
        setUploadingImage(false);
      } else {
        response = await fetch(
          `/api/mentor-communication/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ 
              content: contentToSend,
              replyToMessageId: replyToMessageId || undefined,
            }),
          }
        );
      }

      if (response.ok) {
        const data = await response.json();
        const newMessage = data.message || data;
        
        // Clean up image preview URL after successful send
        if (previewUrlToCleanup) {
          URL.revokeObjectURL(previewUrlToCleanup);
        }
        
        // CRITICAL FIX: Replace optimistic message with real message using functional update
        // This preserves scroll position and prevents layout shifts
        setMessages((prev) => {
          // Remove the optimistic message and add the real one
          // Use functional update to ensure we work with latest state
          const filtered = prev.filter((msg) => msg.id !== tempMessageId);
          // Only add if not already present (avoid duplicates)
          const exists = filtered.some((msg) => msg.id === newMessage.id);
          return exists ? filtered : [...filtered, newMessage];
        });
        
        // Also fetch to ensure we have the latest from server (but guard prevents race conditions)
        // Use a small delay to let the optimistic update render first
        setTimeout(() => {
          fetchMessages();
        }, 100);
      } else if (response.status === 401) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        router.push("/auth/login");
      } else if (response.status === 403 || response.status === 404) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        setError("Cannot send message. Conversation may have been deleted.");
        setTimeout(() => {
          router.push("/mentor-communication");
        }, 2000);
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
        const errorData = await response.json().catch(() => ({ message: "Failed to send message" }));
        setError(errorData.message || "Failed to send message");
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      console.error("Error sending message:", error);
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  // Memoize handlers to prevent recreation on every render
  const handleReply = useCallback((messageId: string) => {
    const messageToReply = messages.find((m) => m.id === messageId);
    if (messageToReply) {
      setReplyingTo(messageToReply);
      // Focus textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [messages]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await fetch(
        `/api/mentor-communication/messages/${messageId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Update local state optimistically (soft delete - message stays but marked as deleted)
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, deletedAt: new Date().toISOString(), deletedBy: currentUserId }
              : msg
          )
        );
        // Also refetch to ensure consistency
        await fetchMessages();
      } else if (response.status === 401) {
        router.push("/auth/login");
      } else if (response.status === 403) {
        setError("You can only delete your own messages");
      } else {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete message" }));
        setError(errorData.message || "Failed to delete message");
      }
    } catch (error) {
        console.error("Error deleting message:", error);
      setError("Network error. Please try again.");
    }
  }, [conversationId, currentUserId, router, fetchMessages]);

  if (loading) {
    return (
      <div className="h-full min-h-0 flex flex-col min-w-0">
        {/* Chat header: shrink-0 */}
        <div className="shrink-0 border-b border-[#CAAE92] bg-[#FAF7F4] px-3 py-2 md:px-4 md:py-3">
          <HeaderCard participant={otherParticipant || undefined} conversationId={conversationId} onOpenRightPanel={onOpenRightPanel} />
        </div>
        {/* Messages list: flex-1 min-h-0 overflow-y-auto */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-[#FAF7F4]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-[#CAAE92]/30 rounded w-3/4"></div>
            <div className="h-4 bg-[#CAAE92]/30 rounded w-1/2"></div>
            <div className="h-4 bg-[#CAAE92]/30 rounded w-2/3"></div>
          </div>
        </div>
        {/* Input bar: shrink-0 border-t */}
        <div 
          className="shrink-0 border-t border-[#CAAE92] p-4 bg-[#FAF7F4]"
          style={{
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          }}
        >
          {conversationStatus === "COMPLETED" || conversationStatus === "CANCELLED" || conversationStatus === "ENDED" ? (
            <div className="text-center py-4 space-y-3">
              <div className="space-y-2">
                <p className="text-base sm:text-sm text-[#6B7280] font-medium">This mentorship term has ended.</p>
                <p className="text-sm sm:text-xs text-[#6B7280] italic">You can start a new mentorship term with {otherParticipant?.name || "this user"} anytime to continue.</p>
              </div>
              <button
                onClick={async () => {
                  if (!conversationId) return;
                  setSending(true);
                  setError(null);
                  try {
                    const response = await fetch("/api/mentorships/start-new-term", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      credentials: "include",
                      body: JSON.stringify({ conversationId }),
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      // Redirect to the new active conversation - chat will be enabled
                      router.push(`/mentor-communication/${data.id}`);
                    } else {
                      const errorData = await response.json().catch(() => ({ message: "Failed to start new mentorship term" }));
                      setError(errorData.message || "Failed to start new mentorship term");
                      setSending(false);
                    }
                  } catch (error) {
                    console.error("Error starting new mentorship term:", error);
                    setError("Network error. Please try again.");
                    setSending(false);
                  }
                }}
                disabled={sending || !conversationId}
                className="inline-flex items-center px-6 py-2.5 rounded-lg bg-[#734C23] text-white font-medium hover:bg-[#9C6A45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {sending ? "Starting..." : "Start New Mentorship Term"}
              </button>
            </div>
          ) : (
            <>
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-2 px-3 py-2 bg-[#F4E2D4] border-l-2 border-[#9C6A45] rounded-lg flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-xs font-medium text-[#734C23] mb-0.5">
                      Replying to {replyingTo.senderId === currentUserId
                        ? "yourself"
                        : replyingTo.senderRole === "mentor"
                        ? "Mentor"
                        : "Mentee"}
                    </div>
                    <div className="text-sm sm:text-xs text-[#6B7280] truncate">
                      {replyingTo.imageUrl ? "Image" : replyingTo.content || ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="flex-shrink-0 w-5 h-5 rounded-full hover:bg-[#CAAE92]/30 flex items-center justify-center transition-colors"
                    aria-label="Cancel reply"
                  >
                    <svg className="w-4 h-4 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {/* Image Preview */}
              {imagePreview && (
            <div className="mb-2 relative inline-block">
              <div className="relative rounded-lg overflow-hidden border border-[#CAAE92] max-w-[200px]">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-full max-h-[150px] object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 w-6 h-6 bg-[#734C23] text-white rounded-full flex items-center justify-center hover:bg-[#9C6A45] transition-colors"
                  aria-label="Remove image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {/* Image upload button */}
            <button
              type="button"
              onClick={handleImageButtonClick}
              disabled={sending || uploadingImage || loading}
              className="flex-shrink-0 w-11 h-11 sm:w-9 sm:h-9 rounded-lg bg-[#F4E2D4] hover:bg-[#CAAE92] text-[#734C23] flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              style={{ touchAction: 'manipulation' }}
              aria-label="Upload image"
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            
            <textarea
              ref={textareaRef}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line)"
              className="flex-1 rounded-lg bg-[#F4E2D4] px-3 py-2.5 text-base sm:text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] transition-[box-shadow] resize-none overflow-y-auto min-h-[44px] sm:min-h-[36px] max-h-[120px]"
              style={{ 
                fontSize: '16px', // Prevent iOS zoom on focus
                touchAction: 'manipulation'
              }}
              maxLength={10000}
              disabled={sending || uploadingImage || loading}
              rows={1}
            />
            <button
              type="submit"
              disabled={(!messageContent.trim() && !selectedImage) || sending || uploadingImage || loading}
              className="rounded-lg bg-[#734C23] px-4 sm:px-5 py-2.5 text-base sm:text-sm text-white hover:bg-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-h-[44px] sm:min-h-[36px] touch-manipulation"
              style={{ touchAction: 'manipulation' }}
            >
              {uploadingImage ? "Uploading..." : sending ? "Sending..." : "Send"}
            </button>
          </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // Input should always be visible when conversationId exists
  // Only show error-only state if conversationId is invalid (shouldn't happen due to page-level validation)
  // For other errors, show normal chat UI with error banner + input

  return (
    <div className="h-full min-h-0 flex flex-col min-w-0">
      {/* Chat Header: shrink-0 */}
      <div className="shrink-0 border-b border-[#CAAE92] bg-[#FAF7F4] px-3 py-2 md:px-4 md:py-3">
        <HeaderCard 
          participant={otherParticipant || undefined} 
          conversationId={conversationId}
          conversationStatus={conversationStatus}
          userRole={userRole}
          onOpenRightPanel={onOpenRightPanel}
        />
      </div>

      {/* SCROLL AREA: Use virtualization for 50+ messages, regular scroll for fewer */}
      {sortedMessages.length === 0 ? (
        <div 
          ref={chatScrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-[#FAF7F4]"
        >
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-base sm:text-sm text-yellow-800">{error}</p>
            </div>
          )}
          <div className="flex flex-col items-center py-8 px-4">
            {/* Welcome message - large rounded brown bubble matching image - appears first */}
            <div className="w-full max-w-[85%] sm:max-w-[70%] mb-6">
              <div className="bg-[#8B7355] text-white rounded-2xl px-6 py-5 text-base sm:text-sm leading-relaxed shadow-sm">
                Welcome to your mentorship session. Use this space to review resumes, discuss applications, and track progress.
              </div>
            </div>
          </div>
        </div>
      ) : messageDisplayProps.length > 50 ? (
        // Virtualized list for large message counts
        <div className="flex-1 min-h-0 bg-[#FAF7F4]">
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mx-4 mt-4 mb-4">
              <p className="text-base sm:text-sm text-yellow-800">{error}</p>
            </div>
          )}
          <Virtuoso
            data={messageDisplayProps}
            totalCount={messageDisplayProps.length}
            itemContent={(index) => {
              const displayProps = messageDisplayProps[index];
              if (!displayProps) return null;
              const { message, showRoleLabel, isGrouped, showAvatar, repliedMessage } = displayProps;
              // SYSTEM and FEEDBACK messages don't have delete/reply handlers
              if (message.type === "SYSTEM" || message.type === "FEEDBACK") {
                return (
                  <div className="px-4 py-1">
                    <MessageBubble
                      key={message.id}
                      message={message}
                      currentUserId={currentUserId}
                      showRoleLabel={showRoleLabel}
                      isGrouped={isGrouped}
                      showAvatar={showAvatar}
                    />
                  </div>
                );
              }
              return (
                <div className="px-4 py-1">
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentUserId={currentUserId}
                    showRoleLabel={showRoleLabel}
                    isGrouped={isGrouped}
                    showAvatar={showAvatar}
                    onDelete={handleDeleteMessage}
                    onReply={handleReply}
                    repliedMessage={repliedMessage}
                  />
                </div>
              );
            }}
            followOutput="auto"
            initialTopMostItemIndex={Math.max(0, messageDisplayProps.length - 1)}
            alignToBottom
            style={{ height: "100%" }}
          />
        </div>
      ) : (
        // Regular scroll container for smaller lists
        <div 
          ref={chatScrollContainerRef} 
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-[#FAF7F4]"
          style={{ 
            contain: 'layout style paint', 
            willChange: 'scroll-position',
            scrollBehavior: 'smooth'
          }}
        >
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-base sm:text-sm text-yellow-800">{error}</p>
            </div>
          )}
          <div className="chat-container">
            {messageDisplayProps.map((displayProps) => {
              const { message, showRoleLabel, isGrouped, showAvatar, repliedMessage } = displayProps;
              // SYSTEM and FEEDBACK messages don't have delete/reply handlers
              if (message.type === "SYSTEM" || message.type === "FEEDBACK") {
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentUserId={currentUserId}
                    showRoleLabel={showRoleLabel}
                    isGrouped={isGrouped}
                    showAvatar={showAvatar}
                  />
                );
              }
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                  showRoleLabel={showRoleLabel}
                  isGrouped={isGrouped}
                  showAvatar={showAvatar}
                  onDelete={handleDeleteMessage}
                  onReply={handleReply}
                  repliedMessage={repliedMessage}
                />
              );
            })}
          </div>
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar: shrink-0 border-t */}
      <div 
        className="shrink-0 border-t border-[#CAAE92] p-3 sm:p-3 bg-[#FAF7F4]"
        style={{
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(0.75rem + env(safe-area-inset-right, 0px))',
        }}
      >
        {conversationStatus === "COMPLETED" || conversationStatus === "CANCELLED" || conversationStatus === "ENDED" ? (
          <div className="text-center py-4 space-y-3">
            <div className="space-y-2">
              <p className="text-sm text-[#6B7280] font-medium">This mentorship term has ended.</p>
              <p className="text-xs text-[#6B7280] italic">You can start a new mentorship term with {otherParticipant?.name || "this user"} anytime to continue.</p>
            </div>
            <button
              onClick={async () => {
                if (!conversationId) return;
                setSending(true);
                setError(null);
                try {
                  const response = await fetch("/api/mentorships/start-new-term", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ conversationId }),
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    // Redirect to the new active conversation - chat will be enabled
                    router.push(`/mentor-communication/${data.id}`);
                  } else {
                    const errorData = await response.json().catch(() => ({ message: "Failed to start new mentorship term" }));
                    setError(errorData.message || "Failed to start new mentorship term");
                    setSending(false);
                  }
                } catch (error) {
                  console.error("Error starting new mentorship term:", error);
                  setError("Network error. Please try again.");
                  setSending(false);
                }
              }}
              disabled={sending || !conversationId}
              className="inline-flex items-center px-6 py-2.5 rounded-lg bg-[#734C23] text-white font-medium hover:bg-[#9C6A45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {sending ? "Starting..." : "Start New Mentorship Term"}
            </button>
          </div>
        ) : (
          <>
            {/* Reply Preview */}
            {replyingTo && (
              <div className="mb-2 px-3 py-2 bg-[#F4E2D4] border-l-2 border-[#9C6A45] rounded-lg flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#734C23] mb-0.5">
                    Replying to {replyingTo.senderId === currentUserId
                      ? "yourself"
                      : replyingTo.senderRole === "mentor"
                      ? "Mentor"
                      : "Mentee"}
                  </div>
                  <div className="text-xs text-[#6B7280] truncate">
                    {replyingTo.imageUrl ? "Image" : replyingTo.content || ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelReply}
                  className="flex-shrink-0 w-5 h-5 rounded-full hover:bg-[#CAAE92]/30 flex items-center justify-center transition-colors"
                  aria-label="Cancel reply"
                >
                  <svg className="w-4 h-4 text-[#734C23]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {/* Image Preview */}
            {imagePreview && (
          <div className="mb-2 relative inline-block">
            <div className="relative rounded-lg overflow-hidden border border-[#CAAE92] max-w-[200px]">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full max-h-[150px] object-contain"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 w-6 h-6 bg-[#734C23] text-white rounded-full flex items-center justify-center hover:bg-[#9C6A45] transition-colors"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          
          {/* Image upload button */}
          <button
            type="button"
            onClick={handleImageButtonClick}
            disabled={sending || uploadingImage || !!error}
            className="flex-shrink-0 w-11 h-11 sm:w-9 sm:h-9 rounded-lg bg-[#F4E2D4] hover:bg-[#CAAE92] text-[#734C23] flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            style={{ touchAction: 'manipulation' }}
            aria-label="Upload image"
          >
            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          
          <textarea
            ref={textareaRef}
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="flex-1 rounded-lg bg-[#F4E2D4] px-3 py-2.5 text-base sm:text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] transition-all resize-none overflow-y-auto min-h-[44px] sm:min-h-[36px] max-h-[120px]"
            style={{ 
              fontSize: '16px', // Prevent iOS zoom on focus
              touchAction: 'manipulation'
            }}
            maxLength={10000}
            disabled={sending || uploadingImage || !!error}
            rows={1}
          />
          <button
            type="submit"
            disabled={(!messageContent.trim() && !selectedImage) || sending || uploadingImage || !!error}
            className="rounded-lg bg-[#734C23] px-4 sm:px-5 py-2.5 text-base sm:text-sm text-white hover:bg-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-h-[44px] sm:min-h-[36px] touch-manipulation"
            style={{ touchAction: 'manipulation' }}
          >
            {uploadingImage ? "Uploading..." : sending ? "Sending..." : "Send"}
          </button>
        </form>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(ChatInterface);

