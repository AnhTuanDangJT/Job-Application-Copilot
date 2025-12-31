"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle, XCircle, Sparkles } from "lucide-react";

interface DocumentInsight {
  id: string;
  conversationId: string;
  docType: "resume" | "cover";
  status: "pending" | "ready" | "failed";
  resultsJson?: {
    detectedSkills: string[];
    missingSkills: string[];
    lengthRecommendation: string;
    actionItems: string[];
    overallNotes: string;
  };
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface InsightsPanelProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
}

export default function InsightsPanel({ conversationId, userRole }: InsightsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedDocType, setSelectedDocType] = useState<"resume" | "cover" | null>(null);

  // Fetch insights
  const { data, isLoading } = useQuery<{ insights: DocumentInsight[] }>({
    queryKey: ["insights", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/insights?conversationId=${conversationId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
  });

  // Generate insights mutation
  const generateMutation = useMutation({
    mutationFn: async (docType: "resume" | "cover") => {
      const res = await fetch("/api/insights/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, docType }),
      });
      if (!res.ok) throw new Error("Failed to generate insights");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights", conversationId] });
    },
  });

  // Approve/reject mutation (mentor only)
  const approveMutation = useMutation({
    mutationFn: async ({ insightId, approvalStatus }: { insightId: string; approvalStatus: "approved" | "rejected" }) => {
      const res = await fetch(`/api/insights/${insightId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approvalStatus }),
      });
      if (!res.ok) throw new Error("Failed to update approval");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights", conversationId] });
    },
  });

  const resumeInsight = data?.insights.find((i) => i.docType === "resume");
  const coverInsight = data?.insights.find((i) => i.docType === "cover");

  const handleGenerate = (docType: "resume" | "cover") => {
    generateMutation.mutate(docType);
  };

  const handleApprove = (insightId: string, approvalStatus: "approved" | "rejected") => {
    approveMutation.mutate({ insightId, approvalStatus });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#734C23]">Document Insights</h3>
        <Sparkles className="w-5 h-5 text-[#9C6A45]" />
      </div>

      {/* Resume Insights */}
      <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-[#734C23]">Resume</h4>
          {!resumeInsight && (
            <button
              onClick={() => handleGenerate("resume")}
              disabled={generateMutation.isPending}
              className="text-xs px-2 py-1 rounded bg-[#F4E2D4] text-[#734C23] hover:bg-[#E8D4C4] transition-colors disabled:opacity-50"
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </button>
          )}
        </div>

        {generateMutation.isPending && selectedDocType === "resume" && (
          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating insights...
          </div>
        )}

        {resumeInsight && (
          <InsightDisplay
            insight={resumeInsight}
            userRole={userRole}
            onApprove={handleApprove}
            isApproving={approveMutation.isPending}
          />
        )}
      </div>

      {/* Cover Letter Insights */}
      <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-[#734C23]">Cover Letter</h4>
          {!coverInsight && (
            <button
              onClick={() => handleGenerate("cover")}
              disabled={generateMutation.isPending}
              className="text-xs px-2 py-1 rounded bg-[#F4E2D4] text-[#734C23] hover:bg-[#E8D4C4] transition-colors disabled:opacity-50"
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </button>
          )}
        </div>

        {generateMutation.isPending && selectedDocType === "cover" && (
          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating insights...
          </div>
        )}

        {coverInsight && (
          <InsightDisplay
            insight={coverInsight}
            userRole={userRole}
            onApprove={handleApprove}
            isApproving={approveMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function InsightDisplay({
  insight,
  userRole,
  onApprove,
  isApproving,
}: {
  insight: DocumentInsight;
  userRole: "mentee" | "mentor" | "admin";
  onApprove: (insightId: string, status: "approved" | "rejected") => void;
  isApproving: boolean;
}) {
  const [skillsExpanded, setSkillsExpanded] = useState(false);

  if (insight.status === "pending") {
    return (
      <div className="text-sm text-[#6B7280] flex items-center gap-2 leading-relaxed">
        <Loader2 className="w-4 h-4 animate-spin" />
        Insights are being generated...
      </div>
    );
  }

  if (insight.status === "failed") {
    return (
      <div className="text-sm text-[#DC2626] leading-relaxed">
        Failed to generate insights. Please try again.
      </div>
    );
  }

  if (!insight.resultsJson) {
    return <div className="text-sm text-[#6B7280] leading-relaxed">No insights available.</div>;
  }

  const { detectedSkills, missingSkills, lengthRecommendation, actionItems, overallNotes } =
    insight.resultsJson;

  return (
    <div className="space-y-4">
      {/* Approval Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {insight.approvalStatus === "approved" && (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          {insight.approvalStatus === "rejected" && (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <span className="text-sm font-semibold text-[#734C23]">
            {insight.approvalStatus === "approved"
              ? "Approved"
              : insight.approvalStatus === "rejected"
              ? "Rejected"
              : "Pending Approval"}
          </span>
        </div>

        {userRole === "mentor" && insight.approvalStatus === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(insight.id, "approved")}
              disabled={isApproving}
              className="text-sm px-3 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => onApprove(insight.id, "rejected")}
              disabled={isApproving}
              className="text-sm px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Overall Notes */}
      <div className="text-sm text-[#6B7280] leading-relaxed">{overallNotes}</div>

      {/* Detected Skills */}
      {detectedSkills.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-[#734C23] mb-2">Detected Skills:</div>
          <div className="flex flex-wrap gap-2">
            {(skillsExpanded ? detectedSkills : detectedSkills.slice(0, 10)).map((skill, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-1 rounded bg-[#F4E2D4] text-[#734C23]"
              >
                {skill}
              </span>
            ))}
          </div>
          {detectedSkills.length > 10 && (
            <button
              onClick={() => setSkillsExpanded(!skillsExpanded)}
              className="mt-2 text-sm text-[#734C23] hover:text-[#9C6A45] hover:underline cursor-pointer"
            >
              {skillsExpanded ? "Show less" : `Show all (${detectedSkills.length})`}
            </button>
          )}
        </div>
      )}

      {/* Length Recommendation */}
      {lengthRecommendation && (
        <div>
          <div className="text-sm font-semibold text-[#734C23] mb-2">Length:</div>
          <div className="text-sm text-[#6B7280] leading-relaxed">{lengthRecommendation}</div>
        </div>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-[#734C23] mb-2">Action Items:</div>
          <ul className="list-disc list-inside text-sm text-[#6B7280] space-y-1.5 leading-relaxed">
            {actionItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Skills (if any) */}
      {missingSkills.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-[#734C23] mb-2">Missing Skills:</div>
          <div className="flex flex-wrap gap-2">
            {missingSkills.slice(0, 5).map((skill, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-1 rounded bg-yellow-100 text-yellow-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

