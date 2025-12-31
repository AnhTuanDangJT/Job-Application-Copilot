"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface InterviewPrep {
  id: string;
  conversationId: string;
  question: string;
  assessment?: "WEAK" | "AVERAGE" | "STRONG";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface InterviewPrepPanelProps {
  conversationId: string;
  userRole: "mentee" | "mentor";
}

export default function InterviewPrepPanel({ conversationId, userRole }: InterviewPrepPanelProps) {
  const [interviewPreps, setInterviewPreps] = useState<InterviewPrep[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [assessment, setAssessment] = useState<"WEAK" | "AVERAGE" | "STRONG" | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchInterviewPreps = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/interview-prep`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInterviewPreps(data.interviewPreps || []);
        setError(null);
      } else if (response.status === 401) {
        router.push("/auth/login");
      } else if (response.status === 403 || response.status === 404) {
        setError("Cannot access interview prep. Conversation may have been deleted.");
      } else {
        console.error("Failed to fetch interview preps");
        setError("Failed to load interview prep questions");
      }
    } catch (error) {
      console.error("Error fetching interview preps:", error);
      setError("Network error loading interview prep");
    } finally {
      setLoading(false);
    }
  }, [conversationId, router]);

  useEffect(() => {
    fetchInterviewPreps();
  }, [fetchInterviewPreps]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/mentor-communication/interview-prep/${editingId}`
        : `/api/mentor-communication/conversations/${conversationId}/interview-prep`;
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          question: question.trim(),
          assessment: assessment || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        setQuestion("");
        setAssessment("");
        setNotes("");
        setEditingId(null);
        setError(null);
        await fetchInterviewPreps();
      } else if (response.status === 401) {
        router.push("/auth/login");
      } else if (response.status === 403 || response.status === 404) {
        setError("Cannot submit interview prep. Conversation may have been deleted.");
      } else {
        const errorData = await response.json().catch(() => ({ message: "Failed to submit interview prep" }));
        setError(errorData.message || "Failed to submit interview prep");
      }
    } catch (error) {
      console.error("Error submitting interview prep:", error);
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (prep: InterviewPrep) => {
    setEditingId(prep.id);
    setQuestion(prep.question);
    setAssessment(prep.assessment || "");
    setNotes(prep.notes || "");
  };

  const handleCancel = () => {
    setEditingId(null);
    setQuestion("");
    setAssessment("");
    setNotes("");
  };

  const handleDelete = async (prepId: string) => {
    if (!confirm("Are you sure you want to delete this interview prep question?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/mentor-communication/interview-prep/${prepId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        await fetchInterviewPreps();
      } else {
        console.error("Failed to delete interview prep");
      }
    } catch (error) {
      console.error("Error deleting interview prep:", error);
    }
  };

  const getAssessmentBadge = (assessment?: "WEAK" | "AVERAGE" | "STRONG") => {
    if (!assessment) return null;

    const config = {
      WEAK: { label: "WEAK", color: "text-red-800", bgColor: "bg-red-100 border-red-300" },
      AVERAGE: { label: "AVERAGE", color: "text-yellow-800", bgColor: "bg-yellow-100 border-yellow-300" },
      STRONG: { label: "STRONG", color: "text-green-800", bgColor: "bg-green-100 border-green-300" },
    };

    const badgeConfig = config[assessment];
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeConfig.bgColor} ${badgeConfig.color}`}
      >
        {badgeConfig.label}
      </span>
    );
  };

  const { user } = useAuth();
  
  // Runtime guard: Mentor accounts must NEVER be admin
  if (user?.role === "mentor" && user?.isAdmin) {
    console.error("[InterviewPrepPanel] INVALID STATE: Mentor cannot be admin. Email:", user.email);
  }
  
  // Only grant mentor access if role is "mentor"
  // Admin users (isAdmin=true) should NOT have mentor access - they have separate admin UI
  const isMentor = userRole === "mentor";

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Interview Preparation</h2>

      {/* Submit/Edit Form (Mentor only) */}
      {isMentor && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
              placeholder="Enter an interview question..."
              maxLength={1000}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assessment (Optional)
            </label>
            <select
              value={assessment}
              onChange={(e) => setAssessment(e.target.value as "WEAK" | "AVERAGE" | "STRONG" | "")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
            >
              <option value="">No assessment</option>
              <option value="WEAK">Weak</option>
              <option value="AVERAGE">Average</option>
              <option value="STRONG">Strong</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 focus:border-[#9C6A45]"
              placeholder="Add notes or guidance for the mentee..."
              maxLength={10000}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !question.trim()}
              className="flex-1 rounded-lg bg-[#734C23] px-4 py-2 text-white hover:bg-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {submitting ? "Submitting..." : editingId ? "Update" : "Add Question"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* Interview Prep Questions List */}
      {error && !loading && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">{error}</p>
        </div>
      )}
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      ) : interviewPreps.length === 0 ? (
        <div className="text-center py-8">
          {isMentor ? (
            <p className="text-sm text-gray-600 mb-4">
              Add interview preparation questions to help the mentee practice.
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-4">
              Your mentor hasn't added any interview prep questions yet.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {interviewPreps.map((prep) => (
            <div
              key={prep.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {prep.question}
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    {getAssessmentBadge(prep.assessment)}
                  </div>
                  {prep.notes && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Notes:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-[#F4E2D4] p-2 rounded">
                        {prep.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {isMentor && (
                <div className="flex gap-2 pt-2 border-t border-gray-300">
                  <button
                    onClick={() => handleEdit(prep)}
                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(prep.id)}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


