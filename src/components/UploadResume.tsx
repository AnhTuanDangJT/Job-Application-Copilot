"use client";

import { useState } from "react";

interface UploadResumeProps {
  onTextExtracted?: (text: string) => void;
  onSaveToDatabase?: boolean;
  compact?: boolean;
}

export default function UploadResume({ 
  onTextExtracted, 
  onSaveToDatabase = false,
  compact = false 
}: UploadResumeProps) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [extractedTextLength, setExtractedTextLength] = useState<number>(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setText("");
    setFileName(null);
    setExtractedTextLength(0);
    setSaveSuccess(false);

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
    setError(null);

    try {
      // Create FormData with correct field name
      const formData = new FormData();
      formData.append("file", file);

      // Call the extraction API
      const res = await fetch("/api/resume/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      // Handle the result - parse JSON safely
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response (${res.status})`);
      }

      // Check if request was successful
      if (!res.ok) {
        const errorMessage = data?.error || data?.message || `Server error (${res.status})`;
        throw new Error(errorMessage);
      }

      // Handle successful extraction
      if (data.success) {
        const extractedText = data.text || "";
        const textLength = extractedText.length;
        
        // Set extracted text and file name
        setText(extractedText);
        setExtractedTextLength(textLength);
        setFileName(data.fileName || file.name);
        setSaveSuccess(false);

        // Call callback if provided
        if (onTextExtracted && extractedText) {
          onTextExtracted(extractedText);
        }

        // Save to database if requested
        if (onSaveToDatabase && extractedText) {
          await saveTextToDatabase(extractedText);
        }
      } else {
        // API returned success: false
        const errorMessage = data.error || data.message || "Failed to extract resume text";
        throw new Error(errorMessage);
      }
    } catch (err) {
      // Handle different error types
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Network error. Please check your connection and try again.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      // Always clear loading state to prevent freezing
      setUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  const saveTextToDatabase = async (textToSave: string) => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/user/resume-text", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ text: textToSave }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to save resume text";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (jsonError) {
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save resume text to database");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div>
        <label className="block">
          <span className="sr-only">Choose file to extract text</span>
          <div className="relative">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleUpload}
              disabled={uploading || saving}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4E2D4] file:text-[#734C23] hover:file:bg-[#E8D4C4] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
                <div className="flex items-center gap-2 text-sm text-[#734C23]">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </div>
              </div>
            )}
          </div>
        </label>
        {!compact && (
          <p className="mt-1 text-xs text-gray-500">
            Upload a PDF or DOCX file to extract text. Maximum file size: 5MB.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setText("");
                  setFileName(null);
                  setExtractedTextLength(0);
                }}
                className="mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Resume text saved successfully!</p>
              <p>Your resume text has been updated and job matching will now work.</p>
            </div>
          </div>
        </div>
      )}

      {fileName && !saveSuccess && !onSaveToDatabase && (
        <div className="rounded-md bg-[#F4E2D4] border border-[#CAAE92]/30 p-3 text-sm text-[#734C23]">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-[#734C23] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">File processed successfully</p>
              <p>File: {fileName}</p>
            </div>
          </div>
        </div>
      )}

      {fileName && !saveSuccess && onSaveToDatabase && saving && (
        <div className="rounded-md bg-[#F4E2D4] border border-[#CAAE92]/30 p-3 text-sm text-[#734C23]">
          <div className="flex items-start gap-2">
            <svg className="animate-spin h-5 w-5 text-[#734C23] flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <p className="font-medium">Saving resume text...</p>
              <p>File: {fileName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Show extracted text in scrollable box - only when upload is complete and not saving */}
      {text && !uploading && !saving && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Extracted Text</h2>
            {fileName && (
              <span className="text-xs text-gray-500">
                {fileName} • {new Date().toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 font-mono">
                {text}
              </pre>
            </div>
          </div>
          {extractedTextLength > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Extracted {extractedTextLength.toLocaleString()} characters
              </p>
              {extractedTextLength > 0 && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ Extraction successful
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

