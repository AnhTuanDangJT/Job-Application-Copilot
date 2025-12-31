"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Trash2, Download, Plus, Loader2 } from "lucide-react";

interface Reminder {
  id: string;
  conversationId: string;
  applicationId?: string;
  type: "follow-up" | "interview" | "thank-you";
  dueAt: string;
  createdBy: string;
  status: "pending" | "triggered" | "cancelled";
  createdAt: string;
}

interface RemindersPanelProps {
  conversationId: string;
  applicationId?: string;
}

interface ReminderCardProps {
  reminder: Reminder;
  onUpdate: (reminderId: string, type: string) => void;
  onDelete: (reminderId: string) => void;
  onDownloadCalendar: (reminderId: string) => void;
  getTypeLabel: (type: string) => string;
  getTypeColor: (type: string) => string;
  formatDateTime: (dateString: string) => string;
  getRelativeTime: (dateString: string) => string;
  isUpdating: boolean;
  isDeleting: boolean;
}

function ReminderCard({
  reminder,
  onUpdate,
  onDelete,
  onDownloadCalendar,
  getTypeLabel,
  getTypeColor,
  formatDateTime,
  getRelativeTime,
  isUpdating,
  isDeleting,
}: ReminderCardProps) {
  const [isEditingType, setIsEditingType] = useState(false);
  const [editedType, setEditedType] = useState<"follow-up" | "interview" | "thank-you">(reminder.type);

  // Sync editedType with reminder.type when reminder changes (e.g., after optimistic update)
  useEffect(() => {
    if (!isEditingType) {
      setEditedType(reminder.type);
    }
  }, [reminder.type, isEditingType]);

  const handleTypeChange = (newType: "follow-up" | "interview" | "thank-you") => {
    setEditedType(newType);
    if (newType !== reminder.type) {
      onUpdate(reminder.id, newType);
    }
    setIsEditingType(false);
  };

  const handleTypeClick = () => {
    if (!isUpdating && !isDeleting) {
      setIsEditingType(true);
      setEditedType(reminder.type);
    }
  };

  const handleTypeBlur = () => {
    setIsEditingType(false);
    setEditedType(reminder.type); // Reset to original if cancelled
  };

  return (
    <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Reminder Type - Editable */}
          <div className="mb-2">
            {isEditingType ? (
              <select
                value={editedType}
                onChange={(e) => {
                  const newType = e.target.value as "follow-up" | "interview" | "thank-you";
                  handleTypeChange(newType);
                }}
                onBlur={handleTypeBlur}
                autoFocus
                className={`text-xs font-medium px-2 py-1 rounded border border-[#CAAE92]/30 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${getTypeColor(editedType)}`}
              >
                <option value="follow-up">Follow-up</option>
                <option value="interview">Interview</option>
                <option value="thank-you">Thank-you</option>
              </select>
            ) : (
              <span
                onClick={handleTypeClick}
                className={`text-xs font-medium px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getTypeColor(reminder.type)}`}
                title="Click to edit type"
              >
                {getTypeLabel(reminder.type)}
              </span>
            )}
          </div>
          
          {/* Date & Time */}
          <div className="flex items-center gap-1.5 text-sm text-[#734C23] mb-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{formatDateTime(reminder.dueAt)}</span>
          </div>
          
          {/* Relative Time */}
          <div className="text-xs text-[#6B7280] mb-2">
            {getRelativeTime(reminder.dueAt)}
          </div>
          
          {/* Status */}
          <div className="inline-flex items-center">
            <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">
              Upcoming
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onDownloadCalendar(reminder.id)}
            className="p-1.5 rounded hover:bg-[#F4E2D4] transition-colors"
            title="Download calendar"
          >
            <Download className="w-3.5 h-3.5 text-[#734C23]" />
          </button>
          <button
            onClick={() => onDelete(reminder.id)}
            disabled={isDeleting}
            className="p-1.5 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
            title="Delete reminder"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RemindersPanel({ conversationId, applicationId }: RemindersPanelProps) {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "follow-up" as "follow-up" | "interview" | "thank-you",
    dueAt: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch reminders
  const { data, isLoading } = useQuery<{ reminders: Reminder[] }>({
    queryKey: ["reminders", conversationId, applicationId],
    queryFn: async () => {
      const params = new URLSearchParams({ conversationId });
      if (applicationId) params.append("applicationId", applicationId);
      const res = await fetch(`/api/reminders?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch reminders");
      return res.json();
    },
  });

  // Create reminder mutation
  const createMutation = useMutation({
    mutationFn: async (reminder: { type: string; dueAt: string }) => {
      try {
        // Ensure dueAt is in ISO format (should already be converted, but double-check)
        const isoDueAt = reminder.dueAt.includes('T') && reminder.dueAt.includes('Z') 
          ? reminder.dueAt 
          : new Date(reminder.dueAt).toISOString();
        
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            conversationId,
            applicationId,
            type: reminder.type,
            dueAt: isoDueAt,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: "Failed to create reminder" }));
          throw new Error(errorData.message || `Failed to create reminder (${res.status})`);
        }
        const data = await res.json();
        console.log("Reminder API response:", data);
        return data.reminder || data; // Handle both { reminder } and direct response
      } catch (error) {
        console.error("Reminder creation fetch error:", error);
        throw error;
      }
    },
    onSuccess: (newReminder) => {
      console.log("Reminder created successfully:", newReminder);
      
      // Immediately update the cache with the new reminder (instant UI update)
      const queryKey = ["reminders", conversationId, applicationId];
      queryClient.setQueryData<{ reminders: Reminder[] }>(queryKey, (oldData) => {
        if (!oldData) {
          return { reminders: [newReminder] };
        }
        // Add new reminder to the beginning of the list for immediate visibility
        return {
          reminders: [newReminder, ...oldData.reminders],
        };
      });
      
      // Also invalidate to ensure we have the latest data from server
      queryClient.invalidateQueries({ queryKey });
      
      // Clear form and close
      setCreateError(null);
      setShowCreateForm(false);
      setFormData({ type: "follow-up", dueAt: "" });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create reminder";
      setCreateError(errorMessage);
      console.error("Reminder creation mutation error:", error);
    },
  });

  // Update reminder mutation
  const updateMutation = useMutation({
    mutationFn: async ({ reminderId, type }: { reminderId: string; type: string }) => {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to update reminder" }));
        throw new Error(errorData.message || `Failed to update reminder (${res.status})`);
      }
      return res.json();
    },
    onMutate: async ({ reminderId, type }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["reminders", conversationId, applicationId] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{ reminders: Reminder[] }>([
        "reminders",
        conversationId,
        applicationId,
      ]);

      // Optimistically update to the new value
      if (previousData) {
        queryClient.setQueryData<{ reminders: Reminder[] }>(
          ["reminders", conversationId, applicationId],
          {
            reminders: previousData.reminders.map((r) =>
              r.id === reminderId ? { ...r, type: type as Reminder["type"] } : r
            ),
          }
        );
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          ["reminders", conversationId, applicationId],
          context.previousData
        );
      }
      console.error("Update reminder error:", err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders", conversationId, applicationId] });
    },
  });

  // Delete reminder mutation
  const deleteMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders", conversationId, applicationId] });
    },
  });

  const reminders = data?.reminders || [];
  // Filter for pending reminders (upcoming ones that haven't been triggered or cancelled)
  // Also include reminders with status "upcoming" if the API uses that instead of "pending"
  const pendingReminders = reminders.filter((r) => 
    r.status === "pending" || r.status === "upcoming"
  );

  const handleCreate = (e?: React.MouseEvent) => {
    // Prevent any form submission if called from button click
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Clear previous errors
    setCreateError(null);
    
    // Validate type
    if (!formData.type || (formData.type !== "follow-up" && formData.type !== "interview" && formData.type !== "thank-you")) {
      setCreateError("Please select a valid reminder type");
      console.error("Reminder creation validation failed: invalid type", formData.type);
      return;
    }
    
    // Validate dueAt exists and is parseable
    if (!formData.dueAt || formData.dueAt.trim() === "") {
      setCreateError("Please select a due date and time");
      console.error("Reminder creation validation failed: missing dueAt");
      return;
    }
    
    // Validate date is parseable
    const dueDate = new Date(formData.dueAt);
    if (isNaN(dueDate.getTime()) || dueDate.toString() === "Invalid Date") {
      setCreateError("Invalid date format. Please select a valid date and time");
      console.error("Reminder creation validation failed: unparseable date", formData.dueAt);
      return;
    }
    
    // Validate date is in the future
    if (dueDate.getTime() <= Date.now()) {
      setCreateError("Due date must be in the future");
      console.error("Reminder creation validation failed: date in past", formData.dueAt);
      return;
    }
    
    // Convert to ISO format for API
    const isoDueAt = dueDate.toISOString();
    
    // All validations passed, create reminder with ISO datetime
    createMutation.mutate({
      type: formData.type,
      dueAt: isoDueAt,
    }, {
      onError: (error) => {
        const errorMessage = error instanceof Error ? error.message : "Failed to create reminder";
        setCreateError(errorMessage);
        console.error("Reminder creation API error:", error);
      },
    });
  };

  const handleDownloadCalendar = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}/calendar`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to download calendar");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reminder-${reminderId}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download calendar:", error);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      "follow-up": "Follow-up",
      interview: "Interview",
      "thank-you": "Thank-you",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "follow-up": "bg-[#F4E2D4] text-[#734C23]",
      interview: "bg-purple-100 text-purple-800",
      "thank-you": "bg-green-100 text-green-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  // Format date as "Dec 29, 2025 · 4:24PM"
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart} · ${timePart}`;
  };

  // Calculate relative time (e.g., "in 2 days", "in 3 hours")
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const dueDate = new Date(dateString);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `in ${diffDays} ${diffDays === 1 ? "day" : "days"}`;
    } else if (diffHours > 0) {
      return `in ${diffHours} ${diffHours === 1 ? "hour" : "hours"}`;
    } else if (diffMinutes > 0) {
      return `in ${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"}`;
    } else {
      return "overdue";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#734C23] flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Reminders
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="p-1.5 rounded-lg bg-[#F4E2D4] text-[#734C23] hover:bg-[#E8D4C4] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[#734C23] block mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => {
                setFormData({ ...formData, type: e.target.value as any });
                setCreateError(null); // Clear error on change
              }}
              className="w-full px-3 py-2 text-sm border border-[#CAAE92]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
            >
              <option value="follow-up">Follow-up</option>
              <option value="interview">Interview</option>
              <option value="thank-you">Thank-you</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#734C23] block mb-1">Due Date & Time</label>
            <input
              type="datetime-local"
              value={formData.dueAt}
              onChange={(e) => {
                setFormData({ ...formData, dueAt: e.target.value });
                setCreateError(null); // Clear error on change
              }}
              className="w-full px-3 py-2 text-sm border border-[#CAAE92]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
            />
          </div>
          
          {/* Error Message */}
          {createError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2">
              <p className="text-xs text-red-800">{createError}</p>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-[#734C23] text-white hover:bg-[#9C6A45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ type: "follow-up", dueAt: "" });
                setCreateError(null);
              }}
              className="px-3 py-2 text-sm rounded-lg border border-[#CAAE92]/30 text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reminders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#9C6A45]" />
        </div>
      ) : pendingReminders.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#6B7280]">
          No pending reminders. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {pendingReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onUpdate={(reminderId, type) => updateMutation.mutate({ reminderId, type })}
              onDelete={(reminderId) => deleteMutation.mutate(reminderId)}
              onDownloadCalendar={handleDownloadCalendar}
              getTypeLabel={getTypeLabel}
              getTypeColor={getTypeColor}
              formatDateTime={formatDateTime}
              getRelativeTime={getRelativeTime}
              isUpdating={updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

