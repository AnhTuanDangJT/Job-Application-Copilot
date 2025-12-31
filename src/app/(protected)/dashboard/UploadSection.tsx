"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import DocumentDisplay from "@/components/DocumentDisplay";

export default function UploadSection() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    // Trigger refresh of document display
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      {/* Document Uploads */}
      <div className="rounded-lg sm:rounded-xl bg-[#F8F5F2] p-4 sm:p-5 md:p-6 shadow-sm">
        <h3 className="text-xs sm:text-sm font-medium text-[#1F2937] mb-3 sm:mb-4">Upload Documents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div>
            <h4 className="text-[10px] sm:text-xs font-medium text-[#6B7280] mb-1.5 sm:mb-2">CV / Resume</h4>
            <p className="text-[10px] sm:text-xs text-[#6B7280] mb-2 sm:mb-3">PDF or DOCX, max 5MB</p>
            <FileUpload type="cv" onUploadComplete={handleUploadComplete} />
          </div>
          <div>
            <h4 className="text-[10px] sm:text-xs font-medium text-[#6B7280] mb-1.5 sm:mb-2">Cover Letter</h4>
            <p className="text-[10px] sm:text-xs text-[#6B7280] mb-2 sm:mb-3">PDF or DOCX, max 5MB</p>
            <FileUpload type="coverletter" onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      </div>

      {/* Display Uploaded Documents */}
      <DocumentDisplay refreshTrigger={refreshTrigger} />
    </>
  );
}





