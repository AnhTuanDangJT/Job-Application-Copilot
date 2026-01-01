"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Application {
  id: string;
  status: "draft" | "submitted" | "interview" | "offer" | "rejected";
  dateSubmitted?: string;
  job: {
    id: string;
    title: string;
    company: string;
    jd_text?: string;
  } | null;
}

interface ApplicationsResponse {
  history: Application[];
}

// Shared query key factory
export const applicationKeys = {
  all: ["applications"] as const,
  lists: () => [...applicationKeys.all, "list"] as const,
  list: (filters?: string) => [...applicationKeys.lists(), filters] as const,
  detail: (id: string) => [...applicationKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch applications with caching
 * Data is shared across all components using this hook
 */
export function useApplications() {
  return useQuery({
    queryKey: applicationKeys.list(),
    queryFn: async () => {
      const data = await apiClient.get<ApplicationsResponse>("/applications/history");
      return data.history;
    },
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook to update application status with optimistic updates
 */
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Application["status"] }) => {
      return apiClient.patch(`/applications/${id}`, { status });
    },
    // Optimistic update
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: applicationKeys.list() });

      // Snapshot previous value
      const previousApplications = queryClient.getQueryData<Application[]>(applicationKeys.list());

      // Optimistically update
      queryClient.setQueryData<Application[]>(applicationKeys.list(), (old) => {
        if (!old) return old;
        return old.map((app) => (app.id === id ? { ...app, status } : app));
      });

      return { previousApplications };
    },
    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(applicationKeys.list(), context.previousApplications);
      }
    },
    // Refetch after success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.list() });
    },
  });
}






