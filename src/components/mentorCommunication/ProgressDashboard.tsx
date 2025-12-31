"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface ProgressData {
  resumesUploaded: number;
  resumesReviewed: number;
  resumeProgress: number;
  totalActionItems: number;
  completedActionItems: number;
  actionItemProgress: number;
  interviewPrepQuestions: number;
  interviewPrepStrong: number;
  interviewPrepProgress: number;
  overallProgress: number;
  hasOverride?: boolean;
}

interface ProgressDashboardProps {
  conversationId: string;
  userRole: "mentee" | "mentor";
  refreshTrigger?: number;
}

function ProgressDashboard({ conversationId, userRole, refreshTrigger }: ProgressDashboardProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Edit mode state
  const [editOverallPercent, setEditOverallPercent] = useState(0);
  const [editResumeReviewed, setEditResumeReviewed] = useState(false);
  const [editActionItemsCompleted, setEditActionItemsCompleted] = useState(0);
  
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Runtime guard: Mentor accounts must NEVER be admin
  if (user?.role === "mentor" && user?.isAdmin) {
    console.error("[ProgressDashboard] INVALID STATE: Mentor cannot be admin. Email:", user.email);
  }
  
  // Only grant mentor access if role is "mentor"
  // Admin users (isAdmin=true) should NOT have mentor access - they have separate admin UI
  const isMentor = userRole === "mentor";

  // Use React Query for data fetching with caching
  const { data: progress, isLoading: loading, error: queryError, refetch } = useQuery<ProgressData>({
    queryKey: ["progress", conversationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/progress`,
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        router.push("/auth/login");
        throw new Error("Unauthorized");
      } else if (response.status === 403 || response.status === 404) {
        throw new Error("Cannot access progress. Conversation may have been deleted.");
      } else if (!response.ok) {
        throw new Error("Failed to load progress");
      }

      return response.json();
    },
    staleTime: 60_000, // Data is fresh for 60 seconds
    refetchInterval: 60_000, // Refetch every 60 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
    retry: 1,
  });

  const error = queryError ? (queryError as Error).message : null;

  // Initialize edit values when progress loads
  useEffect(() => {
    if (progress) {
      setEditOverallPercent(progress.overallProgress);
      setEditResumeReviewed(progress.resumesReviewed > 0);
      setEditActionItemsCompleted(progress.completedActionItems);
    }
  }, [progress]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  // Update edit values when progress changes
  useEffect(() => {
    if (progress) {
      setEditOverallPercent(progress.overallProgress);
      setEditResumeReviewed(progress.resumesReviewed > 0);
      setEditActionItemsCompleted(progress.completedActionItems);
    }
  }, [progress]);

  const handleEditClick = () => {
    if (progress) {
      setEditOverallPercent(progress.overallProgress);
      setEditResumeReviewed(progress.resumesReviewed > 0);
      setEditActionItemsCompleted(progress.completedActionItems);
      setIsEditMode(true);
      setSaveError(null);
    }
  };

  const handleCancel = () => {
    if (progress) {
      setEditOverallPercent(progress.overallProgress);
      setEditResumeReviewed(progress.resumesReviewed > 0);
      setEditActionItemsCompleted(progress.completedActionItems);
    }
    setIsEditMode(false);
    setSaveError(null);
  };

  // Use React Query mutation for saving
  const saveMutation = useMutation({
    mutationFn: async (data: {
      overallPercent: number;
      resumeReviewed: boolean;
      actionItemsCompleted: number;
    }) => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/progress`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            overallPercent: data.overallPercent,
            resumeReviewed: data.resumeReviewed,
            actionItemsCompleted: data.actionItemsCompleted,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save progress");
      }

      return response.json();
    },
    onSuccess: () => {
      setIsEditMode(false);
      // Invalidate and refetch progress
      queryClient.invalidateQueries({ queryKey: ["progress", conversationId] });
    },
    onError: (error: Error) => {
      setSaveError(error.message || "Network error saving progress");
    },
  });

  const handleSave = async () => {
    if (!progress) return;
    setSaveError(null);
    saveMutation.mutate({
      overallPercent: editOverallPercent,
      resumeReviewed: editResumeReviewed,
      actionItemsCompleted: editActionItemsCompleted,
    });
  };

  const saving = saveMutation.isPending;

  const ProgressBar = ({ value, label }: { value: number; label: string }) => (
    <div className="mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-[#734C23] h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        ></div>
      </div>
    </div>
  );

  const ChecklistItem = ({ completed, total, label }: { completed: number; total: number; label: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {completed === total && total > 0 ? (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
        )}
        <span className="text-xs text-gray-700">{label}</span>
      </div>
      <span className="text-xs text-gray-600">
        {completed}/{total}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Progress Summary</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Progress Summary</h2>
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-3">
      {/* Header with Edit Button (Mentor only) */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-gray-900">Progress Summary</h2>
        {isMentor && !isEditMode && (
          <button
            onClick={handleEditClick}
            className="flex items-center gap-1 text-xs text-[#734C23] hover:text-[#9C6A45] hover:underline transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Progress
          </button>
        )}
        {!isMentor && (
          <span className="text-xs text-gray-500 italic">Progress managed by mentor</span>
        )}
      </div>

      {/* Override Badge */}
      {progress.hasOverride && (
        <div className="mb-4 p-2 bg-[#F4E2D4] border border-[#CAAE92] rounded-md">
          <p className="text-xs text-[#734C23]">
            <span className="font-medium">Mentor adjusted</span> — Progress values have been manually set
          </p>
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{saveError}</p>
        </div>
      )}

      {isEditMode ? (
        /* EDIT MODE - Mentor Only */
        <div className="space-y-6">
          {/* Overall Progress Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-base font-semibold text-gray-900">Overall Progress</label>
              <span className="text-lg font-bold text-[#734C23]">{editOverallPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={editOverallPercent}
              onChange={(e) => setEditOverallPercent(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#734C23]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Resume Review Toggle */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-2 block">Resume Review</label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">Reviewed:</span>
              <button
                type="button"
                onClick={() => setEditResumeReviewed(!editResumeReviewed)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editResumeReviewed ? "bg-[#734C23]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editResumeReviewed ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">
                {editResumeReviewed ? "Yes" : "No"}
              </span>
            </div>
          </div>

          {/* Action Items Completed */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-2 block">
              Action Items Completed
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max={progress.totalActionItems}
                value={editActionItemsCompleted}
                onChange={(e) => {
                  const value = Math.max(0, Math.min(progress.totalActionItems, Number(e.target.value)));
                  setEditActionItemsCompleted(value);
                }}
                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
              />
              <span className="text-sm text-gray-600">/ {progress.totalActionItems}</span>
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[#734C23] text-white rounded-md hover:bg-[#9C6A45] disabled:bg-[#CAAE92] disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* READ-ONLY MODE */
        <>
          {/* Overall Progress */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
              <span className="text-base font-bold text-gray-900">{progress.overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-[#734C23] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress.overallProgress))}%` }}
              ></div>
            </div>
          </div>

          {/* Detailed Progress */}
          <div className="space-y-3">
            {/* Resume Progress */}
            <div>
              <h3 className="text-base font-bold text-gray-800 mb-1.5">Resume Review</h3>
              <ProgressBar value={progress.resumeProgress} label="Resumes Reviewed" />
              <ChecklistItem
                completed={progress.resumesReviewed}
                total={progress.resumesUploaded}
                label="Resumes reviewed"
              />
            </div>

            {/* Action Items Progress */}
            {progress.totalActionItems > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-1.5">Action Items</h3>
                <ProgressBar value={progress.actionItemProgress} label="Action Items Completed" />
                <ChecklistItem
                  completed={progress.completedActionItems}
                  total={progress.totalActionItems}
                  label="Action items completed"
                />
              </div>
            )}

            {/* Interview Prep Progress */}
            {progress.interviewPrepQuestions > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-1.5">Interview Preparation</h3>
                <ProgressBar value={progress.interviewPrepProgress} label="Strong Assessments" />
                <ChecklistItem
                  completed={progress.interviewPrepStrong}
                  total={progress.interviewPrepQuestions}
                  label="Strong interview answers"
                />
              </div>
            )}

            {/* Empty State */}
            {progress.resumesUploaded === 0 && 
             progress.totalActionItems === 0 && 
             progress.interviewPrepQuestions === 0 && (
              <div className="text-left py-1 text-xs text-gray-500">
                No progress data yet. Start by uploading a resume or getting feedback.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(ProgressDashboard);
