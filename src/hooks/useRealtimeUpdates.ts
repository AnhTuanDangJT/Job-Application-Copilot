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

export interface UseRealtimeUpdatesOptions {
  conversationId: string;
  onEvent?: (event: CollaborationEvent) => void;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time collaboration updates via Server-Sent Events
 */
export function useRealtimeUpdates({
  conversationId,
  onEvent,
  enabled = true,
}: UseRealtimeUpdatesOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const connect = useCallback(() => {
    if (!enabled || !conversationId) {
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const eventSource = new EventSource(
        `/api/websocket?conversationId=${encodeURIComponent(conversationId)}`
      );

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
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
        console.error("SSE connection error:", error);
        eventSource.close();

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("Max reconnection attempts reached");
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("Error creating SSE connection:", error);
    }
  }, [conversationId, onEvent, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  return { disconnect, reconnect: connect };
}





