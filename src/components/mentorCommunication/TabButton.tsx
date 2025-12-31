"use client";

import { memo } from "react";

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

function TabButton({ label, isActive, onClick, className = "" }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1
        h-[32px]
        md:h-[32px]
        min-h-[44px]
        md:min-h-0
        text-xs
        rounded
        border
        font-normal
        whitespace-nowrap
        transition-all duration-200
        cursor-pointer
        touch-manipulation
        focus-visible:outline-2 focus-visible:outline-[#9C6A45] focus-visible:outline-offset-2
        ${
          isActive
            ? "bg-[#F4E2D4] text-[#734C23] border-[#734C23] font-bold"
            : "bg-white text-[#1F2937] border-[#CAAE92] hover:bg-gray-50 hover:border-[#9C6A45]"
        }
        ${className}
      `}
      aria-pressed={isActive}
      aria-label={`${label} tab`}
    >
      {label}
    </button>
  );
}

export default memo(TabButton);


