"use client";

import { useEffect, useRef, useCallback } from "react";

export type CollaborationEventType =
  | "application.created"
  | "application.updated"
  | "suggestion.created"
  | "suggestion.resolved"
  | "reminder.created"
  | "mentoringPlan.updated"
  | "activityLog.created"
  | "connected";

export interface CollaborationEvent {
  type: CollaborationEventType;
  conversationId: string;
  [key: string]: any;
}

export interface UseMultipleRealtimeUpdatesOptions {
  conversationIds: string[];
  onEvent?: (event: CollaborationEvent) => void;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time collaboration updates for multiple conversations
 * This is useful for mentors who need to listen to updates from multiple mentees
 */
export function useMultipleRealtimeUpdates({
  conversationIds,
  onEvent,
  enabled = true,
}: UseMultipleRealtimeUpdatesOptions) {
  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map());
  const reconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const connect = useCallback(
    (conversationId: string) => {
      if (!enabled || !conversationId) {
        return;
      }

      // Close existing connection if any
      const existing = eventSourceRefs.current.get(conversationId);
      if (existing) {
        existing.close();
        eventSourceRefs.current.delete(conversationId);
      }

      try {
        const eventSource = new EventSource(
          `/api/websocket?conversationId=${encodeURIComponent(conversationId)}`
        );

        eventSource.onopen = () => {
          reconnectAttemptsRef.current.set(conversationId, 0);
        };

        eventSource.onmessage = (event) => {
          try {
            const data: CollaborationEvent = JSON.parse(event.data);
            onEvent?.(data);
          } catch (error) {
            console.error("Error parsing SSE message:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error(`SSE connection error for conversation ${conversationId}:`, error);
          eventSource.close();

          // Attempt to reconnect with exponential backoff
          const attempts = reconnectAttemptsRef.current.get(conversationId) || 0;
          if (attempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, attempts);
            reconnectAttemptsRef.current.set(conversationId, attempts + 1);
            const timeout = setTimeout(() => {
              connect(conversationId);
            }, delay);
            reconnectTimeoutsRef.current.set(conversationId, timeout);
          } else {
            console.error(`Max reconnection attempts reached for conversation ${conversationId}`);
          }
        };

        eventSourceRefs.current.set(conversationId, eventSource);
      } catch (error) {
        console.error(`Error creating SSE connection for conversation ${conversationId}:`, error);
      }
    },
    [onEvent, enabled]
  );

  const disconnect = useCallback((conversationId: string) => {
    const eventSource = eventSourceRefs.current.get(conversationId);
    if (eventSource) {
      eventSource.close();
      eventSourceRefs.current.delete(conversationId);
    }
    const timeout = reconnectTimeoutsRef.current.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      reconnectTimeoutsRef.current.delete(conversationId);
    }
  }, []);

  // Connect to all conversationIds
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const currentIds = new Set(conversationIds);
    const connectedIds = new Set(eventSourceRefs.current.keys());

    // Connect to new conversationIds
    currentIds.forEach((id) => {
      if (!connectedIds.has(id)) {
        connect(id);
      }
    });

    // Disconnect from removed conversationIds
    connectedIds.forEach((id) => {
      if (!currentIds.has(id)) {
        disconnect(id);
      }
    });

    return () => {
      // Cleanup all connections
      eventSourceRefs.current.forEach((eventSource) => {
        eventSource.close();
      });
      eventSourceRefs.current.clear();
      reconnectTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      reconnectTimeoutsRef.current.clear();
    };
  }, [conversationIds, enabled, connect, disconnect]);

  return { disconnect: () => conversationIds.forEach(disconnect), reconnect: () => conversationIds.forEach(connect) };
}






