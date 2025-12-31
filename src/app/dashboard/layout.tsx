"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-0">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}


