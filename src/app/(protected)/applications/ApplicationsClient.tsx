"use client";

import Link from "next/link";
import { useApplications, useUpdateApplicationStatus, Application } from "@/hooks/useApplications";

function getStatusColor(status: string) {
  switch (status) {
    case "offer":
      return "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20";
    case "interview":
      return "bg-[#9C6A45]/10 text-[#9C6A45] border border-[#9C6A45]/20";
    case "submitted":
      return "bg-[#F4E2D4] text-[#734C23] border border-[#CAAE92]";
    case "rejected":
      return "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20";
    default:
      return "bg-[#F4E2D4] text-[#6B7280] border border-[#CAAE92]";
  }
}

function ApplicationsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-[#F8F5F2] p-6 shadow-sm animate-pulse">
          <div className="h-6 bg-[#CAAE92]/30 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-[#CAAE92]/30 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-[#CAAE92]/30 rounded w-1/4"></div>
        </div>
      ))}
    </div>
  );
}

export default function ApplicationsClient() {
  const { data: applications, isLoading, error } = useApplications();
  const updateStatus = useUpdateApplicationStatus();

  if (isLoading) {
    return <ApplicationsSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[#F8F5F2] p-12 text-center">
        <p className="text-[#DC2626] mb-4">Failed to load applications. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-block rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-6 py-2 text-white font-medium shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="rounded-2xl bg-[#F8F5F2] p-12 text-center">
        <p className="text-[#6B7280] mb-4">No applications yet.</p>
        <Link
          href="/jobs"
          className="inline-block rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-6 py-2 text-white font-medium shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Browse Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <div
          key={app.id}
          className="rounded-2xl bg-[#F8F5F2] p-6 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-[#1F2937]">
                {app.job?.title || "Unknown Position"} at {app.job?.company || "Unknown Company"}
              </h3>
              {app.job?.jd_text && (
                <p className="mt-2 text-sm text-[#6B7280] line-clamp-2">{app.job.jd_text}</p>
              )}
              {app.dateSubmitted && (
                <p className="mt-2 text-xs text-[#6B7280]">
                  Submitted: {new Date(app.dateSubmitted).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="ml-4 flex flex-col items-end gap-2">
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                  app.status
                )}`}
              >
                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
              </span>
              {app.job && (
                <Link
                  href={`/jobs`}
                  className="text-xs text-[#734C23] hover:text-[#9C6A45] font-medium transition-colors"
                >
                  View Job →
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

