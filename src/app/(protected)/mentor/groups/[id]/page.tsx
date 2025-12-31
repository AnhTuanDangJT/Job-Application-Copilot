"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, Plus, X, Edit2, Trash2, Send, AlertCircle } from "lucide-react";

interface GroupMember {
  id: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  createdAt: string;
}

interface Group {
  id: string;
  mentorId: string;
  name: string;
  memberCount: number;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

interface Mentee {
  id: string;
  name: string;
  email: string;
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [availableMentees, setAvailableMentees] = useState<Mentee[]>([]);
  const [selectedMenteeId, setSelectedMenteeId] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${groupId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch group");
      }
      const data = await response.json();
      setGroup(data);
      setNewGroupName(data.name);
      setError(null);
    } catch (err) {
      console.error("Error fetching group:", err);
      setError(err instanceof Error ? err.message : "Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMentees = async () => {
    try {
      const response = await fetch("/api/mentor/mentees", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch mentees");
      }
      const data = await response.json();
      // Filter out mentees already in the group
      const groupMenteeIds = new Set(group?.members.map((m) => m.menteeId) || []);
      const available = (data.mentees || []).filter(
        (mentee: any) => !groupMenteeIds.has(mentee.menteeId)
      );
      setAvailableMentees(available.map((m: any) => ({ id: m.menteeId, name: m.menteeName, email: m.menteeEmail })));
    } catch (err) {
      console.error("Error fetching available mentees:", err);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchGroup();
    }
  }, [groupId]);

  useEffect(() => {
    if (showAddMemberModal && group) {
      fetchAvailableMentees();
    }
  }, [showAddMemberModal, group]);

  // Handle ESC key for all modals
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showAddMemberModal) {
          setShowAddMemberModal(false);
          setSelectedMenteeId("");
        } else if (showAnnouncementModal) {
          setShowAnnouncementModal(false);
          setAnnouncementContent("");
        } else if (showRenameModal) {
          setShowRenameModal(false);
          setNewGroupName(group?.name || "");
        }
      }
    }

    if (showAddMemberModal || showAnnouncementModal || showRenameModal) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showAddMemberModal, showAnnouncementModal, showRenameModal, group]);

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAddMemberModal || showAnnouncementModal || showRenameModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddMemberModal, showAnnouncementModal, showRenameModal]);

  const handleAddMember = async () => {
    if (!selectedMenteeId) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ menteeId: selectedMenteeId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to add member" }));
        throw new Error(error.message || "Failed to add member");
      }

      setSelectedMenteeId("");
      setShowAddMemberModal(false);
      await fetchGroup();
    } catch (err) {
      console.error("Error adding member:", err);
      alert(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (menteeId: string, menteeName: string) => {
    if (!confirm(`Remove ${menteeName} from this group?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${groupId}/members/${menteeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to remove member" }));
        throw new Error(error.message || "Failed to remove member");
      }

      await fetchGroup();
    } catch (err) {
      console.error("Error removing member:", err);
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleRenameGroup = async () => {
    if (!newGroupName.trim() || newGroupName.trim() === group?.name) {
      setShowRenameModal(false);
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to rename group" }));
        throw new Error(error.message || "Failed to rename group");
      }

      setShowRenameModal(false);
      await fetchGroup();
    } catch (err) {
      console.error("Error renaming group:", err);
      alert(err instanceof Error ? err.message : "Failed to rename group");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementContent.trim()) {
      return;
    }

    if (!confirm(`This will send an announcement to all ${group?.memberCount || 0} mentees in this group. Continue?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/groups/${groupId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: announcementContent.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to send announcement" }));
        throw new Error(error.message || "Failed to send announcement");
      }

      const data = await response.json();
      alert(`Announcement sent successfully to ${data.notifiedCount} mentees!`);
      setAnnouncementContent("");
      setShowAnnouncementModal(false);
    } catch (err) {
      console.error("Error sending announcement:", err);
      alert(err instanceof Error ? err.message : "Failed to send announcement");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAiRewrite = async () => {
    if (!announcementContent.trim()) {
      alert("Please enter some text to improve first");
      return;
    }

    try {
      setAiRewriting(true);
      const response = await fetch("/api/ai/announcement-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draftText: announcementContent }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to rewrite announcement" }));
        throw new Error(error.message || "Failed to rewrite announcement");
      }

      const data = await response.json();
      setAnnouncementContent(data.rewritten);
    } catch (err) {
      console.error("Error rewriting announcement:", err);
      alert(err instanceof Error ? err.message : "Failed to improve announcement with AI");
    } finally {
      setAiRewriting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;

    if (!confirm(`Are you sure you want to delete "${group.name}"? This will remove all members and cannot be undone.`)) {
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

      router.push("/mentor/overview");
    } catch (err) {
      console.error("Error deleting group:", err);
      alert(err instanceof Error ? err.message : "Failed to delete group");
    }
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-8 bg-[#CAAE92]/30 rounded w-1/3 animate-pulse"></div>
        <div className="h-64 bg-[#CAAE92]/30 rounded animate-pulse"></div>
      </section>
    );
  }

  if (error || !group) {
    return (
      <section className="space-y-6">
        <button
          onClick={() => router.push("/mentor/overview")}
          className="flex items-center gap-2 text-[#734C23] hover:text-[#9C6A45] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </button>
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 p-4">
          <p className="text-sm text-[#DC2626]">{error || "Group not found"}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/mentor/overview")}
            className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1F2937]">{group.name}</h1>
              <button
                onClick={() => setShowRenameModal(true)}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
                title="Rename group"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mt-1">
              {group.memberCount} {group.memberCount === 1 ? "mentee" : "mentees"}
            </p>
          </div>
        </div>
        <button
          onClick={handleDeleteGroup}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#DC2626] text-white text-sm font-medium hover:bg-[#B91C1C] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Group
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowAddMemberModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Mentee
        </button>
        <button
          onClick={() => setShowAnnouncementModal(true)}
          disabled={group.memberCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#734C23] text-white text-sm font-medium hover:bg-[#9C6A45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          Send Announcement
        </button>
      </div>

      {/* Members List */}
      <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/20">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#9C6A45]" />
          Members
        </h2>
        {group.members.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280]">
            <Users className="w-12 h-12 text-[#CAAE92] mx-auto mb-2" />
            <p>No members yet. Add mentees to this group.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white border border-[#CAAE92]/20"
              >
                <div>
                  <p className="font-medium text-[#1F2937]">{member.menteeName}</p>
                  <p className="text-sm text-[#6B7280]">{member.menteeEmail}</p>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.menteeId, member.menteeName)}
                  className="p-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                  title="Remove from group"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-md w-full animate-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#734C23]">Add Mentee to Group</h3>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedMenteeId("");
                }}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {availableMentees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-[#CAAE92] mx-auto mb-4" />
                <p className="text-[#6B7280] font-medium mb-2">No available mentees to add</p>
                <p className="text-sm text-[#6B7280]/80 mb-6">All your mentees are already in this group.</p>
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setSelectedMenteeId("");
                  }}
                  className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200"
                >
                  Return
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#6B7280] mb-2">
                    Select Mentee
                  </label>
                  <select
                    value={selectedMenteeId}
                    onChange={(e) => setSelectedMenteeId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#CAAE92]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#734C23] focus:border-transparent"
                  >
                    <option value="">Choose a mentee...</option>
                    {availableMentees.map((mentee) => (
                      <option key={mentee.id} value={mentee.id}>
                        {mentee.name} ({mentee.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 justify-between items-center mt-6 pt-4 border-t border-[#CAAE92]/30">
                  <button
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setSelectedMenteeId("");
                    }}
                    disabled={actionLoading}
                    className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50"
                  >
                    Return
                  </button>
                  <button
                    onClick={handleAddMember}
                    disabled={actionLoading || !selectedMenteeId}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                  >
                    {actionLoading ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-2xl w-full max-h-[90vh] flex flex-col animate-in">
            <div className="flex items-start justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-[#734C23]">Send Group Announcement</h3>
              <button
                onClick={() => {
                  setShowAnnouncementModal(false);
                  setAnnouncementContent("");
                }}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#92400E]">
                This announcement will be sent to all <strong>{group.memberCount}</strong> mentees in this group. Each mentee will receive a notification.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[#6B7280]">
                  Announcement Content
                </label>
                <button
                  type="button"
                  onClick={handleAiRewrite}
                  disabled={aiRewriting || !announcementContent.trim()}
                  className="text-xs px-3 py-1.5 rounded-md border border-[#734C23] bg-white text-[#734C23] hover:bg-[#F8F5F2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {aiRewriting ? "Improving..." : "✨ Improve with AI"}
                </button>
              </div>
              <textarea
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                placeholder="Enter your announcement here. You can include links, multiple paragraphs, and any information you want to share with the group..."
                className="w-full px-3 py-2 border border-[#CAAE92]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#734C23] focus:border-transparent min-h-[200px]"
                rows={10}
              />
              <p className="text-xs text-[#6B7280] mt-2">
                Supports multiple paragraphs, links, and plain text. Use "Improve with AI" to enhance clarity and professionalism.
              </p>
            </div>
            <div className="flex gap-3 justify-between items-center flex-shrink-0 pt-4 border-t border-[#CAAE92]/30">
              <button
                onClick={() => {
                  setShowAnnouncementModal(false);
                  setAnnouncementContent("");
                }}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50"
              >
                Return
              </button>
              <button
                onClick={handleSendAnnouncement}
                disabled={actionLoading || !announcementContent.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
              >
                {actionLoading ? "Sending..." : "Send Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Group Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 p-6 max-w-md w-full animate-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#734C23]">Rename Group</h3>
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setNewGroupName(group.name);
                }}
                className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
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
                  className="w-full px-3 py-2 border border-[#CAAE92]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#734C23] focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameGroup();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-between items-center pt-4 border-t border-[#CAAE92]/30">
                <button
                  onClick={() => {
                    setShowRenameModal(false);
                    setNewGroupName(group.name);
                  }}
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200 disabled:opacity-50"
                >
                  Return
                </button>
                <button
                  onClick={handleRenameGroup}
                  disabled={actionLoading || !newGroupName.trim() || newGroupName.trim() === group.name}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
                >
                  {actionLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

