"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

interface GenerateSkillsGapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (role: string) => Promise<void>;
  isLoading?: boolean;
}

export default function GenerateSkillsGapModal({
  isOpen,
  onClose,
  onGenerate,
  isLoading = false,
}: GenerateSkillsGapModalProps) {
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setRole("");
      setError(null);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, isLoading]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const trimmedRole = role.trim();
    if (!trimmedRole) {
      setError("Please enter a target role");
      return;
    }

    setError(null);
    try {
      await onGenerate(trimmedRole);
      // Don't close modal here - let the parent component handle it after success
    } catch (err) {
      // Error is already handled in parent component, but we can show it here too
      setError(err instanceof Error ? err.message : "Failed to generate report");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 max-w-md w-full h-full md:h-auto md:max-h-[90vh] flex flex-col animate-in">
        <div className="p-4 md:p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">Generate Skills Gap Report</h2>
              <p className="text-sm text-[#6B7280] mt-1">Enter a target role to analyze your skills match</p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 p-4 md:p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Target Role
                </label>
                <input
                  id="role"
                  type="text"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Backend Engineer, Data Scientist, Product Manager"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 md:py-2.5 text-base md:text-sm text-gray-900 placeholder-gray-400 focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/40 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  disabled={isLoading}
                  autoFocus
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter any job role to analyze your skills match against typical requirements for that position.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-[#CAAE92]/30 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 flex-shrink-0 bg-[#F8F5F2]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full md:w-auto px-6 py-4 md:py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !role.trim()}
              className="w-full md:w-auto px-6 py-4 md:py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2 min-h-[44px] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

