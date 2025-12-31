"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileCheck, CheckCircle2, AlertCircle, Lightbulb, ArrowLeft, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import jsPDF from "jspdf";

interface ResumeGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeText: string;
}

interface GradingResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  strengths: string[];
  weaknesses: string[];
  atsTips: string[];
  overallFeedback: string;
}

export default function ResumeGradingModal({ isOpen, onClose, resumeText }: ResumeGradingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState<GradingResult | null>(null);

  useEffect(() => {
    if (isOpen && resumeText && !grading) {
      handleGrade();
    }
  }, [isOpen, resumeText]);

  useEffect(() => {
    if (!isOpen) {
      setGrading(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  async function handleGrade() {
    if (!resumeText || resumeText.length < 50) {
      setError("Resume text must be at least 50 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<GradingResult>("/ai/resume-grading", {
        resumeText: resumeText,
      });
      setGrading(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grade resume");
    } finally {
      setLoading(false);
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-[#16A34A] text-white";
      case "B":
        return "bg-[#22C55E] text-white";
      case "C":
        return "bg-[#EAB308] text-white";
      case "D":
        return "bg-[#F59E0B] text-white";
      case "F":
        return "bg-[#DC2626] text-white";
      default:
        return "bg-[#6B7280] text-white";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-[#16A34A]";
    if (score >= 80) return "text-[#22C55E]";
    if (score >= 70) return "text-[#EAB308]";
    if (score >= 60) return "text-[#F59E0B]";
    return "text-[#DC2626]";
  };

  function handleDownload() {
    if (!grading) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(115, 76, 35); // #734C23
    doc.text("Resume Grading", margin, yPos);
    yPos += 15;

    // Grade and Score
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55); // #1F2937
    doc.text(`Grade: ${grading.grade}`, margin, yPos);
    yPos += 10;
    doc.text(`Score: ${grading.score} / 100`, margin, yPos);
    yPos += 15;

    // Overall Assessment
    if (grading.overallFeedback) {
      doc.setFontSize(12);
      doc.setTextColor(115, 76, 35); // #734C23
      doc.text("Overall Assessment", margin, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55); // #1F2937
      const feedbackLines = doc.splitTextToSize(grading.overallFeedback, maxWidth);
      feedbackLines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      yPos += 5;
    }

    // Strengths
    if (grading.strengths.length > 0) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(12);
      doc.setTextColor(115, 76, 35); // #734C23
      doc.text("Strengths", margin, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55); // #1F2937
      grading.strengths.forEach((strength) => {
        const lines = doc.splitTextToSize(`• ${strength}`, maxWidth);
        lines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += 7;
        });
        yPos += 2;
      });
      yPos += 3;
    }

    // Areas for Improvement
    if (grading.weaknesses.length > 0) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(12);
      doc.setTextColor(115, 76, 35); // #734C23
      doc.text("Areas for Improvement", margin, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55); // #1F2937
      grading.weaknesses.forEach((weakness) => {
        const lines = doc.splitTextToSize(`• ${weakness}`, maxWidth);
        lines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += 7;
        });
        yPos += 2;
      });
      yPos += 3;
    }

    // ATS Tips
    if (grading.atsTips.length > 0) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(12);
      doc.setTextColor(115, 76, 35); // #734C23
      doc.text("ATS Optimization Tips", margin, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55); // #1F2937
      grading.atsTips.forEach((tip) => {
        const lines = doc.splitTextToSize(`• ${tip}`, maxWidth);
        lines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += 7;
        });
        yPos += 2;
      });
    }

    // Generate filename with date
    const date = new Date();
    const dateStrForFile = date.toISOString().split("T")[0];
    const filename = `resume-analysis-${dateStrForFile}.pdf`;

    doc.save(filename);
  }

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-[#F8F5F2]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] bg-[#F8F5F2]/98 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F4E2D4]">
              <FileCheck className="w-5 h-5 text-[#734C23]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">Resume Grading</h2>
              <p className="text-sm text-[#6B7280] mt-1">AI-Powered Analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#734C23] mb-4"></div>
              <p className="text-sm text-[#6B7280]">Analyzing your resume...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button
                onClick={handleGrade}
                className="mt-3 px-4 py-2 rounded-lg bg-[#734C23] text-white hover:bg-[#9C6A45] text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {grading && !loading && (
            <div className="space-y-6">
              {/* Score Badge */}
              <div className="flex flex-col items-center justify-center gap-4">
                <div className={`w-32 h-32 rounded-full ${getGradeColor(grading.grade)} flex items-center justify-center text-4xl font-bold shadow-lg`}>
                  {grading.grade}
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(grading.score)} text-center`}>
                  {grading.score} / 100
                </div>
              </div>

              {/* Overall Feedback */}
              {grading.overallFeedback && (
                <div className="rounded-lg bg-white p-5 border border-[#CAAE92]/20">
                  <h3 className="text-base font-semibold text-[#734C23] mb-3">Overall Assessment</h3>
                  <p className="text-base text-[#1F2937] leading-relaxed">{grading.overallFeedback}</p>
                </div>
              )}

              {/* Strengths */}
              {grading.strengths.length > 0 && (
                <div className="rounded-lg bg-white p-5 border border-[#CAAE92]/20">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                    <h3 className="text-base font-semibold text-[#734C23]">Strengths</h3>
                  </div>
                  <ul className="space-y-3">
                    {grading.strengths.map((strength, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-[#16A34A] mt-0.5">•</span>
                        <span className="text-base text-[#1F2937] flex-1 leading-relaxed">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {grading.weaknesses.length > 0 && (
                <div className="rounded-lg bg-white p-5 border border-[#CAAE92]/20">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
                    <h3 className="text-base font-semibold text-[#734C23]">Areas for Improvement</h3>
                  </div>
                  <ul className="space-y-3">
                    {grading.weaknesses.map((weakness, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-[#F59E0B] mt-0.5">•</span>
                        <span className="text-base text-[#1F2937] flex-1 leading-relaxed">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ATS Tips */}
              {grading.atsTips.length > 0 && (
                <div className="rounded-lg bg-white p-5 border border-[#CAAE92]/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-[#734C23]" />
                    <h3 className="text-base font-semibold text-[#734C23]">ATS Optimization Tips</h3>
                  </div>
                  <ul className="space-y-3">
                    {grading.atsTips.map((tip, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-[#734C23] mt-0.5">•</span>
                        <span className="text-base text-[#1F2937] flex-1 leading-relaxed">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#CAAE92]/30 bg-[#F8F5F2] flex-shrink-0">
          <div className="flex items-center justify-end gap-3">
            {grading && !loading && (
              <button
                onClick={handleDownload}
                className="px-4 py-2.5 rounded-xl border-2 border-[#734C23] bg-[#734C23] text-white font-semibold hover:bg-[#9C6A45] hover:border-[#9C6A45] transition-all duration-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modalContent, document.body);
}

