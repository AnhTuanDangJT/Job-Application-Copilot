"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ImageViewerModalProps {
  imageUrl: string;
  onClose: () => void;
}

export default function ImageViewerModal({ imageUrl, onClose }: ImageViewerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  const handleDownload = () => {
    // Create a temporary anchor element to trigger download
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `image-${Date.now()}.jpg`; // Default filename
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-0 md:p-4"
      onClick={handleBackdropClick}
    >
      {/* Close button - Top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-[#F8F5F2]/95 backdrop-blur-sm border border-[#CAAE92]/30 hover:bg-[#F4E2D4] rounded-full flex items-center justify-center transition-all duration-200 z-50 shadow-lg focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
        aria-label="Close"
      >
        <svg
          className="w-6 h-6 text-[#734C23]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="absolute top-4 left-4 w-10 h-10 bg-[#F8F5F2]/95 backdrop-blur-sm border border-[#CAAE92]/30 hover:bg-[#F4E2D4] rounded-full flex items-center justify-center transition-all duration-200 z-50 shadow-lg focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
        aria-label="Download image"
      >
        <svg
          className="w-6 h-6 text-[#734C23]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </button>

      {/* Image container */}
      <div className="relative max-w-full max-h-full flex items-center justify-center">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Full size image"
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-[#CAAE92]/20"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      
      {/* Return button - Bottom left for accessibility */}
      <button
        onClick={onClose}
        className="absolute bottom-4 left-4 px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-[#F8F5F2]/95 backdrop-blur-sm text-[#734C23] font-semibold hover:bg-[#F4E2D4] hover:border-[#9C6A45] transition-all duration-200 shadow-lg focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
      >
        Return
      </button>
    </div>
  );

  // Render via portal to ensure it's above everything
  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
}


