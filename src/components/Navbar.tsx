"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";

export default function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Detect conversation pages
  const isConversationPage = pathname?.includes("/mentor-communication/") && pathname !== "/mentor-communication";

  useEffect(() => {
    // Check authentication by calling /api/auth/me
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        setIsAuthenticated(response.ok);
      } catch {
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    setIsAuthenticated(false);
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="flex sticky top-0 w-full border-b border-[#CAAE92]/30 bg-[#F8F5F2] z-[200]">
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 h-14 sm:h-16">
        {/* Flex layout: Left (title), Right (actions) */}
        <div className="flex items-center justify-between h-full">
          {/* Left section: Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile hamburger menu button */}
            {isAuthenticated && onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2 sm:p-3 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] active:bg-[#CAAE92] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center relative z-[200] pointer-events-auto cursor-pointer touch-manipulation"
                style={{ 
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'rgba(115, 76, 35, 0.1)',
                  position: 'relative',
                  isolation: 'isolate'
                }}
                aria-label="Open menu"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" pointerEvents="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <Link 
              href="/" 
              className="font-semibold text-[#734C23] text-base sm:text-lg hover:text-[#9C6A45] transition-colors truncate"
            >
              Job Application Copilot
            </Link>
          </div>
          
          {/* Right section: Actions */}
          <div className="flex items-center justify-end gap-2 sm:gap-4 lg:gap-6 text-sm text-gray-600">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="hidden sm:inline hover:text-[#734C23] transition-colors">Dashboard</Link>
                <NotificationBell />
                <button
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 font-medium transition-colors px-2 sm:px-0 min-h-[44px] sm:min-h-0"
                  style={{ touchAction: 'manipulation' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="px-2 sm:px-0 min-h-[44px] sm:min-h-0 flex items-center" style={{ touchAction: 'manipulation' }}>Login</Link>
                <Link href="/auth/signup" className="px-2 sm:px-0 min-h-[44px] sm:min-h-0 flex items-center" style={{ touchAction: 'manipulation' }}>Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}


