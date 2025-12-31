"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Copy, Download, RefreshCw, FileText } from "lucide-react";
import jsPDF from "jspdf";

interface ResumeOption {
  id: string;
  fileName: string;
  text: string;
  uploadedAt: string;
}

export default function CoverLetterGeneratorPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [resumeOptions, setResumeOptions] = useState<ResumeOption[]>([]);
  const [tone, setTone] = useState<"professional" | "confident" | "friendly">("professional");
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    fetchResumes();
  }, []);

  async function fetchResumes() {
    try {
      const response = await fetch("/api/documents", {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        const options: ResumeOption[] = [];
        
        if (data.cv?.extractedText && data.cv?.fileName) {
          options.push({
            id: "latest",
            fileName: data.cv.fileName,
            text: data.cv.extractedText,
            uploadedAt: data.cv.uploadedAt || new Date().toISOString(),
          });
        }
        
        setResumeOptions(options);
        if (options.length > 0) {
          setSelectedResumeId("latest");
        }
      }
    } catch (err) {
      console.error("Failed to fetch resumes:", err);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!jobDescription.trim()) {
      setError("Please provide a job description");
      return;
    }

    const selectedResume = resumeOptions.find((r) => r.id === selectedResumeId);
    let resumeText = "";
    
    if (selectedResumeId && selectedResume) {
      resumeText = selectedResume.text || "";
      // If resume is selected but has no text, show warning but continue
      if (!resumeText.trim()) {
        console.warn("Selected resume has no text content");
      }
    }

    setLoading(true);
    setError(null);
    setCoverLetter("");

    try {
      const result = await apiClient.post<{ cover_letter: string }>("/coverletter/generate", {
        jd: jobDescription.trim(),
        resume: resumeText.trim(),
        tone: tone,
      });
      setCoverLetter(result.cover_letter);
      
      // Extract company name from job description for PDF filename
      // Try multiple patterns: "at Company", "with Company", "for Company", "Company Name"
      const patterns = [
        /(?:at|with|for)\s+([A-Z][a-zA-Z0-9\s&.,-]+?)(?:\s|$|,|\.)/i,
        /company[:\s]+([A-Z][a-zA-Z0-9\s&.,-]+?)(?:\s|$|,|\.)/i,
        /([A-Z][a-zA-Z0-9\s&.,-]+?)\s+(?:is|seeks|looking|hiring)/i,
      ];
      
      let extractedCompany = "company";
      for (const pattern of patterns) {
        const match = jobDescription.match(pattern);
        if (match && match[1]) {
          extractedCompany = match[1].trim();
          break;
        }
      }
      
      // Sanitize company name for filename
      const sanitized = extractedCompany
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50); // Limit length
      
      setCompanyName(sanitized || "company");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cover letter");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!coverLetter.trim()) return;
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadPDF() {
    if (!coverLetter.trim()) return;
    
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Set margins (professional margins: 25mm top/bottom, 20mm left/right)
    const marginTop = 25;
    const marginBottom = 25;
    const marginLeft = 20;
    const marginRight = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - marginLeft - marginRight;
    
    // Set professional typography
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lineHeight = 6;
    const paragraphSpacing = 4;
    
    // Split text into lines that fit the page width
    const lines = doc.splitTextToSize(coverLetter, maxWidth);
    
    let y = marginTop;
    let isFirstLine = true;
    
    lines.forEach((line: string, index: number) => {
      // Check if we need a new page
      if (y + lineHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
        isFirstLine = true;
      }
      
      // Add paragraph spacing (skip for first line and after blank lines)
      if (!isFirstLine && index > 0 && lines[index - 1].trim() === "" && line.trim() !== "") {
        y += paragraphSpacing;
      }
      
      // Draw the line
      doc.text(line, marginLeft, y);
      y += lineHeight;
      isFirstLine = false;
    });

    // Generate filename: cover-letter-{company}-{date}.pdf
    const date = new Date().toISOString().split("T")[0];
    const sanitizedCompany = (companyName || "company")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const filename = `cover-letter-${sanitizedCompany}-${date}.pdf`;
    
    doc.save(filename);
  }

  function handleRegenerate() {
    setCoverLetter("");
    setError(null);
    // Trigger form submission
    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }
  }

  const selectedResume = resumeOptions.find((r) => r.id === selectedResumeId);

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-[#9C6A45]" strokeWidth={1.5} />
          <h1 className="text-3xl font-bold text-[#1F2937]">Cover Letter Generator</h1>
        </div>
        <p className="text-[#6B7280]">
          Generate a tailored cover letter based on a job description and your resume.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Job Description Input */}
        <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30">
          <label htmlFor="jobDescription" className="block text-sm font-medium text-[#1F2937] mb-2">
            Job Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={12}
            placeholder="Paste the job description here. Include details about the role, requirements, and company information..."
            className="w-full rounded-lg border border-[#CAAE92] bg-white px-4 py-3 text-[#1F2937] focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 text-sm"
            required
          />
        </div>

        {/* Resume Selector */}
        <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30">
          <label htmlFor="resumeSelector" className="block text-sm font-medium text-[#1F2937] mb-2">
            Resume
          </label>
          {resumeOptions.length > 0 ? (
            <select
              id="resumeSelector"
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full rounded-lg border border-[#CAAE92] bg-white px-4 py-2 text-[#1F2937] focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20"
            >
              {resumeOptions.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.fileName} {resume.id === "latest" ? "(Latest)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-[#CAAE92] bg-white px-4 py-3 text-[#6B7280] text-sm">
              No resumes uploaded. Please upload a resume from the Dashboard.
            </div>
          )}
          <p className="mt-2 text-xs text-[#6B7280]">
            {selectedResumeId ? `Using: ${selectedResume?.fileName || "Unknown"}` : "Optional - will use your latest uploaded resume"}
          </p>
        </div>

        {/* Tone Selector */}
        <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30">
          <label htmlFor="toneSelector" className="block text-sm font-medium text-[#1F2937] mb-2">
            Tone
          </label>
          <select
            id="toneSelector"
            value={tone}
            onChange={(e) => setTone(e.target.value as "professional" | "confident" | "friendly")}
            className="w-full rounded-lg border border-[#CAAE92] bg-white px-4 py-2 text-[#1F2937] focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20"
          >
            <option value="professional">Professional</option>
            <option value="confident">Confident</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        {/* Generate Button */}
        <button
          type="submit"
          disabled={loading || !jobDescription.trim()}
          className="w-full rounded-lg bg-[#734C23] px-6 py-3 font-medium text-white hover:bg-[#9C6A45] disabled:bg-[#CAAE92] disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Generating Cover Letter...
            </>
          ) : (
            "Generate Cover Letter"
          )}
        </button>
      </form>

      {/* Output Panel */}
      {coverLetter && (
        <div className="rounded-xl bg-[#F8F5F2] p-6 shadow-sm border border-[#CAAE92]/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#1F2937]">Generated Cover Letter</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-lg border border-[#CAAE92] bg-white px-4 py-2 text-sm font-medium text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 rounded-lg bg-[#734C23] px-4 py-2 text-sm font-medium text-white hover:bg-[#9C6A45] transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-2 rounded-lg border border-[#CAAE92] bg-white px-4 py-2 text-sm font-medium text-[#734C23] hover:bg-[#F4E2D4] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>
          </div>
          
          {/* Editable Cover Letter */}
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-[#CAAE92] bg-white px-4 py-3 text-[#1F2937] focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 text-sm leading-relaxed resize-y"
            placeholder="Generated cover letter will appear here. You can edit it before copying or downloading."
          />
        </div>
      )}
    </section>
  );
}

