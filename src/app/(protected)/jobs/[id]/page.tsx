"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

interface Job {
  id: string;
  title: string;
  company: string;
  jd_text?: string;
  source?: string;
  createdAt?: string;
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        const data = await apiClient.get<Job>(`/jobs/${jobId}`);
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job");
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg border bg-white p-6 shadow-sm animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      </section>
    );
  }

  if (error || !job) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-800">{error || "Job not found"}</p>
        </div>
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
        <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
        <p className="mt-2 text-xl text-gray-600">{job.company}</p>
        {job.source && (
          <p className="mt-1 text-sm text-gray-500">Source: {job.source}</p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
        {job.jd_text ? (
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{job.jd_text}</p>
          </div>
        ) : (
          <p className="text-gray-500">No job description available.</p>
        )}
      </div>

      <div className="flex gap-4">
        <Link
          href={`/analyze/${job.id}`}
          className="rounded-md bg-[#734C23] px-6 py-2 text-sm font-medium text-white hover:bg-[#9C6A45]"
        >
          Analyze Fit
        </Link>
        <Link
          href={`/apply/${job.id}`}
          className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Apply Now
        </Link>
      </div>
    </section>
  );
}




