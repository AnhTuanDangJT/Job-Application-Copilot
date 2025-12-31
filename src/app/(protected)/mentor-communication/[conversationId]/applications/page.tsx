"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ApplicationTrackerPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  // Redirect to conversation page - Application Tracker is now in the tab
  useEffect(() => {
    router.replace(`/mentor-communication/${conversationId}`);
  }, [conversationId, router]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-56px)]">
      <p className="text-gray-600">Redirecting to conversation...</p>
    </div>
  );
}
