"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

interface Job {
  id: string;
  title: string;
  company: string;
  jd_text?: string;
}

export default function ResumePage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState("");
  const [tailoredResume, setTailoredResume] = useState<string | null>(null);
  const [resumeFeedback, setResumeFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  async function fetchJob() {
    try {
      // Use optimized single job endpoint
      const data = await apiClient.get<Job>(`/jobs/${jobId}`);
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoadingJob(false);
    }
  }

  async function handleTailor(e: React.FormEvent) {
    e.preventDefault();
    if (!job?.jd_text || !resume.trim()) {
      setError("Please provide both resume and job description");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<{ resume: string }>("/resume/tailor", {
        resume: resume.trim(),
        jd: job.jd_text,
      });
      setTailoredResume(result.resume);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to tailor resume");
    } finally {
      setLoading(false);
    }
  }

  async function handleGetFeedback() {
    if (!resume.trim()) {
      setError("Please provide your resume text first");
      return;
    }

    setLoadingFeedback(true);
    setError(null);

    try {
      const result = await apiClient.post<{ feedback: string }>("/ai/resume-feedback", {
        resumeText: resume.trim(),
      });
      setResumeFeedback(result.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get resume feedback");
    } finally {
      setLoadingFeedback(false);
    }
  }

  if (loadingJob) {
    return (
      <section className="space-y-4">
        <p className="text-gray-600">Loading job details...</p>
      </section>
    );
  }

  if (error && !job) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
        <Link href="/jobs" className="text-[#734C23] hover:underline">
          ← Back to Jobs
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href={`/analyze/${jobId}`} className="text-[#734C23] hover:underline mb-4 inline-block">
          ← Back to Analysis
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Tailor Resume</h1>
        {job && (
          <p className="mt-2 text-gray-600">
            Customize your resume for {job.title} at {job.company}
          </p>
        )}
      </div>

      {/* Job Description */}
      {job && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Job: {job.title} at {job.company}</h2>
        </div>
      )}

      {/* Resume Input Form */}
      <form onSubmit={handleTailor} className="space-y-4">
        <div className="rounded-lg border bg-white p-6">
          <label htmlFor="resume" className="block text-sm font-medium text-gray-700 mb-2">
            Your Resume
          </label>
          <textarea
            id="resume"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={12}
            placeholder="Paste your resume text here..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 md:py-2 focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] font-mono text-base md:text-sm min-h-[44px]"
            required
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <button
            type="submit"
            disabled={loading || !resume.trim()}
            className="w-full md:w-auto rounded-lg bg-[#734C23] px-6 py-4 md:py-2 font-medium text-white hover:bg-[#9C6A45] disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {loading ? "Tailoring Resume..." : "Tailor Resume"}
          </button>
          <button
            type="button"
            onClick={handleGetFeedback}
            disabled={loadingFeedback || !resume.trim()}
            className="w-full md:w-auto rounded-lg border border-[#734C23] bg-white px-6 py-4 md:py-2 font-medium text-[#734C23] hover:bg-[#F8F5F2] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {loadingFeedback ? "Analyzing..." : "Get Resume Feedback"}
          </button>
        </div>
      </form>

      {/* Tailored Resume Result */}
      {tailoredResume && (
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Tailored Resume</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tailoredResume);
                  alert("Resume copied to clipboard!");
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-3 md:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] md:min-h-0"
              >
                Copy
              </button>
              <Link
                href={`/coverletter/${jobId}`}
                className="rounded-md bg-[#734C23] px-4 py-3 md:py-2 text-sm font-medium text-white hover:bg-[#9C6A45] min-h-[44px] md:min-h-0 flex items-center justify-center"
              >
                Generate Cover Letter →
              </Link>
            </div>
          </div>
          <textarea
            readOnly
            value={tailoredResume}
            rows={20}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-sm"
          />
        </div>
      )}

      {/* Resume Feedback Result */}
      {resumeFeedback && (
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Resume Feedback</h2>
            <button
              onClick={() => setResumeFeedback(null)}
              className="rounded-md border border-gray-300 bg-white px-4 py-3 md:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] md:min-h-0"
            >
              Close
            </button>
          </div>
          <div className="prose max-w-none whitespace-pre-wrap text-sm text-gray-700">
            {resumeFeedback}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}
    </section>
  );
}

