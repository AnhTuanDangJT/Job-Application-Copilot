"use client";

import { useState } from "react";
import ProgressDashboard from "./ProgressDashboard";
import FeedbackPanel from "./FeedbackPanel";

interface ProgressAndFeedbackWrapperProps {
  conversationId: string;
  userRole: "mentee" | "mentor" | "admin";
  children?: React.ReactNode;
}

export default function ProgressAndFeedbackWrapper({
  conversationId,
  userRole,
  children,
}: ProgressAndFeedbackWrapperProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleFeedbackSubmitted = () => {
    // Increment refresh trigger to force ProgressDashboard to refresh
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <ProgressDashboard
        conversationId={conversationId}
        userRole={userRole}
        refreshTrigger={refreshTrigger}
      />
      {children}
      <FeedbackPanel
        conversationId={conversationId}
        userRole={userRole}
        onFeedbackSubmitted={handleFeedbackSubmitted}
      />
    </>
  );
}

