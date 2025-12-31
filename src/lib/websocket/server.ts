/**
 * WebSocket server event emitter
 * This module provides a singleton event emitter for collaboration events
 * that can be used across API routes to emit real-time updates
 */

import { EventEmitter } from "events";

class CollaborationEventEmitter extends EventEmitter {
  private static instance: CollaborationEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow up to 100 listeners per event
  }

  static getInstance(): CollaborationEventEmitter {
    if (!CollaborationEventEmitter.instance) {
      CollaborationEventEmitter.instance = new CollaborationEventEmitter();
    }
    return CollaborationEventEmitter.instance;
  }

  /**
   * Emit a collaboration event
   * This will be picked up by the WebSocket server and broadcast to clients
   */
  emitEvent(event: string, payload: any): void {
    this.emit(event, payload);
  }
}

export const collaborationEvents = CollaborationEventEmitter.getInstance();





