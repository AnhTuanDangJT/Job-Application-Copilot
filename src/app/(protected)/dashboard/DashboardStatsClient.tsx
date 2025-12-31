"use client";

import { memo } from "react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Briefcase, Calendar, CheckCircle, XCircle } from "lucide-react";

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 shadow-sm animate-pulse">
          <div className="h-4 w-4 sm:h-5 sm:w-5 bg-[#CAAE92]/30 rounded mb-2 sm:mb-3 md:mb-4"></div>
          <div className="h-2.5 sm:h-3 bg-[#CAAE92]/30 rounded w-16 sm:w-20 mb-2 sm:mb-3"></div>
          <div className="h-6 sm:h-7 md:h-8 bg-[#CAAE92]/30 rounded w-12 sm:w-16"></div>
        </div>
      ))}
    </div>
  );
}

function DashboardStatsClient() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return <StatsSkeleton />;
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Applications */}
      <div className="relative rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200">
        <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-[#9C6A45] mb-2 sm:mb-3 md:mb-4" strokeWidth={1.5} />
        <div className="text-[10px] sm:text-xs font-medium text-[#6B7280] mb-1">Total Applications</div>
        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#734C23]">
          {stats.applicationsCount}
        </div>
      </div>

      {/* Interviews */}
      <div className="relative rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200" style={{ backgroundColor: '#F8F5F2' }}>
        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#9C6A45] mb-2 sm:mb-3 md:mb-4" strokeWidth={1.5} />
        <div className="text-[10px] sm:text-xs font-medium text-[#6B7280] mb-1">Interviews</div>
        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#9C6A45]">
          {stats.interviewsCount}
        </div>
      </div>

      {/* Offers */}
      <div className="relative rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200" style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#22C55E] mb-2 sm:mb-3 md:mb-4" strokeWidth={1.5} />
        <div className="text-[10px] sm:text-xs font-medium text-[#6B7280] mb-1">Offers</div>
        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#16A34A]">
          {stats.offersCount}
        </div>
      </div>

      {/* Rejected */}
      <div className="relative rounded-lg sm:rounded-xl bg-[#F8F5F2] p-3 sm:p-4 md:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200" style={{ backgroundColor: 'rgba(220, 38, 38, 0.05)' }}>
        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#DC2626] mb-2 sm:mb-3 md:mb-4" strokeWidth={1.5} />
        <div className="text-[10px] sm:text-xs font-medium text-[#6B7280] mb-1">Rejected</div>
        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#DC2626]">
          {stats.rejectedCount}
        </div>
      </div>
    </div>
  );
}

export default memo(DashboardStatsClient);

