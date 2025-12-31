"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface ActionItem {
  text: string;
  done: boolean;
}

interface Feedback {
  id: string;
  conversationId: string;
  resumeShareId: string;
  mentorId: string;
  menteeId: string;
  feedbackText?: string;
  strengths?: string;
  issues?: string;
  actionItems?: ActionItem[];
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

interface Resume {
  id: string;
  originalName: string;
}

interface FeedbackPanelProps {
  conversationId: string;
  userRole: "mentee" | "mentor";
  onFeedbackSubmitted?: () => void;
}

function FeedbackPanel({ conversationId, userRole, onFeedbackSubmitted }: FeedbackPanelProps) {
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [feedbackText, setFeedbackText] = useState("");
  const [strengths, setStrengths] = useState("");
  const [issues, setIssues] = useState("");
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [newActionItem, setNewActionItem] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Runtime guard: Mentor accounts must NEVER be admin
  if (user?.role === "mentor" && user?.isAdmin) {
    console.error("[FeedbackPanel] INVALID STATE: Mentor cannot be admin. Email:", user.email);
  }
  
  // Only grant mentor access if role is "mentor"
  // Admin users (isAdmin=true) should NOT have mentor access - they have separate admin UI
  const hasMentorAccess = userRole === "mentor";

  // Use React Query for feedbacks with caching
  const { data: feedbacksData, isLoading: loadingFeedbacks, error: feedbacksError } = useQuery<{ feedbacks: Feedback[] }>({
    queryKey: ["feedback", conversationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/feedback`,
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        router.push("/auth/login");
        throw new Error("Unauthorized");
      } else if (response.status === 403 || response.status === 404) {
        throw new Error("Cannot access feedback. Conversation may have been deleted.");
      } else if (!response.ok) {
        throw new Error("Failed to load feedback");
      }

      return response.json();
    },
    staleTime: 60_000, // Cache for 60 seconds
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  // Use React Query for resumes with caching (only for mentors)
  const { data: resumesData } = useQuery<{ resumes: Resume[] }>({
    queryKey: ["resumes", conversationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/resumes`,
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        router.push("/auth/login");
        throw new Error("Unauthorized");
      } else if (!response.ok) {
        return { resumes: [] };
      }

      return response.json();
    },
    staleTime: 60_000, // Cache for 60 seconds
    placeholderData: (previousData) => previousData,
    enabled: hasMentorAccess, // Only fetch for mentors (or super admin)
    retry: 1,
  });

  const feedbacks = feedbacksData?.feedbacks || [];
  const resumes = resumesData?.resumes || [];
  const loading = loadingFeedbacks;
  const feedbacksErrorMessage = feedbacksError ? (feedbacksError as Error).message : null;

  // Use React Query mutation for submitting feedback
  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: {
      resumeShareId: string;
      feedbackText?: string;
      strengths?: string;
      issues?: string;
      actionItems?: string[];
      rating?: number;
    }) => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(data),
        }
      );

      if (response.status === 401) {
        router.push("/auth/login");
        throw new Error("Unauthorized");
      } else if (response.status === 403 || response.status === 404) {
        throw new Error("Cannot submit feedback. Conversation may have been deleted.");
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to submit feedback" }));
        throw new Error(errorData.message || "Failed to submit feedback");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch feedbacks and progress
      queryClient.invalidateQueries({ queryKey: ["feedback", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["progress", conversationId] });
      
      setSelectedResumeId("");
      setFeedbackText("");
      setStrengths("");
      setIssues("");
      setActionItems([]);
      setRating(undefined);
      setError(null);
      
      // Trigger progress refresh after successful feedback submission
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    },
    onError: (error: Error) => {
      setError(error.message || "Network error. Please try again.");
    },
  });

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResumeId) return;
    
    // Must have at least feedbackText, or strengths/issues, or actionItems
    const hasContent = feedbackText.trim() || strengths.trim() || issues.trim() || actionItems.length > 0;
    if (!hasContent) return;

    setError(null);
    submitFeedbackMutation.mutate({
      resumeShareId: selectedResumeId,
      feedbackText: feedbackText.trim() || undefined,
      strengths: strengths.trim() || undefined,
      issues: issues.trim() || undefined,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
      rating: rating,
    });
  };

  const submitting = submitFeedbackMutation.isPending;

  const handleAddActionItem = () => {
    if (newActionItem.trim() && actionItems.length < 20) {
      setActionItems([...actionItems, newActionItem.trim()]);
      setNewActionItem("");
    }
  };

  const handleRemoveActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  // Use React Query mutation for toggling action items
  const toggleActionItemMutation = useMutation({
    mutationFn: async ({ feedbackId, index, done }: { feedbackId: string; index: number; done: boolean }) => {
      const response = await fetch(
        `/api/mentor-communication/feedback/${feedbackId}/action-items`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            index,
            done,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to toggle action item");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch feedbacks and progress
      queryClient.invalidateQueries({ queryKey: ["feedback", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["progress", conversationId] });
      
      // Trigger progress refresh after action item toggle (affects action item progress)
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    },
  });

  const handleToggleActionItem = async (feedbackId: string, index: number, currentDone: boolean) => {
    toggleActionItemMutation.mutate({
      feedbackId,
      index,
      done: !currentDone,
    });
  };

  const getRatingStars = (rating?: number) => {
    if (!rating) return null;
    return "⭐".repeat(rating);
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Feedback</h2>

      {/* Submit Feedback Form (Mentor only) */}
      {hasMentorAccess ? (
        <form onSubmit={handleSubmitFeedback} className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Resume
            </label>
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
              required
            >
              <option value="">Choose a resume...</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.originalName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Strengths (Optional)
            </label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
              placeholder="What are the strengths of this resume?"
              maxLength={5000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issues/Areas for Improvement (Optional)
            </label>
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
              placeholder="What areas need improvement?"
              maxLength={5000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action Items
            </label>
            <div className="space-y-2">
              {actionItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    readOnly
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveActionItem(index)}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newActionItem}
                  onChange={(e) => setNewActionItem(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddActionItem();
                    }
                  }}
                  placeholder="Add an action item..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
                  maxLength={500}
                />
                <button
                  type="button"
                  onClick={handleAddActionItem}
                  disabled={!newActionItem.trim() || actionItems.length >= 20}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rating (Optional)
            </label>
            <select
              value={rating || ""}
              onChange={(e) =>
                setRating(e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
            >
              <option value="">No rating</option>
              <option value="1">1 ⭐</option>
              <option value="2">2 ⭐⭐</option>
              <option value="3">3 ⭐⭐⭐</option>
              <option value="4">4 ⭐⭐⭐⭐</option>
              <option value="5">5 ⭐⭐⭐⭐⭐</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !selectedResumeId || (!feedbackText.trim() && !strengths.trim() && !issues.trim() && actionItems.length === 0)}
            className="w-full rounded-lg bg-[#734C23] px-4 py-2 text-white hover:bg-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      ) : null}

      {/* Feedback List */}
      {feedbacksErrorMessage && !loading && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">{feedbacksErrorMessage}</p>
        </div>
      )}
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-8">
          {hasMentorAccess ? (
            <p className="text-sm text-gray-600 mb-4">
              Select a resume to provide structured feedback and action items.
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-4">
              Once your mentor reviews a resume, feedback will appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(feedback.createdAt).toLocaleDateString()}
                  </p>
                  {feedback.rating && (
                    <p className="text-sm text-gray-600 mt-1">
                      {getRatingStars(feedback.rating)}
                    </p>
                  )}
                </div>
              </div>
              
              {feedback.strengths && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Strengths:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-green-50 p-2 rounded">
                    {feedback.strengths}
                  </p>
                </div>
              )}
              
              {feedback.issues && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Areas for Improvement:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-yellow-50 p-2 rounded">
                    {feedback.issues}
                  </p>
                </div>
              )}

              {feedback.feedbackText && (
                <div className="mb-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {feedback.feedbackText}
                  </p>
                </div>
              )}

              {feedback.actionItems && feedback.actionItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Action Items:</p>
                  <div className="space-y-2">
                    {feedback.actionItems.map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        {userRole === "mentee" ? (
                          <button
                            onClick={() => handleToggleActionItem(feedback.id, index, item.done)}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              item.done
                                ? "bg-green-600 border-green-600"
                                : "border-gray-300 hover:border-green-500"
                            }`}
                          >
                            {item.done && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                            item.done
                              ? "bg-green-600 border-green-600"
                              : "border-gray-300"
                          }`}>
                            {item.done && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        )}
                        <p className={`text-sm flex-1 ${item.done ? "text-gray-500 line-through" : "text-gray-700"}`}>
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(FeedbackPanel);

