"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function MobileBottomSheet({
  isOpen,
  onClose,
  children,
  title = "Menu",
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when sheet is open (but avoid overflow: hidden on body for iOS)
  useEffect(() => {
    if (isOpen) {
      // Use position: fixed on body to prevent scroll without overflow: hidden
      const originalStyle = window.getComputedStyle(document.body).position;
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
      
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.position = originalStyle;
        document.body.style.width = "";
        document.body.style.top = "";
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || "0") * -1);
        }
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="fixed inset-0 bg-black/50 z-[100] md:hidden"
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[101] md:hidden bg-white rounded-t-2xl shadow-2xl flex flex-col slide-in-from-bottom-5"
        style={{
          height: '80dvh',
          maxHeight: '80dvh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
          {children}
        </div>
      </div>
    </>
  );
}

