"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/lib/adminConfig";

/**
 * 🔐 SUPER ADMIN RESET BUTTON
 * 
 * This component provides a button to reset all user accounts.
 * It is ONLY visible to the super admin email: dangtuananh04081972@gmail.com
 * 
 * ⚠️ HARD RULE: Email-based authorization only - do NOT rely on role
 * 
 * Behavior:
 * - Shows confirmation modal before reset
 * - Calls /api/dev/reset-users
 * - Clears client storage on success
 * - Forces page reload and redirects to /signup
 */
export default function DevResetButton() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Only render for super admin email - strict email-based authorization
  if (!isSuperAdmin(user?.email)) {
    return null;
  }

  const handleReset = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dev/reset-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reset failed");
      }

      // Clear client storage
      if (typeof window !== "undefined") {
        // Clear localStorage
        localStorage.clear();
        // Clear sessionStorage
        sessionStorage.clear();
        // Clear any cookies (client-side)
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }

      // Close modal
      setShowModal(false);

      // Force page reload and redirect to signup
      window.location.href = "/auth/signup";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Reset Button */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
        title="Reset All Accounts (DEV ONLY)"
      >
        <Trash2 className="w-4 h-4" />
        <span>Reset All Accounts (DEV)</span>
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Reset All Accounts
              </h2>
            </div>

            <p className="text-gray-700 mb-6">
              This will permanently delete <strong>ALL accounts</strong> and all associated data:
            </p>

            <ul className="list-disc list-inside text-sm text-gray-600 mb-6 space-y-1">
              <li>All user accounts</li>
              <li>All conversations and messages</li>
              <li>All groups and notifications</li>
              <li>All resumes and applications</li>
              <li>All mentor/mentee relations</li>
              <li>All sessions (you will be logged out)</li>
            </ul>

            <p className="text-red-600 font-medium mb-6">
              ⚠️ This action cannot be undone. Continue?
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Everything</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

