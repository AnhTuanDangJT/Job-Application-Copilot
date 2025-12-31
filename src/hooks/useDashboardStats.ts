"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useRealtimeUpdates } from "./useRealtimeUpdates";

export interface DashboardStats {
  applicationsCount: number;
  interviewsCount: number;
  offersCount: number;
  rejectedCount: number;
  conversationId?: string | null;
}

// Shared query key factory
export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
};

/**
 * Hook to fetch dashboard stats with caching
 * Data is shared across all components using this hook
 * 
 * IMPORTANT: Stats are derived from ApplicationRow (single source of truth)
 * This ensures dashboards reflect updates made in the Applications board
 * 
 * Real-time updates: Listens to application.updated events and refetches stats
 */
export function useDashboardStats() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      // Fetch stats from dashboard endpoint which queries ApplicationRow by conversationId
      const stats = await apiClient.get<DashboardStats>("/dashboard/stats");
      // Update conversationId when we get it from the response
      if (stats.conversationId && stats.conversationId !== conversationId) {
        setConversationId(stats.conversationId);
      }
      return stats;
    },
    staleTime: 0, // Always fetch fresh data to reflect real-time updates
    refetchInterval: 5000, // Refetch every 5 seconds as fallback
  });

  // Set up real-time updates if conversationId is available
  useRealtimeUpdates({
    conversationId: conversationId || "",
    enabled: !!conversationId,
    onEvent: (event) => {
      // When application is updated, invalidate dashboard stats
      if (event.type === "application.updated" || event.type === "application.created") {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      }
    },
  });

  return statsQuery;
}

