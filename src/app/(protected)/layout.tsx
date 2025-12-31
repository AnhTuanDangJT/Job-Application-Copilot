export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/serverAuth";
import LayoutWrapperClient from "@/components/LayoutWrapperClient";

/**
 * Protected layout - minimal server-side auth check
 * Actual user data is fetched and cached client-side via AuthContext
 * This ensures instant page rendering without blocking on DB queries
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Minimal auth check - just verify token exists
  // Don't block on DB queries or user data fetching
  try {
    const payload = await getServerAuth();
    
    if (!payload) {
      redirect("/auth/login");
    }

    // Render immediately - user data will come from AuthContext (cached client-side)
    return (
      <LayoutWrapperClient>
        {children}
      </LayoutWrapperClient>
    );
  } catch (error) {
    console.error("[ProtectedLayout] Error:", error instanceof Error ? error.message : "Unknown error");
    redirect("/auth/login");
  }
}
