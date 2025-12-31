"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Settings, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";

interface Group {
  id: string;
  mentorId: string;
  name: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GroupsSectionProps {
  onGroupClick?: (groupId: string) => void;
}

export default function GroupsSection({ onGroupClick }: GroupsSectionProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/groups", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      const data = await response.json();
      setGroups(data.groups || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching groups:", err);
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Handle ESC key for create modal
  useEffect(() => {
    if (!showCreateModal) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowCreateModal(false);
        setNewGroupName("");
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showCreateModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showCreateModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCreateModal]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to create group" }));
        throw new Error(error.message || "Failed to create group");
      }

      setNewGroupName("");
      setShowCreateModal(false);
      await fetchGroups();
    } catch (err) {
      console.error("Error creating group:", err);
      alert(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"? This will remove all members and cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to delete group" }));
        throw new Error(error.message || "Failed to delete group");
      }

      await fetchGroups();
    } catch (err) {
      console.error("Error deleting group:", err);
      alert(err instanceof Error ? err.message : "Failed to delete group");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-[#1F2937]">Groups</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/20 animate-pulse">
              <div className="h-5 bg-[#CAAE92]/30 rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-[#CAAE92]/30 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#9C6A45]" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-[#1F2937]">Groups</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 p-4">
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl bg-[#F8F5F2] p-12 text-center shadow-sm border border-[#CAAE92]/20">
          <Users className="w-12 h-12 text-[#CAAE92] mx-auto mb-4" />
          <p className="text-[#6B7280] mb-2">No groups yet</p>
          <p className="text-sm text-[#6B7280] mb-4">Create a group to organize and broadcast announcements to mentees</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors"
          >
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/20 hover:shadow-md hover:border-[#9C6A45]/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1F2937] flex-1">{group.name}</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onGroupClick?.(group.id)}
                    className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
                    title="Manage group"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    className="p-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                    title="Delete group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-4">
                <Users className="w-4 h-4" />
                <span>{group.memberCount} {group.memberCount === 1 ? "mentee" : "mentees"}</span>
              </div>
              <button
                onClick={() => onGroupClick?.(group.id)}
                className="w-full px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors"
              >
                Manage Group
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-md w-full animate-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#734C23]">Create New Group</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewGroupName("");
                }}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Interview Prep Group"
                  className="w-full px-3 py-2 border border-[#CAAE92]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#734C23] focus:border-transparent bg-white/80"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateGroup();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-between items-center pt-4 border-t border-[#CAAE92]/30">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewGroupName("");
                  }}
                  disabled={creating}
                  className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50"
                >
                  Return
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={creating || !newGroupName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                >
                  {creating ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


