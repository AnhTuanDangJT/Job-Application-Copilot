"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface StartConversationModalProps {
  userRole: "mentee" | "mentor" | "admin";
  isOpen: boolean;
  onClose: () => void;
}

export default function StartConversationModal({
  userRole,
  isOpen,
  onClose,
}: StartConversationModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartConversation(e: React.FormEvent) {
    e.preventDefault();
    
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/conversations/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/mentor-communication/${data.id}`);
        router.refresh();
        onClose();
        setEmail("");
      } else {
        // Generic error message - don't reveal specific failure reasons
        setError("Unable to start conversation");
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
      setError("Unable to start conversation");
    } finally {
      setCreating(false);
    }
  }

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

  if (!isOpen) return null;

  const targetRoleLabel = userRole === "mentor" ? "Mentee" : "Mentor";

  return (
    <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 max-w-md w-full h-full md:h-auto md:max-h-[90vh] flex flex-col animate-in">
        <div className="p-4 md:p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">Start Conversation</h2>
              <p className="text-sm text-[#6B7280] mt-1">Enter the email address of the {targetRoleLabel.toLowerCase()} you want to start a conversation with</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleStartConversation} className="flex-1 flex flex-col">
          <div className="flex-1 p-4 md:p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4 md:space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="mentor@example.com or mentee@example.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 md:py-2.5 text-base md:text-sm text-gray-900 placeholder-gray-400 focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/40 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  disabled={creating}
                  autoFocus
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter the email address of the {targetRoleLabel.toLowerCase()} you want to start a conversation with.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-[#CAAE92]/30 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 flex-shrink-0 bg-[#F8F5F2]">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="w-full md:w-auto px-6 py-4 md:py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !email.trim()}
              className="w-full md:w-auto px-6 py-4 md:py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 min-h-[44px]"
            >
              {creating ? "Starting..." : "Start Conversation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
