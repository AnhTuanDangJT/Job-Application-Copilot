"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  mentorName: string;
  mentorEmail: string;
  createdAt: string;
  updatedAt: string;
}

export default function TasksSection() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  
  // Determine user role for conditional text rendering
  const userRole = user?.role || "mentee";

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks", {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch tasks" }));
        throw new Error(errorData.error || errorData.message || "Failed to fetch tasks");
      }
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggle = async (taskId: string, currentCompleted: boolean) => {
    // Optimistic update
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !currentCompleted } : task
      )
    );
    setTogglingTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        // Revert optimistic update on error
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId ? { ...task, completed: currentCompleted } : task
          )
        );
        const err = await response.json().catch(() => ({ message: "Failed to toggle task" }));
        throw new Error(err.message || "Failed to toggle task");
      }

      // Refresh tasks to get updated data
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle task");
    } finally {
      setTogglingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
        <h2 className="text-xl font-semibold text-[#1F2937]">My Tasks</h2>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 p-3">
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="rounded-xl bg-[#F8F5F2] p-8 text-center shadow-sm border border-[#CAAE92]/30">
          <CheckSquare className="w-12 h-12 text-[#CAAE92] mx-auto mb-3 opacity-50" />
          <p className="text-[#6B7280]">No tasks assigned yet.</p>
          <p className="text-sm text-[#6B7280] mt-1">Your mentor will assign tasks here.</p>
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
                    <div className="hidden md:flex items-start gap-4">
                      {/* Checkbox - Left, vertically centered */}
                      <label className="flex items-center cursor-pointer pt-0.5">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggle(task.id, task.completed)}
                          disabled={togglingTaskId === task.id}
                          className="w-5 h-5 rounded border-[#CAAE92] text-[#734C23] focus:ring-2 focus:ring-[#9C6A45]/50 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="sr-only">Mark as completed</span>
                      </label>
                      <div className="flex-1 min-w-0">
                        {/* Header with title and status badge */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="text-base font-semibold text-[#1F2937] flex-1">{task.title}</h4>
                          <span className="px-3 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] text-xs font-medium whitespace-nowrap flex-shrink-0">
                            Pending
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-[#6B7280] mb-3 whitespace-pre-wrap">{task.description}</p>
                        )}
                        <p className="text-xs text-[#6B7280]">
                          {userRole === "mentee" ? `From mentor: ${task.mentorName}` : `Assigned to ${task.mentorName}`}
                        </p>
                      </div>
                      {togglingTaskId === task.id && (
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-[#9C6A45] animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      {/* Checkbox - Full width tap area */}
                      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggle(task.id, task.completed)}
                          disabled={togglingTaskId === task.id}
                          className="w-6 h-6 rounded border-[#CAAE92] text-[#734C23] focus:ring-2 focus:ring-[#9C6A45]/50 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="flex-1 text-base font-semibold text-[#1F2937]">
                          {task.title}
                        </span>
                        {togglingTaskId === task.id && (
                          <Loader2 className="w-5 h-5 text-[#9C6A45] animate-spin flex-shrink-0" />
                        )}
                      </label>
                      {task.description && (
                        <p className="text-sm text-[#6B7280] whitespace-pre-wrap pl-9">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between pl-9">
                        <p className="text-xs text-[#6B7280]">
                          {userRole === "mentee" ? `From mentor: ${task.mentorName}` : `Assigned to ${task.mentorName}`}
                        </p>
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
                    <div className="hidden md:flex items-start gap-4">
                      {/* Checkbox - Left, vertically centered */}
                      <label className="flex items-center cursor-pointer pt-0.5">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggle(task.id, task.completed)}
                          disabled={togglingTaskId === task.id}
                          className="w-5 h-5 rounded border-[#CAAE92] text-[#734C23] focus:ring-2 focus:ring-[#9C6A45]/50 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="sr-only">Mark as pending</span>
                      </label>
                      <div className="flex-1 min-w-0">
                        {/* Header with title and status badge */}
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
                        <p className="text-xs text-[#6B7280]">
                          {userRole === "mentee" ? `From mentor: ${task.mentorName}` : `Assigned to ${task.mentorName}`}
                        </p>
                      </div>
                      {togglingTaskId === task.id && (
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-[#9C6A45] animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      {/* Checkbox - Full width tap area */}
                      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggle(task.id, task.completed)}
                          disabled={togglingTaskId === task.id}
                          className="w-6 h-6 rounded border-[#CAAE92] text-[#734C23] focus:ring-2 focus:ring-[#9C6A45]/50 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="flex-1 text-base font-semibold text-[#1F2937] line-through">
                          {task.title}
                        </span>
                        {togglingTaskId === task.id && (
                          <Loader2 className="w-5 h-5 text-[#9C6A45] animate-spin flex-shrink-0" />
                        )}
                      </label>
                      {task.description && (
                        <p className="text-sm text-[#6B7280] whitespace-pre-wrap line-through pl-9">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between pl-9">
                        <p className="text-xs text-[#6B7280]">
                          {userRole === "mentee" ? `From mentor: ${task.mentorName}` : `Assigned to ${task.mentorName}`}
                        </p>
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

