"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { Briefcase, Calendar, CheckCircle, XCircle, Edit2, MessageSquare, ExternalLink } from "lucide-react";

interface RecentApplication {
  id: string;
  company: string;
  role: string;
  status: string;
  lastUpdated: string | Date;
  tags: Array<{ id: string; label: string; color: string }>;
}

interface MenteeCardProps {
  conversationId: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  targetRole: string;
  targetLocations: string[];
  season: string;
  currentPhase: string;
  menteeTags: string[];
  notes: string;
  applicationsCount: number;
  interviewsCount: number;
  offersCount: number;
  rejectedCount: number;
  followUpsDueCount: number;
  recentApplications: RecentApplication[];
  onUpdate: (updates: Partial<MenteeCardProps>) => Promise<void>;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function MenteeCard({
  conversationId,
  menteeName,
  menteeEmail,
  targetRole: initialTargetRole,
  targetLocations: initialTargetLocations,
  season: initialSeason,
  currentPhase: initialCurrentPhase,
  menteeTags: initialMenteeTags,
  notes: initialNotes,
  applicationsCount,
  interviewsCount,
  offersCount,
  rejectedCount,
  followUpsDueCount,
  recentApplications,
  onUpdate,
}: MenteeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [targetRole, setTargetRole] = useState(initialTargetRole);
  const [targetLocations, setTargetLocations] = useState(initialTargetLocations);
  const [season, setSeason] = useState(initialSeason);
  const [currentPhase, setCurrentPhase] = useState(initialCurrentPhase);
  const [menteeTags, setMenteeTags] = useState(initialMenteeTags);
  const [notes, setNotes] = useState(initialNotes);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
        targetRole,
        targetLocations,
        season,
        currentPhase,
        menteeTags,
        notes,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTargetRole(initialTargetRole);
    setTargetLocations(initialTargetLocations);
    setSeason(initialSeason);
    setCurrentPhase(initialCurrentPhase);
    setMenteeTags(initialMenteeTags);
    setNotes(initialNotes);
    setIsEditing(false);
  };

  const handleAddTag = () => {
    const tag = prompt("Enter tag:");
    if (tag && tag.trim()) {
      setMenteeTags([...menteeTags, tag.trim()]);
    }
  };

  const handleRemoveTag = (index: number) => {
    setMenteeTags(menteeTags.filter((_, i) => i !== index));
  };

  const handleAddLocation = () => {
    const location = prompt("Enter location:");
    if (location && location.trim()) {
      setTargetLocations([...targetLocations, location.trim()]);
    }
  };

  const handleRemoveLocation = (index: number) => {
    setTargetLocations(targetLocations.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-[#CAAE92]/20">
      {/* Top Row: Avatar, Name, Email */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-[#F4E2D4] flex items-center justify-center border-2 border-[#CAAE92] flex-shrink-0">
          <span className="text-sm font-semibold text-[#734C23]">{getInitials(menteeName)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[#1F2937] truncate">{menteeName}</h3>
          <p className="text-sm text-[#6B7280] truncate">{menteeEmail}</p>
        </div>
      </div>

      {/* Stats Row with Icons */}
      <div className="grid grid-cols-4 gap-3 mb-5 pb-5 border-b border-[#CAAE92]/30">
        <div className="flex flex-col items-center gap-1">
          <Briefcase className="w-4 h-4 text-[#9C6A45]" strokeWidth={1.5} />
          <div className="text-xl font-bold text-[#734C23]">{applicationsCount}</div>
          <div className="text-xs text-[#6B7280]">Applications</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Calendar className="w-4 h-4 text-[#9C6A45]" strokeWidth={1.5} />
          <div className="text-xl font-bold text-[#9C6A45]">{interviewsCount}</div>
          <div className="text-xs text-[#6B7280]">Interviews</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <CheckCircle className="w-4 h-4 text-[#16A34A]" strokeWidth={1.5} />
          <div className="text-xl font-bold text-[#16A34A]">{offersCount}</div>
          <div className="text-xs text-[#6B7280]">Offers</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <XCircle className="w-4 h-4 text-[#DC2626]" strokeWidth={1.5} />
          <div className="text-xl font-bold text-[#DC2626]">{rejectedCount}</div>
          <div className="text-xs text-[#6B7280]">Rejected</div>
        </div>
      </div>

      {/* Mentoring Metadata - Compact View */}
      <div className="space-y-2.5 mb-5">
        <div>
          <span className="text-xs font-medium text-[#6B7280]">Target Role: </span>
          <span className="text-sm text-[#1F2937] font-medium">{targetRole || "Not set"}</span>
        </div>

        <div>
          <span className="text-xs font-medium text-[#6B7280]">Locations: </span>
          {targetLocations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {targetLocations.slice(0, 3).map((loc, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-0.5 bg-[#F4E2D4] text-[#734C23] rounded-md text-xs font-medium"
                >
                  {loc}
                </span>
              ))}
              {targetLocations.length > 3 && (
                <span className="text-xs text-[#6B7280]">+{targetLocations.length - 3} more</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-[#6B7280]">Not set</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs font-medium text-[#6B7280]">Season: </span>
            <span className="text-sm text-[#1F2937] font-medium">{season || "Not set"}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-[#6B7280]">Phase: </span>
            <span className="text-sm text-[#1F2937] font-medium">{currentPhase || "Not set"}</span>
          </div>
        </div>

        {menteeTags.length > 0 && (
          <div>
            <span className="text-xs font-medium text-[#6B7280]">Tags: </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {menteeTags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-0.5 bg-[#F4E2D4] text-[#734C23] rounded-md text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
              {menteeTags.length > 3 && (
                <span className="text-xs text-[#6B7280]">+{menteeTags.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {notes && (
          <div>
            <span className="text-xs font-medium text-[#6B7280]">Notes: </span>
            <p className="text-sm text-[#6B7280] line-clamp-1 mt-0.5">{notes}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t border-[#CAAE92]/30">
        <Link
          href={`/mentor-communication/${conversationId}/applications`}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-[#CAAE92] text-[#734C23] rounded-lg hover:bg-[#F4E2D4] hover:border-[#9C6A45] transition-all duration-200 text-sm font-medium"
        >
          <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
          <span>View Applications</span>
        </Link>
        <Link
          href={`/mentor-communication/${conversationId}`}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-[#CAAE92] text-[#734C23] rounded-lg hover:bg-[#F4E2D4] hover:border-[#9C6A45] transition-all duration-200 text-sm font-medium"
        >
          <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
          <span>Message</span>
        </Link>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-3 py-2 bg-white border border-[#CAAE92] text-[#734C23] rounded-lg hover:bg-[#F4E2D4] hover:border-[#9C6A45] transition-all duration-200"
          aria-label={isEditing ? "Cancel editing" : "Edit mentee"}
        >
          <Edit2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Editing Form (shown when isEditing is true) */}
      {isEditing && (
        <div className="mt-4 pt-4 border-t border-[#CAAE92]/30 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">
              Target Role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full rounded-lg border border-[#CAAE92] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 transition-all"
              placeholder="e.g., Software Engineer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">
              Locations
            </label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {targetLocations.map((loc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4E2D4] text-[#734C23] rounded-lg text-xs font-medium"
                  >
                    {loc}
                    <button
                      onClick={() => handleRemoveLocation(idx)}
                      className="hover:text-[#9C6A45] text-[#734C23]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={handleAddLocation}
                className="text-xs text-[#734C23] hover:text-[#9C6A45] font-medium transition-colors"
              >
                + Add Location
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Season
              </label>
              <input
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full rounded-lg border border-[#CAAE92] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 transition-all"
                placeholder="e.g., Fall 2024"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Phase
              </label>
              <input
                type="text"
                value={currentPhase}
                onChange={(e) => setCurrentPhase(e.target.value)}
                className="w-full rounded-lg border border-[#CAAE92] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 transition-all"
                placeholder="e.g., Interviewing"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">
              Tags
            </label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {menteeTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#9C6A45]/10 text-[#734C23] rounded-lg text-xs font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(idx)}
                      className="hover:text-[#9C6A45] text-[#734C23]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={handleAddTag}
                className="text-xs text-[#734C23] hover:text-[#9C6A45] font-medium transition-colors"
              >
                + Add Tag
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#CAAE92] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#9C6A45] focus:ring-2 focus:ring-[#9C6A45]/20 transition-all"
              placeholder="Add notes about this mentee..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white rounded-xl hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm font-medium transition-all duration-200"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 bg-[#F4E2D4] text-[#734C23] rounded-xl hover:bg-[#CAAE92] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default memo(MenteeCard);

