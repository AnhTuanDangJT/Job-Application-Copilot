"use client";

import { useState, useEffect } from "react";

interface ConversationContextCardProps {
  conversationId: string;
  mentorName: string;
  menteeName: string;
  mentorRole: string;
  menteeRole: string;
  initialGoal?: string;
  initialFocusAreas?: string[];
  initialSessionType?: "RESUME" | "INTERVIEW" | "JOB_SEARCH";
  initialStatus?: "ACTIVE" | "COMPLETED";
  userRole: "mentee" | "mentor" | "admin";
}

const FOCUS_AREAS = ["Resume", "Interview", "Job Search", "Networking"];

function RoleBadge({ role }: { role: string }) {
  const badgeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    mentee: { label: "MENTEE", color: "text-green-800", bgColor: "bg-green-100 border-green-300" },
    mentor: { label: "MENTOR", color: "text-[#734C23]", bgColor: "bg-[#F4E2D4] border-[#CAAE92]" },
    admin: { label: "ADMIN", color: "text-red-800", bgColor: "bg-red-100 border-red-300" },
  };

  const config = badgeConfig[role] || {
    label: role.toUpperCase(),
    color: "text-gray-800",
    bgColor: "bg-gray-100 border-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.bgColor} ${config.color}`}
    >
      {config.label}
    </span>
  );
}

export default function ConversationContextCard({
  conversationId,
  mentorName,
  menteeName,
  mentorRole,
  menteeRole,
  initialGoal,
  initialFocusAreas,
  initialSessionType,
  initialStatus,
  userRole,
}: ConversationContextCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [goal, setGoal] = useState(initialGoal || "Improve resume and job readiness");
  const [focusAreas, setFocusAreas] = useState<string[]>(initialFocusAreas || ["Resume"]);
  const [sessionType, setSessionType] = useState<"RESUME" | "INTERVIEW" | "JOB_SEARCH">(
    initialSessionType || "RESUME"
  );
  const [status, setStatus] = useState<"ACTIVE" | "COMPLETED">(initialStatus || "ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setGoal(initialGoal || "Improve resume and job readiness");
    setFocusAreas(initialFocusAreas || ["Resume"]);
    setSessionType(initialSessionType || "RESUME");
    setStatus(initialStatus || "ACTIVE");
  }, [initialGoal, initialFocusAreas, initialSessionType, initialStatus]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            goal: goal.trim(),
            focusAreas,
            sessionType,
            status,
          }),
        }
      );

      if (response.ok) {
        setSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errorData = await response.json().catch(() => ({ message: "Failed to update conversation" }));
        setError(errorData.message || "Failed to update conversation");
      }
    } catch (error) {
      console.error("Error updating conversation:", error);
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    if (focusAreas.includes(area)) {
      setFocusAreas(focusAreas.filter((a) => a !== area));
    } else {
      setFocusAreas([...focusAreas, area]);
    }
  };

  const getStatusBadge = () => {
    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
          COMPLETED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
        ACTIVE
      </span>
    );
  };

  const getSessionTypeLabel = (type: "RESUME" | "INTERVIEW" | "JOB_SEARCH") => {
    const labels = {
      RESUME: "Resume Review",
      INTERVIEW: "Interview Prep",
      JOB_SEARCH: "Job Search",
    };
    return labels[type];
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Mentorship Session</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-600">Type:</span>
            {!isEditing ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-[#F4E2D4] text-[#734C23] border border-[#CAAE92]">
                {getSessionTypeLabel(sessionType)}
              </span>
            ) : (
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as "RESUME" | "INTERVIEW" | "JOB_SEARCH")}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
              >
                <option value="RESUME">Resume Review</option>
                <option value="INTERVIEW">Interview Prep</option>
                <option value="JOB_SEARCH">Job Search</option>
              </select>
            )}
            <span className="text-sm text-gray-600 ml-2">Status:</span>
            {!isEditing ? (
              getStatusBadge()
            ) : (
              <select
                value={status}
                onChange={(e) => {
                  // Only mentor can set status to COMPLETED
                  if (e.target.value === "COMPLETED" && userRole !== "mentor" && userRole !== "admin") {
                    return;
                  }
                  setStatus(e.target.value as "ACTIVE" | "COMPLETED");
                }}
                disabled={userRole !== "mentor" && userRole !== "admin"}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            )}
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-[#734C23] hover:text-[#9C6A45] font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {/* Participants */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 w-20">Mentor:</span>
          <span className="text-sm text-gray-900">{mentorName}</span>
          <RoleBadge role={mentorRole} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 w-20">Mentee:</span>
          <span className="text-sm text-gray-900">{menteeName}</span>
          <RoleBadge role={menteeRole} />
        </div>
      </div>

      {/* Session Goal */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Session Goal</label>
        {isEditing ? (
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
            placeholder="Resume review & job search strategy"
            maxLength={500}
          />
        ) : (
          <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{goal}</p>
        )}
      </div>

      {/* Focus Areas */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Focus Areas</label>
        {isEditing ? (
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((area) => (
              <button
                key={area}
                onClick={() => toggleFocusArea(area)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  focusAreas.includes(area)
                    ? "bg-[#734C23] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {focusAreas.length > 0 ? (
              focusAreas.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1 bg-[#F4E2D4] text-[#734C23] rounded-full text-sm font-medium"
                >
                  {area}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No focus areas set</span>
            )}
          </div>
        )}
      </div>

      {/* Edit Actions */}
      {isEditing && (
        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={handleSave}
            disabled={saving || !goal.trim()}
            className="flex-1 rounded-lg bg-[#734C23] px-4 py-2 text-white hover:bg-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setGoal(initialGoal || "Improve resume and job readiness");
              setFocusAreas(initialFocusAreas || ["Resume"]);
              setSessionType(initialSessionType || "RESUME");
              setStatus(initialStatus || "ACTIVE");
              setError(null);
            }}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">Conversation updated successfully</p>
        </div>
      )}
    </div>
  );
}

