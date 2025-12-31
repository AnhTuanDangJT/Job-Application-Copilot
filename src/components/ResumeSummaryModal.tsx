"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, MessageCircle, Copy, Download, ArrowLeft, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import jsPDF from "jspdf";

interface ResumeSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeText: string;
}

export default function ResumeSummaryModal({ isOpen, onClose, resumeText }: ResumeSummaryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && resumeText && !summary) {
      handleGenerate();
    }
  }, [isOpen, resumeText]);

  useEffect(() => {
    if (!isOpen) {
      setSummary(null);
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

  async function handleGenerate() {
    if (!resumeText || resumeText.length < 50) {
      setError("Resume text must be at least 50 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<{ summary: string }>("/ai/resume-summary", {
        resumeText: resumeText,
      });
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (summary) {
      try {
        await navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  }

  function handleDownload() {
    if (summary) {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      // Title
      doc.setFontSize(18);
      doc.setTextColor(115, 76, 35); // #734C23
      doc.text("Resume Summary", margin, 30);
      
      // Date
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128); // #6B7280
      const dateStr = new Date().toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
      doc.text(`Generated on ${dateStr}`, margin, 40);
      
      // Content
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55); // #1F2937 - dark text
      const lines = doc.splitTextToSize(summary, maxWidth);
      let yPos = 55;
      
      lines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      
      // Generate filename with date
      const date = new Date();
      const dateStrForFile = date.toISOString().split("T")[0];
      const filename = `resume-analysis-${dateStrForFile}.pdf`;
      
      doc.save(filename);
    }
  }

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-[#F8F5F2]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] bg-[#F8F5F2]/98 backdrop-blur-sm rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#CAAE92]/20 flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F4E2D4]">
              <MessageCircle className="w-5 h-5 text-[#734C23]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#734C23]">Resume Summary</h2>
              <p className="text-sm text-[#6B7280] mt-1">AI-Generated Professional Summary</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#734C23] mb-4"></div>
              <p className="text-sm text-[#6B7280]">Generating summary...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={handleGenerate}
                className="mt-3 px-4 py-2 rounded-lg bg-[#734C23] text-white hover:bg-[#9C6A45] text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {summary && !loading && (
            <div className="space-y-5">
              <div className="rounded-lg bg-white p-5 border border-[#CAAE92]/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-[#734C23]">Summary</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                        copied 
                          ? "bg-[#16A34A] text-white" 
                          : "bg-[#F4E2D4] hover:bg-[#CAAE92] text-[#734C23]"
                      }`}
                      aria-label="Copy summary"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-medium">Copied</span>
                        </>
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="p-2 rounded-lg bg-[#F4E2D4] hover:bg-[#CAAE92] text-[#734C23] transition-colors"
                      aria-label="Download summary as PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="text-base text-[#1F2937] leading-relaxed whitespace-pre-wrap">{summary}</p>
                </div>
              </div>

              <div className="rounded-lg bg-[#F4E2D4]/30 p-5 border border-[#CAAE92]/20">
                <h4 className="text-sm font-semibold text-[#734C23] mb-3">Use Cases</h4>
                <ul className="text-sm text-[#1F2937] space-y-2">
                  <li>• LinkedIn profile summary</li>
                  <li>• Cover letter introduction</li>
                  <li>• Networking and elevator pitch</li>
                  <li>• Professional bio</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#CAAE92]/30 bg-[#F8F5F2] flex-shrink-0">
          <div className="flex items-center justify-end">
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

