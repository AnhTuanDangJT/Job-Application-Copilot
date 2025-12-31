"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, FileCheck, MessageCircle } from "lucide-react";
import ResumeGradingModal from "./ResumeGradingModal";
import ResumeSummaryModal from "./ResumeSummaryModal";

interface DocumentInfo {
  cv: {
    uploaded: boolean;
    fileName: string | null;
    uploadedAt?: string | null;
    extractedTextPreview?: string | null;
    extractedTextLength?: number;
  };
  coverLetter: {
    uploaded: boolean;
    fileName: string | null;
    uploadedAt?: string | null;
    extractedTextPreview?: string | null;
    extractedTextLength?: number;
  };
}

interface DocumentDisplayProps {
  refreshTrigger?: number;
}

export default function DocumentDisplay({ refreshTrigger }: DocumentDisplayProps) {
  const [documents, setDocuments] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [resumeText, setResumeText] = useState<string>("");

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

  async function fetchDocuments() {
    try {
      setLoading(true);
      // Add timestamp to prevent caching
      const response = await fetch(`/api/documents?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.ok) {
        try {
          const data = await response.json();
          // Validate data structure
          if (data && typeof data === "object" && "cv" in data && "coverLetter" in data) {
            setDocuments(data);
            // Store full resume text if available
            if (data.cv?.extractedText) {
              setResumeText(data.cv.extractedText);
            } else if (data.cv?.extractedTextPreview) {
              // Fallback to preview if full text not available
              setResumeText(data.cv.extractedTextPreview);
            }
          } else {
            console.warn("Invalid documents data structure:", data);
            // Set default empty state
            setDocuments({
              cv: { uploaded: false, fileName: null },
              coverLetter: { uploaded: false, fileName: null },
            });
          }
        } catch (jsonError) {
          console.error("Failed to parse documents response:", jsonError);
          // Set default empty state on parse error
            setDocuments({
              cv: { uploaded: false, fileName: null },
              coverLetter: { uploaded: false, fileName: null },
            });
        }
      } else {
        // Non-OK response - set default empty state
        console.warn("Documents API returned non-OK status:", response.status);
            setDocuments({
              cv: { uploaded: false, fileName: null },
              coverLetter: { uploaded: false, fileName: null },
            });
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      // Set default empty state on network error
            setDocuments({
              cv: { uploaded: false, fileName: null },
              coverLetter: { uploaded: false, fileName: null },
            });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-[#CAAE92]/30 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-[#CAAE92]/30 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CV Display */}
      <div className="rounded-xl bg-[#F8F5F2] p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-[#9C6A45]" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-[#1F2937]">CV / Resume</h3>
        </div>
        {documents?.cv.uploaded ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" strokeWidth={1.5} />
                <span className="text-xs font-medium text-[#16A34A]">Uploaded</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#1F2937] truncate">{documents.cv.fileName || "Unknown file"}</p>
                {documents.cv.uploadedAt && (
                  <p className="text-xs text-[#6B7280] mt-1">
                    {new Date(documents.cv.uploadedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            {/* AI Features */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[#CAAE92]/20">
              <button
                onClick={() => {
                  if (resumeText) {
                    setShowGradingModal(true);
                  } else {
                    // Fetch documents to get resume text
                    fetch("/api/documents", {
                      credentials: "include",
                      cache: "no-store",
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data?.cv?.extractedText) {
                          setResumeText(data.cv.extractedText);
                          setShowGradingModal(true);
                        } else {
                          alert("Unable to load resume text. Please ensure your resume is uploaded and processed.");
                        }
                      })
                      .catch(() => {
                        alert("Unable to load resume text. Please ensure your resume is uploaded and processed.");
                      });
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F4E2D4] hover:bg-[#CAAE92] text-[#734C23] text-xs font-medium transition-colors"
              >
                <FileCheck className="w-4 h-4" />
                Grade Resume
              </button>
              <button
                onClick={() => {
                  if (resumeText) {
                    setShowSummaryModal(true);
                  } else {
                    // Fetch documents to get resume text
                    fetch("/api/documents", {
                      credentials: "include",
                      cache: "no-store",
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data?.cv?.extractedText) {
                          setResumeText(data.cv.extractedText);
                          setShowSummaryModal(true);
                        } else {
                          alert("Unable to load resume text. Please ensure your resume is uploaded and processed.");
                        }
                      })
                      .catch(() => {
                        alert("Unable to load resume text. Please ensure your resume is uploaded and processed.");
                      });
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F4E2D4] hover:bg-[#CAAE92] text-[#734C23] text-xs font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Generate Summary
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#6B7280]">Not uploaded</p>
        )}
      </div>

      {/* Cover Letter Display */}
      <div className="rounded-xl bg-[#F8F5F2] p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-[#9C6A45]" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-[#1F2937]">Cover Letter</h3>
        </div>
        {documents?.coverLetter.uploaded ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" strokeWidth={1.5} />
              <span className="text-xs font-medium text-[#16A34A]">Uploaded</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1F2937] truncate">{documents.coverLetter.fileName || "Unknown file"}</p>
              {documents.coverLetter.uploadedAt && (
                <p className="text-xs text-[#6B7280] mt-1">
                  {new Date(documents.coverLetter.uploadedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#6B7280]">Not uploaded</p>
        )}
      </div>

      {/* Modals */}
      {showGradingModal && resumeText && (
        <ResumeGradingModal
          isOpen={showGradingModal}
          onClose={() => setShowGradingModal(false)}
          resumeText={resumeText}
        />
      )}
      {showSummaryModal && resumeText && (
        <ResumeSummaryModal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          resumeText={resumeText}
        />
      )}
    </div>
  );
}


