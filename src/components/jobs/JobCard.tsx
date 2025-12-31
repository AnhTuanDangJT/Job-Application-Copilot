"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExternalJob } from "@/types/jobs";

// Logo component with error handling
function CompanyLogo({ logoUrl, company }: { logoUrl?: string; company?: string }) {
  const [imageError, setImageError] = useState(false);
  
  // Always show fallback if no logoUrl, invalid URL, or image failed to load
  if (!logoUrl || imageError || !logoUrl.startsWith("http")) {
    const companyInitial = company && company.trim().length > 0 
      ? company.trim()[0].toUpperCase() 
      : "?";
    return (
      <div className="h-10 w-10 rounded-full flex items-center justify-center border border-[#CAAE92] text-sm font-semibold bg-[#F4E2D4] text-[#734C23]">
        {companyInitial}
      </div>
    );
  }
  
  return (
    <img
      src={logoUrl}
      alt={`${company || "Company"} logo`}
      className="h-10 w-10 rounded-full object-contain border border-[#CAAE92]"
      onError={() => setImageError(true)}
      loading="lazy"
    />
  );
}

interface JobCardProps {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  description?: string;
  url?: string;
  logoUrl?: string;
  source?: string;
  skills?: string[];
  tags?: string[];
  // Internal job matching fields (optional)
  matchScore?: number;
  matchedSkills?: string[];
  matchedTechStack?: string[];
  matchedJobTitles?: string[];
  isTopMatch?: boolean;
  isResumeMatch?: boolean;
  // New fields
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  jobType?: "remote" | "onsite" | "hybrid";
  recommendation?: "high" | "medium" | "low";
}

/**
 * JobCard Component
 * 
 * Renders a single job card with:
 * - Company logo (with fallback to company initial)
 * - Job title
 * - Company name
 * - Location (with icon)
 * - Description (clamped to 3 lines)
 * - Skills/tags
 * - Apply button (opens external URL or internal route)
 * - Analyze Match button (for internal jobs only)
 * - Match score and badges (for matched jobs)
 */
export default function JobCard({
  id,
  title,
  company,
  location,
  description,
  url,
  logoUrl,
  source,
  skills = [],
  tags = [],
  matchScore = 0,
  matchedSkills = [],
  matchedTechStack = [],
  matchedJobTitles = [],
  isTopMatch = false,
  isResumeMatch = false,
  salaryMin,
  salaryMax,
  salaryCurrency = "USD",
  jobType,
  recommendation,
}: JobCardProps) {
  // Combine skills and tags, filter out invalid entries
  const allSkills = [...(Array.isArray(skills) ? skills : []), ...(Array.isArray(tags) ? tags : [])]
    .filter((s): s is string => s && typeof s === "string" && s.trim().length > 0);
  
  // Calculate match percentage for display
  // If matchScore is already 0-100, use it directly; otherwise multiply by 2 (for 0-50 scale)
  const matchPercent = matchScore > 0 
    ? (matchScore > 100 ? Math.min(100, matchScore * 2) : matchScore)
    : 0;
  
  // Determine quality label from recommendation or matchScore
  const getQualityLabel = (percent: number, rec?: "high" | "medium" | "low"): { label: string; color: string } => {
    if (rec === "high" || percent >= 80) return { label: "High", color: "green" };
    if (rec === "medium" || percent >= 50) return { label: "Medium", color: "yellow" };
    return { label: "Low", color: "gray" };
  };
  
  const quality = getQualityLabel(matchPercent, recommendation);
  
  // Format salary display
  const formatSalary = (): string | null => {
    if (!salaryMin && !salaryMax) {
      return null;
    }
    
    const currency = salaryCurrency || "USD";
    const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency;
    
    if (salaryMin && salaryMax) {
      // Format as range: $80k–$120k
      const minK = Math.round(salaryMin / 1000);
      const maxK = Math.round(salaryMax / 1000);
      return `${currencySymbol}${minK}k–${currencySymbol}${maxK}k`;
    } else if (salaryMin) {
      // Only min: Estimated: $95k
      const minK = Math.round(salaryMin / 1000);
      return `Estimated: ${currencySymbol}${minK}k`;
    } else if (salaryMax) {
      // Only max: Estimated: $95k
      const maxK = Math.round(salaryMax / 1000);
      return `Estimated: ${currencySymbol}${maxK}k`;
    }
    
    return null;
  };
  
  const salaryDisplay = formatSalary();
  
  // Get job type icon
  const getJobTypeIcon = (): string => {
    if (jobType === "remote") return "🌐";
    if (jobType === "hybrid") return "🏠🏢";
    return "📍";
  };
  
  const jobTypeIcon = jobType ? getJobTypeIcon() : null;
  
  // Determine if this is an external job (has valid URL)
  // Ensure url is a string and properly formatted
  const isValidUrl = url && typeof url === "string" && url.trim() !== "" && url !== "#" && 
    (url.startsWith("http://") || url.startsWith("https://"));
  const isExternalJob = isValidUrl;
  
  return (
    <div
      className={`rounded-2xl bg-[#F8F5F2] p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 w-full ${
        isTopMatch ? "ring-2 ring-[#9C6A45] ring-opacity-50" : ""
      }`}
    >
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Company Logo and Job Title */}
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-shrink-0">
              <CompanyLogo logoUrl={logoUrl} company={company} />
            </div>
            <div className="flex-1 min-w-0">
              {/* Job Title */}
              <div className="flex items-start gap-3 flex-wrap mb-2">
                <h3 className="text-xl font-semibold text-[#1F2937] break-words min-w-0">{title || "No title"}</h3>
              </div>
            </div>
          </div>

          {/* Company, Location, Job Type, Salary, and Match Score */}
          <div className="flex items-center gap-3 text-[#6B7280] mb-3 flex-wrap">
            <p className="text-lg font-medium break-words min-w-0">{company || "Unknown company"}</p>
            
            {/* Job Type Icon */}
            {jobTypeIcon && (
              <span className="text-base" title={jobType === "remote" ? "Remote" : jobType === "hybrid" ? "Hybrid" : "Onsite"}>
                {jobTypeIcon}
              </span>
            )}
            
            {/* Location */}
            {location && (
              <div className="flex items-center gap-1 text-sm">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{location}</span>
              </div>
            )}
            
            {/* Match Score Badge */}
            {matchPercent > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[#9C6A45]">
                ⭐ {matchPercent}% Match
              </span>
            )}
            
            {/* Salary */}
            {salaryDisplay && (
              <span className="text-sm font-medium text-[#16A34A]">
                {salaryDisplay}
              </span>
            )}
            
            {/* Highly Recommended Badge (if score >= 80 or recommendation === "high") */}
            {(matchPercent >= 80 || recommendation === "high") && (
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-2 py-0.5 text-xs font-semibold text-white">
                Highly Recommended
              </span>
            )}
          </div>

          {/* Description Preview */}
          {description && description.trim().length > 0 ? (
            <p className="text-sm text-[#6B7280] line-clamp-3 mb-4 break-words overflow-hidden">
              {description}
            </p>
          ) : null}

          {/* Skills/Tags if available */}
          {allSkills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {allSkills.slice(0, 6).map((skill, idx) => {
                const skillText = skill && typeof skill === "string" ? skill.trim() : "Unknown";
                return (
                  <span
                    key={`skill-${idx}-${skillText}`}
                    className="inline-flex items-center rounded-lg bg-[#F4E2D4] px-2 py-1 text-xs font-medium text-[#734C23] break-words max-w-full"
                    title={skillText}
                  >
                    {skillText}
                  </span>
                );
              })}
              {allSkills.length > 6 && (
                <span className="inline-flex items-center rounded-lg bg-[#F4E2D4] px-2 py-1 text-xs font-medium text-[#6B7280]">
                  +{allSkills.length - 6} more
                </span>
              )}
            </div>
          )}

          {/* Matched Skills and Tech Stack (if available from matching) */}
          {isResumeMatch && matchScore > 0 && (
            <div className="mt-3 space-y-2">
              {matchedSkills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Matched Skills:</p>
                  <div className="flex flex-wrap gap-1">
                    {matchedSkills.slice(0, 5).map((skill, idx) => (
                      <span
                        key={`matched-skill-${idx}-${skill}`}
                        className="inline-flex items-center rounded-lg bg-[#9C6A45]/10 px-2 py-0.5 text-xs font-medium text-[#9C6A45]"
                      >
                        {skill || "Unknown"}
                      </span>
                    ))}
                    {matchedSkills.length > 5 && (
                      <span className="inline-flex items-center rounded-lg bg-[#F4E2D4] px-2 py-0.5 text-xs font-medium text-[#6B7280]">
                        +{matchedSkills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              {matchedTechStack.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#6B7280] mb-1">Tech Stack:</p>
                  <div className="flex flex-wrap gap-1">
                    {matchedTechStack.slice(0, 3).map((tech, idx) => (
                      <span
                        key={`tech-${idx}-${tech}`}
                        className="inline-flex items-center rounded-lg bg-[#734C23]/10 px-2 py-0.5 text-xs font-medium text-[#734C23]"
                      >
                        {tech || "Unknown"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source */}
          {source && (
            <p className="mt-3 text-xs text-[#6B7280]">Source: {source}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 md:gap-2 shrink-0 mt-4 md:mt-0">
          {/* Apply button - opens external URL for external jobs, internal route for database jobs */}
          {isExternalJob ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-4 py-4 md:py-2 text-sm font-medium text-white shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-center transition-all duration-200 min-h-[44px] flex items-center justify-center"
            >
              Apply Now
            </a>
          ) : url && url !== "#" ? (
            // Has URL but not valid external URL - disable button
            <button
              disabled
              className="w-full md:w-auto rounded-xl bg-[#CAAE92] px-4 py-4 md:py-2 text-sm font-medium text-white cursor-not-allowed whitespace-nowrap text-center opacity-50 min-h-[44px]"
              title="Invalid application URL"
            >
              Apply Now
            </button>
          ) : (
            <Link
              href={`/apply/${id}`}
              className="w-full md:w-auto rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-4 py-4 md:py-2 text-sm font-medium text-white shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-center transition-all duration-200 min-h-[44px] flex items-center justify-center"
            >
              Apply Now
            </Link>
          )}
          {/* Only show Analyze Match for internal database jobs */}
          {!isExternalJob && (
            <Link
              href={`/analyze/${id}`}
              className="w-full md:w-auto rounded-xl border border-[#CAAE92] bg-[#F8F5F2] px-4 py-4 md:py-2 text-sm font-medium text-[#734C23] hover:bg-[#F4E2D4] whitespace-nowrap text-center transition-all duration-200 min-h-[44px] flex items-center justify-center"
            >
              Analyze Match
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
