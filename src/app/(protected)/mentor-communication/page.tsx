"use client";

import { useAuth } from "@/contexts/AuthContext";
import ConversationsListClientOptimized from "@/components/mentorCommunication/ConversationsListClientOptimized";

export default function MentorCommunicationPage() {
  const { user } = useAuth();
  
  // Runtime guard: Mentor accounts must NEVER be admin
  if (user?.role === "mentor" && user?.isAdmin) {
    console.error("[MentorCommunication] INVALID STATE: Mentor cannot be admin. Email:", user.email);
  }
  
  const userRole = (user?.role as "mentee" | "mentor") || "mentee";
  
  // Only grant mentor access if role is "mentor"
  // Admin users (isAdmin=true) should NOT have mentor access - they have separate admin UI
  const hasMentorAccess = userRole === "mentor";

  return (
    <section className="space-y-4 sm:space-y-5 md:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Communication</h1>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">
          {hasMentorAccess
            ? "Manage conversations with your mentees."
            : "Chat with your mentor and share your resume for feedback."}
        </p>
      </div>

      {/* Cookie info banner for multi-tab testing */}
      <div className="rounded-lg border border-[#CAAE92]/30 bg-[#F4E2D4] p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#734C23] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-[#734C23] font-medium">Testing Multiple Accounts?</p>
            <p className="text-xs sm:text-sm text-[#734C23] mt-1">
              Cookies are shared across all tabs in the same browser. If you're testing mentor and mentee in two tabs, 
              both tabs will show the same account (the last one you logged into). To test two accounts simultaneously, 
              use <strong>Incognito mode</strong> for one account or open the second account in a <strong>different browser</strong>.
            </p>
          </div>
        </div>
      </div>

      <ConversationsListClientOptimized />
    </section>
  );
}

