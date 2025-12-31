/**
 * WebSocket broadcast utilities for SSE connections
 * Provides real-time broadcasting to active SSE connections
 */

import { collaborationEvents } from "./server";

// Store active SSE connections per conversation
// Using a WeakMap-like pattern with controller references
type ConnectionInfo = {
  controller: ReadableStreamDefaultController;
  conversationId: string;
  eventHandlers: Map<string, (payload: any) => void>;
};

export const activeConnections = new Map<ReadableStreamDefaultController, ConnectionInfo>();

function cleanupConnection(controller: ReadableStreamDefaultController) {
  const info = activeConnections.get(controller);
  if (info) {
    // Remove all event listeners
    info.eventHandlers.forEach((handler, event) => {
      collaborationEvents.off(event, handler);
    });
    activeConnections.delete(controller);
  }
}

// Helper to broadcast to conversation room
export function broadcastToConversation(conversationId: string, event: string, payload: any) {
  // Emit to event emitter first (for SSE connections that subscribe via collaborationEvents.on)
  collaborationEvents.emitEvent(event, { conversationId, ...payload });

  // Also directly broadcast to active SSE connections (for immediate delivery)
  const message = JSON.stringify({ type: event, ...payload });
  const encoder = new TextEncoder();
  const data = encoder.encode(`data: ${message}\n\n`);

  activeConnections.forEach((info, controller) => {
    if (info.conversationId === conversationId) {
      try {
        controller.enqueue(data);
      } catch (error) {
        // Connection closed, remove it
        cleanupConnection(controller);
      }
    }
  });
}

export { cleanupConnection };



