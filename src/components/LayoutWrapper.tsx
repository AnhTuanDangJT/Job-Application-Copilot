"use client";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";

interface LayoutWrapperProps {
  children: React.ReactNode;
  userName: string;
  userRole: "mentee" | "mentor" | "admin";
}

function RoleBadge({ role }: { role: "mentee" | "mentor" | "admin" }) {
  const badgeConfig = {
    mentee: { label: "MENTEE", color: "bg-green-100 text-green-800 border-green-300" },
    mentor: { label: "MENTOR", color: "bg-[#F4E2D4] text-[#734C23] border-[#CAAE92]" },
    admin: { label: "ADMIN", color: "bg-red-100 text-red-800 border-red-300" },
  };

  const config = badgeConfig[role];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${config.color}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Client component wrapper for layout elements
 * This ensures proper server/client component boundaries
 */
export default function LayoutWrapper({ children, userName, userRole }: LayoutWrapperProps) {
  const pathname = usePathname();
  // Hide welcome header on conversation page for full-height chat layout
  const isConversationPage = pathname?.includes("/mentor-communication/") && pathname !== "/mentor-communication";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-0">
        <Sidebar />
        <main className="p-4 md:p-6">
          {!isConversationPage && (
            <div className="mb-4 flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900">
                Welcome, {userName}
              </h1>
              <RoleBadge role={userRole} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}






