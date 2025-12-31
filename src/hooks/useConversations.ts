"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Conversation {
  id: string;
  mentorId: string;
  menteeId: string;
  lastMessageAt?: string | Date;
  lastMessagePreview?: string;
  updatedAt: string | Date;
  createdAt: string | Date;
  otherParticipant: {
    id: string;
    name: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

interface ConversationsResponse {
  conversations: Conversation[];
}

// Shared query key factory
export const conversationKeys = {
  all: ["conversations"] as const,
  lists: () => [...conversationKeys.all, "list"] as const,
  list: () => [...conversationKeys.lists()] as const,
  detail: (id: string) => [...conversationKeys.all, "detail", id] as const,
  messages: (id: string) => [...conversationKeys.detail(id), "messages"] as const,
};

/**
 * Hook to fetch conversations with caching
 * Data is shared across all components using this hook
 */
export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list(),
    queryFn: async () => {
      // Note: This assumes you have an API endpoint for conversations
      // If not, we'll need to create one or use the existing server component pattern
      const data = await apiClient.get<ConversationsResponse>("/mentor-communication/conversations");
      return data.conversations;
    },
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook to invalidate conversations cache
 */
export function useInvalidateConversations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
  };
}

