"use client";

import { useState } from "react";
import { getApiUrl } from "@/lib/api-client";

interface FileUploadProps {
  type: "cv" | "coverletter";
  onSuccess?: (message: string) => void;
  onUploadComplete?: () => void;
}

export default function FileUpload({ type, onSuccess, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setSuccess(null);
    setUploadedFileName(null);

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [".pdf", ".docx"];

    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setError("Invalid file type. Only PDF and DOCX files are allowed.");
      e.target.value = ""; // Reset input
      return;
    }

    // Validate file size (5MB)
    if (file.size === 0) {
      setError("File is empty. Please select a valid file.");
      e.target.value = ""; // Reset input
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setError(`File size (${fileSizeMB}MB) exceeds 5MB limit`);
      e.target.value = ""; // Reset input
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const endpoint = type === "cv" ? "/upload/cv" : "/upload/coverletter";
      
      const response = await fetch(getApiUrl(endpoint), {
        method: "POST",
        body: formData,
        credentials: "include",
        // Note: Don't set Content-Type header - browser will set it automatically with boundary for FormData
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = "Upload failed";
        
        try {
          // Try to parse JSON error response
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `Server error (${response.status})`;
        } catch (jsonError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || `Server error (${response.status})`;
          
          // Try to get text response as fallback
          try {
            const textResponse = await response.text();
            if (textResponse) {
              errorMessage = textResponse.substring(0, 200); // Limit length
            }
          } catch (textError) {
            // Ignore text parsing errors
          }
        }
        
        throw new Error(errorMessage);
      }

      // Parse successful response
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      // Check if upload was successful
      if (data.success === true) {
        // Clear any previous errors
        setError(null);
        
        // Store uploaded file name for display
        const fileName = data.fileName || file.name;
        setUploadedFileName(fileName);
        
        // Show success message with file name
        const successMessage = `${type === "cv" ? "CV" : "Cover letter"} uploaded successfully`;
        setSuccess(successMessage);
        
        if (onSuccess) {
          onSuccess(successMessage);
        }
        if (onUploadComplete) {
          // Small delay to ensure database update completes before refreshing
          setTimeout(() => {
            onUploadComplete();
          }, 500);
        }
      } else {
        // API returned success: false
        const errorMessage = data.message || data.error || "Upload failed. Please try again.";
        throw new Error(errorMessage);
      }

      // Reset file input
      e.target.value = "";
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      // Handle different error types
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Network error. Please check your connection and try again.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      
      // Reset file input on error
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  };

  const label = type === "cv" ? "CV" : "Cover Letter";

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">Choose {label} file</span>
        <div className="relative">
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-base md:text-sm text-gray-500 file:mr-4 file:py-3 md:file:py-2 file:px-4 file:rounded-md file:border-0 file:text-base md:file:text-sm file:font-semibold file:bg-[#F4E2D4] file:text-[#734C23] hover:file:bg-[#E8D4C4] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
              <div className="flex items-center gap-2 text-sm text-[#734C23]">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Uploading...</span>
              </div>
            </div>
          )}
        </div>
      </label>
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Upload failed</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">Upload successful</p>
              <p className="mt-1">{success}</p>
              {uploadedFileName && (
                <p className="mt-2 text-xs font-medium text-green-700 flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {uploadedFileName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

