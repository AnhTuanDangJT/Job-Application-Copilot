"use client";

import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Resume {
  id: string;
  conversationId: string;
  sharedBy: string;
  sharedTo: string;
  originalName: string;
  mimeType: string;
  size: number;
  sharedAt: string;
  viewedAt?: string;
  status: "PENDING_REVIEW" | "REVIEWED";
  reviewedAt?: string;
  reviewedBy?: string;
  purpose?: "REVIEW" | "REFERENCE" | "EDITED_VERSION";
  versionNumber?: number;
}

interface ResumeSharePanelProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
}

interface Feedback {
  id: string;
  resumeShareId: string;
  rating?: number;
}

function ResumeSharePanel({ conversationId, userRole }: ResumeSharePanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Get current user ID to determine uploader
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }
    fetchUser();
  }, []);

  // Use React Query for resumes with caching
  const { data: resumesData, isLoading: loadingResumes, error: resumesError } = useQuery<{ resumes: Resume[] }>({
    queryKey: ["resumes", conversationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/resumes`,
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        router.push("/auth/login");
        throw new Error("Unauthorized");
      } else if (response.status === 403 || response.status === 404) {
        throw new Error("Cannot access resumes. Conversation may have been deleted.");
      } else if (!response.ok) {
        throw new Error("Failed to load resumes");
      }

      return response.json();
    },
    staleTime: 60_000, // Cache for 60 seconds
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  // Use React Query for feedbacks with caching
  const { data: feedbacksData } = useQuery<{ feedbacks: Feedback[] }>({
    queryKey: ["feedback", conversationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/feedback`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        return { feedbacks: [] };
      }

      return response.json();
    },
    staleTime: 60_000, // Cache for 60 seconds
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  const resumes = resumesData?.resumes || [];
  const feedbacks = feedbacksData?.feedbacks || [];
  const loading = loadingResumes;
  const resumesErrorMessage = resumesError ? (resumesError as Error).message : null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Reset error
    setError(null);

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const allowedExtensions = [".pdf", ".docx", ".doc"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      setError("Invalid file type. Only PDF, DOC, and DOCX files are allowed.");
      setSelectedFile(null);
      e.target.value = ""; // Reset input
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setError(`File size (${fileSizeMB}MB) exceeds 5MB limit`);
      setSelectedFile(null);
      e.target.value = ""; // Reset input
      return;
    }

    // File is valid, set it for upload
    setSelectedFile(file);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Use React Query mutation for upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/mentor-communication/conversations/${conversationId}/resumes`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (response.status === 401) {
        router.push("/auth/login");
        throw new Error("Unauthorized");
      } else if (response.status === 403 || response.status === 404) {
        throw new Error("Cannot upload. Conversation may have been deleted.");
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to upload resume" }));
        // Backend returns { error: string, message?: string }
        const errorMessage = errorData.message || errorData.error || `Server error (${response.status})`;
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch resumes and feedbacks
      queryClient.invalidateQueries({ queryKey: ["resumes", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["feedback", conversationId] });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setError(null);
      // Show success message based on role
      if (userRole === "mentee") {
        setSuccess("Resume uploaded for mentor review");
      } else {
        setSuccess("Reference resume shared with mentee");
      }
      setTimeout(() => setSuccess(null), 5000);
    },
    onError: (error: Error) => {
      setError(error.message || "Network error. Please try again.");
    },
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError(null);
    uploadMutation.mutate(selectedFile);
  };

  const uploading = uploadMutation.isPending;

  const handleDownload = (resumeId: string, fileName: string) => {
    try {
      const link = document.createElement("a");
      link.href = `/api/mentor-communication/resumes/${resumeId}/download`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading resume:", error);
      setError("Failed to download resume. Please try again.");
    }
  };

  // Memoize file size formatting
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }, []);

  const getStatusBadge = (status: "PENDING_REVIEW" | "REVIEWED") => {
    if (status === "REVIEWED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          Reviewed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
        Pending Review
      </span>
    );
  };

  const getPurposeBadge = (purpose?: "REVIEW" | "REFERENCE" | "EDITED_VERSION") => {
    if (purpose === "REFERENCE" || purpose === "EDITED_VERSION") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F4E2D4] text-[#734C23] border border-[#CAAE92]">
          {purpose === "EDITED_VERSION" ? "Edited Version" : "Reference"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
        Review
      </span>
    );
  };

  const getUploaderLabel = (resume: Resume) => {
    if (resume.sharedBy === currentUserId) {
      return userRole === "mentee" ? "Uploaded by You (Mentee)" : "Uploaded by You (Mentor)";
    }
    // Determine uploader based on purpose
    if (resume.purpose === "REVIEW") {
      return "Uploaded by Mentee";
    } else {
      return "Uploaded by Mentor";
    }
  };

  /**
   * Truncate filename while preserving file extension
   * @param filename - Original filename
   * @param maxLength - Maximum length before truncation (default: 40)
   * @returns Truncated filename with ellipsis and preserved extension
   */
  const truncateFilename = (filename: string, maxLength: number = 40): string => {
    if (filename.length <= maxLength) {
      return filename;
    }

    // Get file extension
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) {
      // No extension, just truncate
      return filename.substring(0, maxLength - 3) + "...";
    }

    const extension = filename.substring(lastDotIndex); // includes the dot
    const nameWithoutExt = filename.substring(0, lastDotIndex);

    // Calculate available space for name (maxLength - "..." - extension length)
    const availableLength = maxLength - 3 - extension.length;

    if (availableLength <= 0) {
      // Extension is longer than maxLength, return as is or just show extension
      return filename.length > maxLength 
        ? "..." + extension 
        : filename;
    }

    // Truncate name part and add ellipsis + extension
    return nameWithoutExt.substring(0, availableLength) + "..." + extension;
  };

  return (
    <div className="rounded-lg border bg-white p-4 w-full overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Resumes</h2>

      {/* Success message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Upload Section (Both mentee and mentor) */}
      {(userRole === "mentee" || userRole === "mentor") && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {userRole === "mentee" ? "Upload Resume for Review" : "Upload Reference Resume"}
          </label>
          
          {/* File input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          
          {/* Browse button */}
          <button
            type="button"
            onClick={handleBrowseClick}
            disabled={uploading}
            className="w-full mb-3 px-4 py-2 bg-[#734C23] text-white rounded-lg hover:bg-[#9C6A45] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {userRole === "mentee" ? "Upload Resume for Review" : "Upload Reference Resume"}
          </button>
          
          {/* Selected file info */}
          {selectedFile && (
            <div className="mb-3 p-3 bg-white rounded border border-gray-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p 
                    className="text-sm font-medium text-gray-900 truncate max-w-[200px]"
                    title={selectedFile.name}
                  >
                    {truncateFilename(selectedFile.name, 40)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                  disabled={uploading}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* Upload button (only show when file is selected) */}
          {selectedFile && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          )}
          
          {/* Error message */}
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {/* Resumes List */}
      {resumesErrorMessage && !loading && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">{resumesErrorMessage}</p>
        </div>
      )}
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      ) : resumes.length === 0 ? (
        <div className="text-center py-8">
          {(userRole === "mentee" || userRole === "mentor") ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {userRole === "mentee" 
                  ? "Upload your resume to start your first review."
                  : "No resumes shared yet. You can upload a reference resume or ask your mentee to upload their resume."}
              </p>
              <button
                onClick={handleBrowseClick}
                className="inline-block px-4 py-2 bg-[#734C23] text-white rounded-lg hover:bg-[#9C6A45] text-sm font-medium transition-colors"
              >
                {userRole === "mentee" ? "Upload Resume" : "Upload Reference Resume"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                No resumes shared yet.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 w-full overflow-hidden">
          {/* Timeline View */}
          {resumes.map((resume, index) => {
            const feedback = feedbacks.find((f) => f.resumeShareId === resume.id);
            const isReviewResume = resume.purpose === "REVIEW";
            const prevReviewResume = resumes
              .slice(0, index)
              .reverse()
              .find((r) => r.purpose === "REVIEW");
            const prevFeedback = prevReviewResume
              ? feedbacks.find((f) => f.resumeShareId === prevReviewResume.id)
              : null;

            return (
              <div key={resume.id} className="relative">
                {/* Timeline line */}
                {index < resumes.length - 1 && (
                  <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-gray-300"></div>
                )}
                
                <div className="flex gap-4 min-w-0">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      resume.status === "REVIEWED"
                        ? "bg-green-100 border-green-500"
                        : "bg-gray-100 border-gray-400"
                    }`}>
                      {resume.status === "REVIEWED" ? (
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4 min-w-0 w-full">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 w-full min-w-0">
                      <div className="flex items-start justify-between min-w-0 mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          {isReviewResume && resume.versionNumber && (
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              Resume v{resume.versionNumber} {resume.status === "REVIEWED" && "Reviewed"}
                            </p>
                          )}
                          {!isReviewResume && (
                            <p 
                              className="text-sm font-medium text-gray-900 truncate mb-1 min-w-0"
                              title={resume.originalName}
                            >
                              {truncateFilename(resume.originalName, 40)}
                            </p>
                          )}
                          {isReviewResume && !resume.versionNumber && (
                            <p 
                              className="text-sm font-medium text-gray-900 truncate mb-1 min-w-0"
                              title={resume.originalName}
                            >
                              {truncateFilename(resume.originalName, 40)}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {getPurposeBadge(resume.purpose)}
                            {getStatusBadge(resume.status || "PENDING_REVIEW")}
                            {feedback?.rating && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                                {"⭐".repeat(feedback.rating)}
                              </span>
                            )}
                          </div>
                          
                          {prevFeedback?.rating && feedback?.rating && prevFeedback.rating < feedback.rating && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              ↑ Improved from {prevFeedback.rating}⭐ to {feedback.rating}⭐
                            </p>
                          )}
                          
                          <p className="text-xs text-gray-600 mt-1">
                            {getUploaderLabel(resume)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(resume.id, resume.originalName)}
                          className="shrink-0 px-3 py-1 text-sm bg-[#734C23] text-white rounded hover:bg-[#9C6A45] transition-colors"
                        >
                          Download
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>
                          {formatFileSize(resume.size)} • {new Date(resume.sharedAt).toLocaleDateString()}
                        </p>
                        {resume.status === "REVIEWED" && resume.reviewedAt && (
                          <p>
                            Reviewed on {new Date(resume.reviewedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ResumeSharePanel);

