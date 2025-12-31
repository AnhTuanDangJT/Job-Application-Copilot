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

export default function ApplyPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resume.trim()) {
      setError("Resume is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await apiClient.post<{ id: string }>("/apply/submit", {
        jobId,
        resume_version: resume.trim(),
        cover_letter: coverLetter.trim() || undefined,
      });
      setSuccess(true);
      // Redirect to applications page after 2 seconds
      setTimeout(() => {
        router.push("/applications");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setSubmitting(false);
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

  if (success) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <h2 className="text-xl font-semibold text-green-900 mb-2">Application Submitted!</h2>
          <p className="text-green-700">Your application has been submitted successfully. Redirecting to applications...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/jobs" className="text-[#734C23] hover:underline mb-4 inline-block">
          ← Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Submit Application</h1>
        {job && (
          <p className="mt-2 text-gray-600">
            Submit your application for {job.title} at {job.company}
          </p>
        )}
      </div>

      {/* Job Description */}
      {job && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Job: {job.title} at {job.company}</h2>
          <Link
            href={`/coverletter/${jobId}`}
            className="text-sm text-[#734C23] hover:underline"
          >
            Need a cover letter? Generate one →
          </Link>
        </div>
      )}

      {/* Application Form */}
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-4">
        <div className="rounded-lg border bg-white p-6">
          <label htmlFor="resume" className="block text-sm font-medium text-gray-700 mb-2">
            Resume <span className="text-red-500">*</span>
          </label>
          <textarea
            id="resume"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={15}
            placeholder="Paste your resume text here (required)..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 md:py-2 focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] font-mono text-base md:text-sm min-h-[44px]"
            required
          />
        </div>

        <div className="rounded-lg border bg-white p-6">
          <label htmlFor="coverLetter" className="block text-sm font-medium text-gray-700 mb-2">
            Cover Letter (Optional)
          </label>
          <textarea
            id="coverLetter"
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={12}
            placeholder="Paste your cover letter text here (optional)..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 md:py-2 focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45] font-mono text-base md:text-sm min-h-[44px]"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <button
            type="submit"
            disabled={submitting || !resume.trim()}
            className="w-full md:w-auto rounded-lg bg-green-600 px-6 py-4 md:py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
          <Link
            href="/jobs"
            className="w-full md:w-auto text-center rounded-lg border border-gray-300 bg-white px-6 py-4 md:py-2 font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] flex items-center justify-center"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}
    </section>
  );
}

