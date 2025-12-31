"use client";

import { useEffect } from "react";

/**
 * Client component that prevents body scrolling when mounted
 * This ensures the chat page doesn't allow page-level scrolling
 * On mobile: Do NOT block body scroll to allow mobile menu to work properly
 * On desktop: Use overflow: hidden to prevent page scroll
 */
export default function PreventBodyScroll() {
  useEffect(() => {
    // Check if mobile (max-width: 768px)
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // On mobile: DO NOT block body scroll - let the conversation container handle scrolling
      // This allows the mobile menu to open properly without interference
      // The conversation container itself handles internal scrolling
      return () => {
        // No cleanup needed on mobile
      };
    } else {
      // On desktop: Use overflow: hidden (works fine on desktop)
      const originalOverflow = document.body.style.overflow;
      const originalOverflowHtml = document.documentElement.style.overflow;
      
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.overflow = originalOverflowHtml;
      };
    }
  }, []);

  return null;
}





