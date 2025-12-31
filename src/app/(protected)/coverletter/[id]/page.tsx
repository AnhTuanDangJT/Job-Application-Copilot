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

export default function CoverLetterPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState("");
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [tone, setTone] = useState<"professional" | "confident" | "friendly">("professional");

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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!job?.jd_text || !resume.trim()) {
      setError("Please provide both resume and job description");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use new AI endpoint
      const result = await apiClient.post<{ cover_letter: string }>("/ai/cover-letter", {
        jobDescription: job.jd_text,
        resumeText: resume.trim(),
        tone: tone,
      });
      setCoverLetter(result.cover_letter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cover letter");
    } finally {
      setLoading(false);
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
        <Link href={`/resume/${jobId}`} className="text-[#734C23] hover:underline mb-4 inline-block">
          ← Back to Resume
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Generate Cover Letter</h1>
        {job && (
          <p className="mt-2 text-gray-600">
            Create a personalized cover letter for {job.title} at {job.company}
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
      <form onSubmit={handleGenerate} className="space-y-4">
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

        <div className="rounded-lg border bg-white p-4">
          <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">
            Tone
          </label>
          <select
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as "professional" | "confident" | "friendly")}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 md:py-2 text-base md:text-sm focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] min-h-[44px]"
          >
            <option value="professional">Professional</option>
            <option value="confident">Confident</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !resume.trim()}
          className="w-full md:w-auto rounded-lg bg-[#734C23] px-6 py-4 md:py-2 font-medium text-white hover:bg-[#9C6A45] disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
        >
          {loading ? "Generating Cover Letter..." : "Generate Cover Letter"}
        </button>
      </form>

      {/* Cover Letter Result */}
      {coverLetter && (
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Generated Cover Letter</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(coverLetter);
                  alert("Cover letter copied to clipboard!");
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-3 md:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] md:min-h-0"
              >
                Copy
              </button>
              <Link
                href={`/apply/${jobId}`}
                className="rounded-md bg-[#734C23] px-4 py-3 md:py-2 text-sm font-medium text-white hover:bg-[#9C6A45] min-h-[44px] md:min-h-0 flex items-center justify-center"
              >
                Submit Application →
              </Link>
            </div>
          </div>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={20}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 md:py-2 font-mono text-base md:text-sm focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] min-h-[44px]"
              placeholder="Generated cover letter will appear here. You can edit it before using."
            />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}
    </section>
  );
}

