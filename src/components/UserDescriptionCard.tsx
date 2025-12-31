"use client";

import { memo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { dashboardKeys } from "@/hooks/useDashboardStats";
import { User, Mail, Briefcase, FileText, Users, Calendar } from "lucide-react";

interface ConversationData {
  conversations: Array<{
    id: string;
    otherParticipant: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }>;
}

interface DocumentsData {
  cv: {
    uploaded: boolean;
  };
  coverLetter: {
    uploaded: boolean;
  };
}

interface DashboardStats {
  applicationsCount: number;
}

interface MenteesData {
  mentees: Array<{
    conversationId: string;
  }>;
}

function UserDescriptionCard() {
  const { user, isLoading: authLoading } = useAuth();

  // Fetch conversations for mentee (to get mentor info)
  const { data: conversationsData } = useQuery<ConversationData>({
    queryKey: ["conversations"],
    queryFn: () => apiClient.get<ConversationData>("/mentor-communication/conversations"),
    enabled: !!user && user.role === "mentee",
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch documents for mentee (to check resume status)
  const { data: documentsData } = useQuery<DocumentsData>({
    queryKey: ["documents"],
    queryFn: () => apiClient.get<DocumentsData>("/documents"),
    enabled: !!user && user.role === "mentee",
    staleTime: 60000, // Cache for 60 seconds
  });

  // Fetch dashboard stats for mentee (to get applications count)
  // Uses shared query key to share cached data with useDashboardStats hook
  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats(),
    queryFn: () => apiClient.get<DashboardStats>("/dashboard/stats"),
    enabled: !!user && user.role === "mentee",
    staleTime: 10000, // Cache for 10 seconds
  });

  // Fetch mentees for mentor (to get mentees count)
  const { data: menteesData } = useQuery<MenteesData>({
    queryKey: ["mentor", "mentees"],
    queryFn: () => apiClient.get<MenteesData>("/mentor/mentees"),
    enabled: !!user && user.role === "mentor",
    staleTime: 30000, // Cache for 30 seconds
  });

  if (authLoading || !user) {
    return null;
  }

  // Use role from user object (single source of truth from /api/auth/me)
  // Role can be "mentee", "mentor", or "admin"
  const userRole = user.role || "mentee";
  const isAdminUser = userRole === "admin" || user.isAdmin;
  const isMentee = userRole === "mentee" && !isAdminUser;
  const isMentor = userRole === "mentor" && !isAdminUser;

  // Get mentor info for mentee
  const currentMentor = conversationsData?.conversations?.[0]?.otherParticipant;
  const resumeUploaded = documentsData?.cv?.uploaded ?? false;
  const applicationsCount = statsData?.applicationsCount ?? 0;
  const menteesCount = menteesData?.mentees?.length ?? 0;

  // Determine role badge text and style based on role (single source of truth)
  let roleBadgeText: string;
  let roleBadgeStyle: string;
  if (userRole === "admin" || isAdminUser) {
    roleBadgeText = "ADMIN";
    roleBadgeStyle = "bg-[#DC2626] text-white";
  } else if (userRole === "mentor") {
    roleBadgeText = "Mentor";
    roleBadgeStyle = "bg-[#CAAE92] text-[#734C23]";
  } else if (userRole === "mentee") {
    roleBadgeText = "Mentee";
    roleBadgeStyle = "bg-[#F4E2D4] text-[#734C23]";
  } else {
    // Fallback for any other role (shouldn't happen but safe fallback)
    roleBadgeText = userRole.charAt(0).toUpperCase() + userRole.slice(1);
    roleBadgeStyle = "bg-[#CAAE92] text-[#734C23]";
  }

  return (
    <div className="rounded-lg sm:rounded-xl bg-[#F8F5F2] p-4 sm:p-5 md:p-6 border border-[#CAAE92]/30 shadow-sm">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Left side: Icon and main info */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#F4E2D4] flex items-center justify-center">
            {isMentee ? (
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" strokeWidth={1.5} />
            ) : (
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#734C23]" strokeWidth={1.5} />
            )}
          </div>
        </div>

        {/* Right side: Details */}
        <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
          {/* Name and Role Badge */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#1F2937] truncate">{user.name}</h2>
            <span
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium flex-shrink-0 ${roleBadgeStyle}`}
            >
              {roleBadgeText}
            </span>
          </div>

          {/* Description Text */}
          <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
            {isAdminUser
              ? "System Administrator. Manage users, mentors, mentees, and platform settings."
              : isMentee
              ? "You are currently a mentee receiving guidance on job applications, resumes, and interviews."
              : "You are a mentor supporting mentees with applications, resumes, and career guidance."}
          </p>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-[#CAAE92]/20">
            {/* Email - Always shown */}
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9C6A45] flex-shrink-0" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs font-medium text-[#6B7280]">Email</div>
                <div className="text-xs sm:text-sm text-[#1F2937] truncate">{user.email}</div>
              </div>
            </div>

            {/* Mentee-specific fields */}
            {isMentee && (
              <>
                {/* Current Mentor */}
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9C6A45] flex-shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-medium text-[#6B7280]">Current Mentor</div>
                    <div className="text-xs sm:text-sm text-[#1F2937] truncate">
                      {currentMentor?.name || "Not assigned yet"}
                    </div>
                  </div>
                </div>

                {/* Applications Count */}
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9C6A45] flex-shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-medium text-[#6B7280]">Applications Tracked</div>
                    <div className="text-xs sm:text-sm text-[#1F2937]">{applicationsCount}</div>
                  </div>
                </div>

                {/* Resume Status */}
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9C6A45] flex-shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-medium text-[#6B7280]">Resume Status</div>
                    <div className="text-xs sm:text-sm text-[#1F2937]">
                      {resumeUploaded ? "Uploaded" : "Not uploaded"}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Mentor-specific fields */}
            {isMentor && (
              <>
                {/* Number of Mentees */}
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9C6A45] flex-shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-medium text-[#6B7280]">Mentees Assigned</div>
                    <div className="text-xs sm:text-sm text-[#1F2937]">{menteesCount}</div>
                  </div>
                </div>

                {/* Active Groups (placeholder - set to 0 as we don't have groups API) */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9C6A45] flex-shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-medium text-[#6B7280]">Active Groups</div>
                    <div className="text-xs sm:text-sm text-[#1F2937]">0</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(UserDescriptionCard);

