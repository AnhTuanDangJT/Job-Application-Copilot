"use client";

/**
 * Job Listings Page
 * 
 * DETECTED SKILLS SOURCE:
 * - Skills are extracted from uploaded CV/resume text using the extractSkillsFromResume() 
 *   function from @/lib/resume/extractSkills.ts
 * - The resume text comes from the /api/documents endpoint, which returns cv.extractedText 
 *   or coverLetter.extractedText from the User model
 * - Skills are available as a string[] array in the extractedSkills state variable
 * - The extraction function matches resume text against a predefined list of common 
 *   technical skills (Java, Python, React, etc.)
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import UploadResume from "@/components/UploadResume";
import JobCard from "@/components/jobs/JobCard";
import { scoreJob, type JobType } from "@/lib/resume/scoreJob";
import { extractSkillsFromResume } from "@/lib/resume/extractSkills";
import type { ExternalJob } from "@/types/jobs";

interface MatchedJob {
  id: string;
  title: string;
  company: string;
  description?: string; // Mapped from jd_text
  location?: string | null;
  skills?: string[];
  tags?: string[];
  jd_text?: string; // Keep for backward compatibility
  source?: string;
  createdAt?: string;
  matchScore: number;
  matchedSkills: string[];
  matchedTechStack: string[];
  matchedJobTitles: string[];
  // External job fields (mapped from ExternalJob interface)
  logoUrl?: string;  // company logo if available
  url?: string;      // link to apply (for external jobs)
}

function JobsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-[#F8F5F2] p-6 shadow-sm animate-pulse">
          <div className="h-6 bg-[#CAAE92]/30 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-[#CAAE92]/30 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-[#CAAE92]/30 rounded w-full mb-2"></div>
          <div className="h-4 bg-[#CAAE92]/30 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}

interface DocumentInfo {
  uploaded: boolean;
  fileName: string | null;
  storagePath: string | null;
  uploadedAt: string | null;
  extractedText: string | null;
  extractedTextPreview: string | null;
  extractedTextLength: number;
}

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<MatchedJob[]>([]);
  const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [fetchingExternal, setFetchingExternal] = useState(false);

  // Fetch documents using the new document system
  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", {
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Failed to fetch documents");
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching documents:", error);
      return null;
    }
  }, []);

  // Match jobs with resume
  const matchJobs = useCallback(async (resumeText: string, searchQuery: string = "") => {
    try {
      const response = await fetch("/api/jobs/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          resumeText,
          searchQuery: searchQuery.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to match jobs");
      }

      const data = await response.json();
      return { jobs: data.jobs || [], error: null };
    } catch (error) {
      console.error("Error matching jobs:", error);
      const errorMessage = error instanceof Error ? error.message : "Error matching jobs";
      return { jobs: [], error: errorMessage };
    }
  }, []);

  // Search external jobs based on detected skills using /api/jobs/search
  // Performance: Only makes API call when skills array is not empty OR query is provided
  // Add AbortController support to prevent race conditions
  const searchExternalJobs = useCallback(async (skills: string[], query: string = "", signal?: AbortSignal, resumeTextForRanking?: string | null) => {
    // API will handle fallback if both skills and query are empty
    // If no skills but has query, use empty array (API will handle fallback)
    const skillsToSend = skills && skills.length > 0 ? skills : [];

    // Removed console.log for production - diagnostic info only needed in API routes

    setFetchingExternal(true);
    setError(null);
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        signal, // Support abort signal for cancellation
        body: JSON.stringify({
          skills: skillsToSend,
          query: query.trim() || undefined, // Only include if not empty
          resumeText: resumeTextForRanking || undefined, // Pass resume text for AI ranking
        }),
      });

      // Removed console.log for production

      // Check if request was aborted
      if (signal?.aborted) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Unable to fetch jobs right now";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // Removed console.log for production
      
      // Handle both jobs array and error field
      const jobs = data.jobs || [];
      const errorMessage = data.error || null;
      
      // Only update state if request wasn't aborted
      if (!signal?.aborted) {
        setExternalJobs(jobs);
        
        // Set error if provided (even if request succeeded but no jobs found)
        if (errorMessage && jobs.length === 0) {
          setError(errorMessage);
        } else {
          setError(null);
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error searching external jobs:", error);
      const errorMessage = error instanceof Error ? error.message : "Unable to fetch jobs right now";
      if (!signal?.aborted) {
        setError(errorMessage);
        setExternalJobs([]);
      }
    } finally {
      if (!signal?.aborted) {
        setFetchingExternal(false);
      }
    }
  }, []);

  // Handle search button click
  // Note: Search calls the search function directly, no router dependency
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setLoading(true);
    setError(null);
    
    // Use skills if available, otherwise use search term as fallback
    // API will use fallback "software developer junior" if both are empty
    const skillsToUse = extractedSkills && extractedSkills.length > 0 ? extractedSkills : [];
    await searchExternalJobs(skillsToUse, searchTerm, undefined, resumeText);
    setLoading(false);
  }, [extractedSkills, searchTerm, searchExternalJobs, resumeText]);

  // Handle clear button click
  const handleClear = useCallback(async () => {
    setSearchTerm("");
    setError(null);
    
    // Always search, API will use fallback if no skills
    setLoading(true);
    const skillsToUse = extractedSkills && extractedSkills.length > 0 ? extractedSkills : [];
    await searchExternalJobs(skillsToUse, "", undefined, resumeText);
    setLoading(false);
  }, [extractedSkills, searchExternalJobs, resumeText]);

  // Load jobs on mount and when search query changes
  useEffect(() => {
    let isMounted = true;

    async function loadJobs() {
      setLoading(true);

      // Get search query from URL params
      const searchQuery = searchParams.get("q") || "";
      let extractedText: string | null = null;

      try {
        // GET /api/documents to get all uploaded documents
        const documentsData = await fetchDocuments();
        
        if (isMounted) {

          // Get all uploaded documents for the user
          if (documentsData) {
            const allDocuments: DocumentInfo[] = [];

            // Collect CV if uploaded
            if (documentsData.cv?.uploaded && documentsData.cv?.uploadedAt) {
              allDocuments.push(documentsData.cv);
            }

            // Collect Cover Letter if uploaded
            if (documentsData.coverLetter?.uploaded && documentsData.coverLetter?.uploadedAt) {
              allDocuments.push(documentsData.coverLetter);
            }

            // Select the latest document by uploadedAt date
            if (allDocuments.length > 0) {
              const latestDocument = allDocuments.sort((a, b) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
                return dateB - dateA; // Sort descending (newest first)
              })[0];

              // Use doc.extractedText as the resume text
              if (latestDocument?.extractedText && latestDocument.extractedText.trim().length > 0) {
                extractedText = latestDocument.extractedText.trim();
              }
            }
          }

          // Set resume text (null if empty or none)
          setResumeText(extractedText);
          
          // Extract and set skills if resume text exists
          let skills: string[] = [];
          if (extractedText && extractedText.trim().length > 0) {
            skills = extractSkillsFromResume(extractedText);
            setExtractedSkills(skills);
          } else {
            setExtractedSkills([]);
          }

          // If extracted text exists, use matching API
          if (extractedText) {
            const matchResult = await matchJobs(extractedText, searchQuery);
            if (isMounted) {
              if (matchResult.error) {
                console.error("Resume matching failed:", matchResult.error);
                // Fall through to regular job list
              } else {
                setJobs(matchResult.jobs);
                // Also search external jobs if we have skills (set separately)
                // Guard: Only fetch if skills array is not empty
                if (skills && skills.length > 0) {
                  await searchExternalJobs(skills, searchQuery, undefined, extractedText);
                }
                setLoading(false);
                setIsInitialLoad(false);
                return;
              }
            }
          }
          
          // If no resume text but we somehow have skills, search external jobs directly
          // Guard: Only fetch if skills array is not empty
          if (skills && skills.length > 0 && isMounted) {
            await searchExternalJobs(skills, searchQuery, undefined, extractedText);
            setLoading(false);
            setIsInitialLoad(false);
            return;
          }
        }
        
        setIsInitialLoad(false);

        // Always search external jobs, even if no resume text
        // API will use fallback query if no skills/query provided
        await searchExternalJobs([], searchQuery, undefined, null);

        // Fall back to regular job list API (no resume, or matching failed)
        const q = searchQuery.trim();
        const sanitizedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const filter = q
          ? `?q=${encodeURIComponent(sanitizedQ)}`
          : "";

        const response = await fetch(`/api/jobs/list${filter}`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          let convertedJobs: MatchedJob[] = [];
          
          // If we have resume text, score and sort jobs
          if (extractedText && extractedText.trim().length > 0) {
            const extractedSkills = extractSkillsFromResume(extractedText);
            
            // Score and sort jobs by match score
            const scoredJobs = (data.jobs || []).map((job: any) => {
              const jobData: JobType = {
                id: job.id,
                title: job.title,
                company: job.company,
                description: job.description || job.jd_text,
                location: job.location,
                skills: job.skills || [],
                tags: job.tags || [],
                jd_text: job.jd_text,
              };
              
              const rawScore = scoreJob(extractedText || "", extractedSkills, jobData);
              // Normalize to 0-100 for display
              const matchScore = Math.min(Math.round((rawScore / 250) * 100), 100);
              
              return {
                ...job,
                matchScore,
                matchedSkills: [],
                matchedTechStack: [],
                matchedJobTitles: [],
              };
            });
            
            // Sort by match score (descending)
            convertedJobs = scoredJobs.sort((a: MatchedJob, b: MatchedJob) => b.matchScore - a.matchScore);
          } else {
            // No resume text, set matchScore to 0
            convertedJobs = (data.jobs || []).map((job: any) => ({
              ...job,
              matchScore: 0,
              matchedSkills: [],
              matchedTechStack: [],
              matchedJobTitles: [],
            }));
          }
          
          if (isMounted) {
            setJobs(convertedJobs);
          }
        } else {
          throw new Error("Failed to load jobs");
        }
      } catch (error) {
        console.error("Error loading jobs:", error);
        if (isMounted) {
          setJobs([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadJobs();

    return () => {
      isMounted = false;
    };
  }, [searchParams, fetchDocuments, matchJobs, searchExternalJobs]);

  // Trigger job matching when resumeText changes (after initial load)
  // Add cleanup to prevent state updates after unmount
  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    if (!isInitialLoad && resumeText && resumeText.trim().length > 0) {
      // Extract skills when resume text changes
      const skills = extractSkillsFromResume(resumeText);
      if (isMounted) {
        setExtractedSkills(skills);
      }
      
      const searchQuery = searchParams.get("q") || "";
      
      // Create abort controller for this search
      abortController = new AbortController();
      
      matchJobs(resumeText, searchQuery).then((result) => {
        if (!isMounted) return; // Skip if component unmounted
        
        if (result.error) {
          console.error("Resume matching failed:", result.error);
          // Fall back to regular search
          const q = searchQuery.trim();
          const sanitizedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const filter = q ? `?q=${encodeURIComponent(sanitizedQ)}` : "";
          
          fetch(`/api/jobs/list${filter}`, { 
            credentials: "include",
            signal: abortController?.signal 
          })
            .then((res) => {
              if (!isMounted || abortController?.signal.aborted) return null;
              return res.json();
            })
            .then((data) => {
              if (!isMounted || abortController?.signal.aborted || !data) return;
              
              // Score and sort jobs by match score
              const extractedSkills = extractSkillsFromResume(resumeText);
              
              const scoredJobs = (data.jobs || []).map((job: any) => {
                const jobData: JobType = {
                  id: job.id,
                  title: job.title,
                  company: job.company,
                  description: job.description || job.jd_text,
                  location: job.location,
                  skills: job.skills || [],
                  tags: job.tags || [],
                  jd_text: job.jd_text,
                };
                
                const rawScore = scoreJob(resumeText, extractedSkills, jobData);
                // Normalize to 0-100 for display
                const matchScore = Math.min(Math.round((rawScore / 250) * 100), 100);
                
                return {
                  ...job,
                  matchScore,
                  matchedSkills: [],
                  matchedTechStack: [],
                  matchedJobTitles: [],
                };
              });
              
              // Sort by match score (descending)
              const convertedJobs = scoredJobs.sort((a: MatchedJob, b: MatchedJob) => b.matchScore - a.matchScore);
              
              if (isMounted) {
                setJobs(convertedJobs);
                // Also search external jobs if we have skills (set separately)
                // Guard: Only fetch if skills array is not empty
                if (skills && skills.length > 0) {
                  searchExternalJobs(skills, searchQuery, undefined, resumeText);
                }
              }
            })
            .catch((err) => {
              if (err.name === "AbortError" || !isMounted) return;
              console.error("Error loading jobs:", err);
              if (isMounted) {
                setJobs([]);
              }
            });
        } else {
          if (isMounted) {
            setJobs(result.jobs);
            // Also search external jobs if we have skills (set separately)
            // Guard: Only fetch if skills array is not empty
            if (skills && skills.length > 0) {
              searchExternalJobs(skills, searchQuery, undefined, resumeText);
            }
          }
        }
      }).catch((err) => {
        if (!isMounted) return;
        console.error("Error in matchJobs:", err);
      });
    }

    return () => {
      isMounted = false;
      abortController?.abort();
    };
  }, [resumeText, isInitialLoad, searchParams, matchJobs, searchExternalJobs]);

  const isResumeMatch = !!(resumeText && jobs.length > 0 && jobs.some(job => job.matchScore > 0));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1F2937]">Job Listings</h1>
        <p className="mt-2 text-[#6B7280]">
          Browse available jobs and find opportunities that match your skills. Jobs are automatically matched to your resume when available.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            // Prevent form submission on Enter (only submit on button click)
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Search by job title or company..."
          className="flex-1 rounded-lg border border-[#CAAE92] bg-[#F4E2D4]/50 px-4 py-2 text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#9C6A45] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 transition-all"
          disabled={loading || fetchingExternal}
        />
        <button
          type="submit"
          disabled={loading || fetchingExternal}
          className="rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] px-6 py-2 text-white font-medium shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#9C6A45]/20 disabled:opacity-50 disabled:transform-none transition-all duration-200"
          title={extractedSkills.length === 0 ? "Upload a CV to enable skill-based search" : "Search for jobs"}
        >
          {loading || fetchingExternal ? "Searching..." : "Search"}
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            disabled={loading || fetchingExternal}
            className="rounded-xl border border-[#CAAE92] bg-[#F8F5F2] px-6 py-2 text-[#734C23] font-medium hover:bg-[#F4E2D4] disabled:opacity-50 transition-all duration-200"
          >
            Clear
          </button>
        )}
      </form>

      {/* Skill Summary Section - Always visible when skills are detected */}
      {resumeText && extractedSkills.length > 0 && (
        <div className="rounded-2xl bg-[#F8F5F2] border border-[#CAAE92]/30 p-4">
          <h2 className="text-sm font-semibold text-[#1F2937] mb-2">Your detected skills:</h2>
          <div className="flex flex-wrap gap-2">
            {extractedSkills.map((skill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-lg bg-[#F4E2D4] px-2.5 py-1 text-xs font-medium text-[#734C23]"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Show UploadResume if no resume text available */}
      {!loading && !resumeText && (
        <UploadResume
          onTextExtracted={(text) => {
            setResumeText(text);
            const skills = extractSkillsFromResume(text);
            setExtractedSkills(skills);
            
            // Trigger job search with detected skills when resume is uploaded
            // Guard: Only fetch if skills array is not empty
            if (skills && skills.length > 0) {
              const searchQuery = searchParams.get("q") || "";
              setSearchTerm(searchQuery);
              setLoading(true);
              searchExternalJobs(skills, searchQuery, undefined, text).finally(() => {
                setLoading(false);
              });
            }
          }}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-[#DC2626]/30 bg-[#DC2626]/10 p-4">
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading || fetchingExternal ? (
        <div>
          <p className="text-sm text-[#6B7280] mb-4">
            Searching jobs that match your skills…
          </p>
          <JobsSkeleton />
        </div>
      ) : externalJobs.length === 0 && jobs.length === 0 ? (
        <div className="rounded-2xl bg-[#F8F5F2] p-12 text-center">
          <p className="text-[#6B7280]">No jobs found. Try adjusting your search or updating your CV.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {isResumeMatch && jobs.length > 0 && (
            <div className="rounded-2xl border border-[#9C6A45]/30 bg-[#F4E2D4] p-4">
              <p className="text-sm text-[#734C23]">
                <span className="font-semibold">✨ Resume-Based Matching:</span> These jobs are ranked by relevance to your uploaded resume.
              </p>
            </div>
          )}
          
          {/* Internal database jobs (if any) */}
          {jobs.map((job, index) => {
            const isTopMatch = index < 3 && job.matchScore > 0;
            const description = job.description || job.jd_text || "";

            return (
              <JobCard
                key={`internal-${job.id}`}
                id={job.id || `job-${index}`}
                title={job.title || "No title"}
                company={job.company || "Unknown company"}
                location={job.location || undefined}
                description={description}
                url={job.url}
                logoUrl={job.logoUrl}
                source={job.source}
                skills={job.skills || []}
                tags={job.tags || []}
                matchScore={job.matchScore || 0}
                matchedSkills={job.matchedSkills || []}
                matchedTechStack={job.matchedTechStack || []}
                matchedJobTitles={job.matchedJobTitles || []}
                isTopMatch={isTopMatch}
                isResumeMatch={isResumeMatch && (job.matchScore || 0) > 0}
              />
            );
          })}

          {/* External jobs from API */}
          {externalJobs.map((job, index) => (
            <JobCard
              key={`external-${job.id}`}
              id={job.id || `external-job-${index}`}
              title={job.title || "No title"}
              company={job.company || "Unknown company"}
              location={job.location || undefined}
              description={job.description || ""}
              url={job.url || "#"}
              logoUrl={job.logoUrl}
              source={job.source}
              skills={job.skills || []}
              salaryMin={job.salaryMin}
              salaryMax={job.salaryMax}
              salaryCurrency={job.salaryCurrency}
              jobType={job.jobType}
              matchScore={job.matchScore}
              recommendation={job.recommendation}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * ============================================================================
 * MANUAL TESTING INSTRUCTIONS
 * ============================================================================
 * 
 * Follow these steps to manually test the Job Listings feature:
 * 
 * 1. START DEV SERVER:
 *    - Run: `npm run dev` or `pnpm dev`
 *    - Navigate to http://localhost:3000
 * 
 * 2. UPLOAD A RESUME:
 *    - Go to /resume or /dashboard (or wherever the upload is available)
 *    - Upload a PDF or DOCX resume file
 *    - Wait for the upload to complete and text extraction to finish
 * 
 * 3. VERIFY SKILLS DETECTION:
 *    - Navigate to /jobs (Browse Jobs page)
 *    - Confirm "Your detected skills" section is visible above the job listings
 *    - Verify skills are displayed as blue chips/tags (e.g., "Java", "Python", "React")
 * 
 * 4. AUTOMATIC JOB LOADING:
 *    - On page load, confirm external jobs are automatically fetched using detected skills
 *    - Verify a loading state appears: "Searching jobs that match your skills…"
 *    - Confirm job cards appear once loading completes
 * 
 * 5. JOB CARD VERIFICATION:
 *    For each job card, verify it displays:
 *    - ✅ Left side: "Apply" button (blue, clearly visible)
 *    - ✅ Right side:
 *       - Company logo (rounded, 40x40px) OR placeholder circle with first letter
 *       - Job title (bold, prominent)
 *       - Company name + location (with location icon)
 *       - Short description (truncated with line-clamp if long)
 *       - Skills/tags as small pills (if available)
 *       - Source indicator (e.g., "Source: JSearch")
 * 
 * 6. TEST APPLY BUTTON:
 *    - Click the "Apply" button on any external job card
 *    - Verify it opens the job posting URL in a NEW tab (target="_blank")
 *    - Confirm the external job page loads correctly
 * 
 * 7. TEST SEARCH FUNCTIONALITY:
 *    - Type in the search bar (e.g., "Java", "React", "Full Stack Developer")
 *    - Click the "Search" button (do NOT rely on input change - button click only)
 *    - Verify the job list updates with filtered results
 *    - Confirm loading state appears during search
 * 
 * 8. TEST CLEAR FUNCTIONALITY:
 *    - With a search term entered, click the "Clear" button
 *    - Verify search term is cleared
 *    - Confirm jobs reload with default recommendations (skills only, no query)
 * 
 * 9. TEST ERROR STATES:
 *    - Test with no resume uploaded: Verify "No jobs found" message appears
 *    - Test with invalid/weird skills: Verify graceful error handling
 *    - Test with API failures: Verify error message is displayed in red alert box
 * 
 * 10. TEST EMPTY STATES:
 *     - If no jobs match search: Verify message "No jobs found. Try adjusting your search or updating your CV."
 *     - If no skills detected: Verify appropriate messaging
 * 
 * 11. TEST EDGE CASES:
 *     - Company logo fails to load: Verify placeholder with company initial appears
 *     - Missing company name: Verify "?" appears in placeholder
 *     - Missing location: Verify location section handles gracefully
 *     - Very long descriptions: Verify truncation with "..." works
 *     - Many skills: Verify "+X more" indicator appears for skills > 8
 * 
 * 12. VERIFY COMBINED RESULTS:
 *     - Confirm internal database jobs (if any) appear first
 *     - Confirm external API jobs appear after internal jobs
 *     - Verify both types use consistent styling
 * 
 * ============================================================================
 */
