export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/serverAuth";
import LayoutWrapperClient from "@/components/LayoutWrapperClient";

/**
 * Protected layout - minimal server-side auth check
 * Actual user data is fetched and cached client-side via AuthContext
 * This ensures instant page rendering without blocking on DB queries
 * 
 * With dynamic = "force-dynamic", this component is never statically generated
 * and auth checks only run at request time, not during build
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Minimal auth check - just verify token exists
  // Don't block on DB queries or user data fetching
  // This only runs at request time due to dynamic = "force-dynamic"
  try {
    const payload = await getServerAuth();
    
    if (!payload) {
      redirect("/auth/login");
    }
  } catch (error) {
    // Handle errors gracefully - if cookies() fails during unexpected contexts, log and redirect
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ProtectedLayout] Auth check error:", errorMessage);
    
    // Only redirect if we're in a proper request context
    // getServerAuth() will return null if cookies() fails, which we handle above
    redirect("/auth/login");
  }

  // Render immediately - user data will come from AuthContext (cached client-side)
  return (
    <LayoutWrapperClient>
      {children}
    </LayoutWrapperClient>
  );
}
