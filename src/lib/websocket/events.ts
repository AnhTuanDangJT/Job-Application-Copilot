/**
 * WebSocket event types for real-time collaboration
 */
export type CollaborationEvent =
  | "application.created"
  | "application.updated"
  | "suggestion.created"
  | "suggestion.resolved"
  | "reminder.created"
  | "mentoringPlan.updated"
  | "activityLog.created"
  | "message:new"
  | "notification:new"
  | "insight:ready"
  | "reminder:due"
  | "suggestion:new"
  | "dashboard:statsUpdated";

export interface CollaborationEventPayload {
  conversationId: string;
  [key: string]: any;
}

export interface ApplicationCreatedPayload extends CollaborationEventPayload {
  applicationId: string;
  conversationId: string;
}

export interface ApplicationUpdatedPayload extends CollaborationEventPayload {
  applicationId: string;
  conversationId: string;
  changes?: Record<string, any>;
}

export interface SuggestionCreatedPayload extends CollaborationEventPayload {
  suggestionId: string;
  conversationId: string;
  applicationId: string;
}

export interface SuggestionResolvedPayload extends CollaborationEventPayload {
  suggestionId: string;
  conversationId: string;
  applicationId: string;
  status: "accepted" | "rejected";
}

export interface ReminderCreatedPayload extends CollaborationEventPayload {
  reminderId: string;
  conversationId: string;
  applicationId: string;
}

export interface MentoringPlanUpdatedPayload extends CollaborationEventPayload {
  conversationId: string;
}

export interface ActivityLogCreatedPayload extends CollaborationEventPayload {
  activityLogId: string;
  conversationId: string;
  applicationId: string;
}

export interface MessageNewPayload extends CollaborationEventPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderRole: "mentee" | "mentor" | "system";
  content: string;
  createdAt: string;
}

export interface NotificationNewPayload extends CollaborationEventPayload {
  notificationId: string;
  userId: string;
  conversationId: string;
  type: "chat_message" | "reminder_due" | "insight_ready" | "mentor_suggestion";
  title: string;
  body: string;
  link?: string;
  createdAt: string;
}


