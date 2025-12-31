"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Target, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import GenerateSkillsGapModal from "./GenerateSkillsGapModal";

interface SkillGapReport {
  id: string;
  conversationId: string;
  targetRole: string;
  detectedSkills: string[];
  missingSkills: string[];
  score: number;
  recommendations: string[];
  createdAt: string;
}

interface DynamicSkillsGapReport {
  role: string;
  matchPercentage: number;
  skillsHave: string[];
  missingSkills: string[];
  nextSteps: string[];
}

interface SkillGapScorecardProps {
  conversationId: string;
}

export default function SkillGapScorecard({ conversationId }: SkillGapScorecardProps) {
  const [showModal, setShowModal] = useState(false);
  const [dynamicReport, setDynamicReport] = useState<DynamicSkillsGapReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch skill gap reports (legacy database reports)
  const { data, isLoading } = useQuery<{ reports: SkillGapReport[] }>({
    queryKey: ["skill-gap", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/skill-gap?conversationId=${conversationId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch skill gap reports");
      return res.json();
    },
  });

  // Use dynamic report if available, otherwise fall back to database report
  const latestReport = data?.reports?.[0];
  const displayReport = dynamicReport
    ? {
        targetRole: dynamicReport.role,
        score: dynamicReport.matchPercentage,
        detectedSkills: dynamicReport.skillsHave,
        missingSkills: dynamicReport.missingSkills,
        recommendations: dynamicReport.nextSteps,
      }
    : latestReport;

  async function handleGenerate(role: string) {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/skills-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate skills gap report");
      }

      const result: DynamicSkillsGapReport = await res.json();
      setDynamicReport(result);
      setShowModal(false); // Close modal on success
    } catch (error) {
      // Re-throw error so modal can display it
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100";
    if (score >= 60) return "bg-yellow-100";
    return "bg-red-100";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#734C23] flex items-center gap-2">
          <Target className="w-4 h-4" />
          Skills Gap Analysis
        </h3>
      </div>

      {/* Generate New Report */}
      {!displayReport && (
        <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4">
          <div className="space-y-3">
            <p className="text-xs text-[#6B7280] mb-2">
              Generate a skills gap analysis for any role to see how your skills match.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[#734C23] text-white hover:bg-[#9C6A45] transition-colors min-h-[44px]"
            >
              Generate New Report
            </button>
            <p className="text-xs text-[#6B7280]">
              Note: Please upload your resume first to generate a skills gap analysis.
            </p>
          </div>
        </div>
      )}

      {/* Display Report */}
      {displayReport && (
        <div className="rounded-lg border border-[#CAAE92]/30 bg-white p-4 space-y-4">
          {/* Score Card */}
          <div className={`rounded-lg p-4 ${getScoreBgColor(displayReport.score)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-[#734C23]">Match Score</div>
              <TrendingUp className="w-4 h-4 text-[#734C23]" />
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(displayReport.score)}`}>
              {displayReport.score}%
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {displayReport.targetRole}
            </div>
          </div>

          {/* Detected Skills */}
          {displayReport.detectedSkills.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[#734C23] mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" />
                Skills You Have ({displayReport.detectedSkills.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {displayReport.detectedSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 rounded bg-green-100 text-green-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {displayReport.missingSkills.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[#734C23] mb-2 flex items-center gap-2">
                <XCircle className="w-3 h-3" />
                Missing Skills ({displayReport.missingSkills.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {displayReport.missingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {displayReport.recommendations.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[#734C23] mb-2">Next Steps</div>
              <ul className="space-y-1">
                {displayReport.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs text-[#6B7280] flex items-start gap-2">
                    <span className="text-[#9C6A45] mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Generate New Report Button */}
          <button
            onClick={() => setShowModal(true)}
            disabled={isGenerating}
            className="w-full text-xs px-3 py-2 rounded-lg border border-[#CAAE92]/30 text-[#734C23] hover:bg-[#F4E2D4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate New Report"
            )}
          </button>
        </div>
      )}

      {/* Generate Skills Gap Modal */}
      <GenerateSkillsGapModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onGenerate={handleGenerate}
        isLoading={isGenerating}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#9C6A45]" />
        </div>
      )}
    </div>
  );
}



