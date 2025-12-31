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

export default function AnalyzePage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState("");
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  async function fetchJob() {
    try {
      // Use optimized single job endpoint instead of fetching all jobs
      const data = await apiClient.get<Job>(`/jobs/${jobId}`);
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoadingJob(false);
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!job?.jd_text || !resume.trim()) {
      setError("Please provide both resume and job description");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<{ match: number }>("/analyze", {
        resume: resume.trim(),
        jd: job.jd_text,
      });
      setMatchScore(result.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze match");
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
        <Link href="/jobs" className="text-[#734C23] hover:underline mb-4 inline-block">
          ← Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Analyze Job Match</h1>
        {job && (
          <p className="mt-2 text-gray-600">
            {job.title} at {job.company}
          </p>
        )}
      </div>

      {/* Job Description */}
      {job && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-gray-700">{job.jd_text || "No description available."}</p>
          </div>
        </div>
      )}

      {/* Resume Input Form */}
      <form onSubmit={handleAnalyze} className="space-y-4">
        <div className="rounded-lg border bg-white p-6">
          <label htmlFor="resume" className="block text-sm font-medium text-gray-700 mb-2">
            Your Resume
          </label>
          <textarea
            id="resume"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={15}
            placeholder="Paste your resume text here..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
            required
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || !resume.trim()}
            className="rounded-lg bg-[#734C23] px-6 py-2 font-medium text-white hover:bg-[#9C6A45] disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Analyzing..." : "Analyze Match"}
          </button>
          {matchScore !== null && (
            <Link
              href={`/resume/${jobId}`}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              Tailor Resume →
            </Link>
          )}
        </div>
      </form>

      {/* Match Score Result */}
      {matchScore !== null && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Match Score</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-[#734C23] transition-all duration-500"
                  style={{ width: `${matchScore}%` }}
                />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{matchScore}%</div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            This score indicates how well your resume matches the job requirements.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}
    </section>
  );
}

