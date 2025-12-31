"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Plus, X } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  menteeName: string;
  menteeEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface TasksSectionProps {
  menteeEmail?: string;
}

export default function TasksSection({ menteeEmail: initialMenteeEmail }: TasksSectionProps = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    menteeEmail: initialMenteeEmail || "",
    title: "",
    description: "",
  });

  // Update menteeEmail when prop changes
  useEffect(() => {
    if (initialMenteeEmail && !showForm) {
      setFormData((prev) => ({ ...prev, menteeEmail: initialMenteeEmail }));
    }
  }, [initialMenteeEmail, showForm]);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks", {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch tasks" }));
        console.error("Failed to fetch tasks", errorData);
        setTasks([]);
        return;
      }
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          menteeEmail: formData.menteeEmail.trim(),
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Failed to create task" }));
        throw new Error(err.message || "Failed to create task");
      }

      // Reset form and refresh tasks
      setFormData({ menteeEmail: "", title: "", description: "" });
      setShowForm(false);
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30 animate-pulse">
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-[#CAAE92]/30 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);

  return (
    <div className="space-y-4">
      {/* Header with Add Task Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-[#1F2937]">Tasks</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors min-h-[44px] md:min-h-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">Assign Task</span>
          <span className="md:hidden">Add</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 p-3">
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      )}

      {/* Task Assignment Form */}
      {showForm && (
        <div className="rounded-xl bg-[#F8F5F2] p-4 md:p-6 shadow-sm border border-[#CAAE92]/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1F2937]">Assign New Task</h3>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
                setFormData({ menteeEmail: "", title: "", description: "" });
              }}
              className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="menteeEmail" className="block text-sm font-medium text-[#1F2937] mb-2">
                Mentee Email
              </label>
              <input
                type="email"
                id="menteeEmail"
                value={formData.menteeEmail}
                onChange={(e) => setFormData({ ...formData, menteeEmail: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-lg border border-[#CAAE92]/30 bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/50 focus:border-[#9C6A45] min-h-[44px]"
                placeholder="mentee@example.com"
              />
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-[#1F2937] mb-2">
                Task Title <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                maxLength={500}
                className="w-full px-4 py-3 rounded-lg border border-[#CAAE92]/30 bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/50 focus:border-[#9C6A45] min-h-[44px]"
                placeholder="e.g., Update resume with latest experience"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-[#1F2937] mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={5000}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-[#CAAE92]/30 bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/50 focus:border-[#9C6A45] resize-none"
                placeholder="Additional details about the task..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                  setFormData({ menteeEmail: "", title: "", description: "" });
                }}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-lg border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-medium hover:bg-[#F4E2D4]/50 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-lg bg-[#734C23] text-white font-medium hover:bg-[#9C6A45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {submitting ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="rounded-xl bg-[#F8F5F2] p-8 text-center shadow-sm border border-[#CAAE92]/30">
          <CheckSquare className="w-12 h-12 text-[#CAAE92] mx-auto mb-3 opacity-50" />
          <p className="text-[#6B7280]">No tasks assigned yet.</p>
          <p className="text-sm text-[#6B7280] mt-1">Click "Assign Task" to create your first task.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#6B7280] uppercase tracking-wide">
                Pending ({pendingTasks.length})
              </h3>
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl bg-[#F8F5F2] p-4 md:p-5 shadow-sm border border-[#CAAE92]/30 hover:shadow-md transition-all"
                  >
                    {/* Desktop Layout */}
                    <div className="hidden md:block">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-base font-semibold text-[#1F2937] flex-1">{task.title}</h4>
                        <span className="px-3 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] text-xs font-medium whitespace-nowrap flex-shrink-0">
                          Pending
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-[#6B7280] mb-3 whitespace-pre-wrap">{task.description}</p>
                      )}
                      <p className="text-xs text-[#6B7280]">Assigned to {task.menteeName}</p>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <h4 className="text-base font-semibold text-[#1F2937]">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-[#6B7280] whitespace-pre-wrap">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#6B7280]">Assigned to {task.menteeName}</p>
                        <span className="px-3 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] text-xs font-medium">
                          Pending
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#6B7280] uppercase tracking-wide">
                Completed ({completedTasks.length})
              </h3>
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl bg-[#F8F5F2] p-4 md:p-5 shadow-sm border border-[#CAAE92]/30 opacity-75"
                  >
                    {/* Desktop Layout */}
                    <div className="hidden md:block">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-base font-semibold text-[#1F2937] flex-1 line-through">{task.title}</h4>
                        <span className="px-3 py-1 rounded-lg bg-[#D1FAE5] text-[#16A34A] text-xs font-medium whitespace-nowrap flex-shrink-0">
                          Completed
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-[#6B7280] mb-3 whitespace-pre-wrap line-through">
                          {task.description}
                        </p>
                      )}
                      <p className="text-xs text-[#6B7280]">Assigned to {task.menteeName}</p>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <h4 className="text-base font-semibold text-[#1F2937] line-through">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-[#6B7280] whitespace-pre-wrap line-through">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#6B7280]">Assigned to {task.menteeName}</p>
                        <span className="px-3 py-1 rounded-lg bg-[#D1FAE5] text-[#16A34A] text-xs font-medium">
                          Completed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

