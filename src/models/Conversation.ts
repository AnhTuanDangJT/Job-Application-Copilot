import { Schema, model, models, Document, Types } from "mongoose";

export interface ProgressOverride {
  overallPercent: number;
  resumeReviewed: boolean;
  actionItemsCompleted: number;
  updatedAt: Date;
  updatedBy: Types.ObjectId; // Mentor who made the override
}

export interface IMentoringPlan {
  goals: string[];
  milestones: string[];
  mentorNotes: string;
  menteeNotes: string;
  lastUpdatedBy: "mentor" | "mentee";
  updatedAt: Date;
}

export interface IMeeting {
  id: string;
  title: string;
  date: Date;
  timezone: string;
  notes: string;
  calendarLink?: string;
}

export interface IMenteeMetadata {
  targetRole?: string;
  targetLocations?: string[];
  season?: string;
  currentPhase?: string;
  menteeTags?: string[];
  notes?: string;
  updatedAt: Date;
  updatedBy: Types.ObjectId; // Mentor who last updated
}

export interface IConversation extends Document {
  mentorId: Types.ObjectId;
  menteeId: Types.ObjectId;
  goal?: string;
  focusAreas?: string[];
  sessionType?: "RESUME" | "INTERVIEW" | "JOB_SEARCH";
    status?: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ENDED"; // ENDED is deprecated, use COMPLETED
    startedAt?: Date;
    completedAt?: Date;
    endedAt?: Date;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  progressOverride?: ProgressOverride;
  mentoringPlan?: IMentoringPlan;
  meetings?: IMeeting[];
  menteeMetadata?: IMenteeMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const MentoringPlanSchema = new Schema<IMentoringPlan>(
  {
    goals: { type: [String], default: [] },
    milestones: { type: [String], default: [] },
    mentorNotes: { type: String, default: "", maxlength: 10000 },
    menteeNotes: { type: String, default: "", maxlength: 10000 },
    lastUpdatedBy: { type: String, enum: ["mentor", "mentee"], required: true },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    date: { type: Date, required: true },
    timezone: { type: String, required: true, maxlength: 50 },
    notes: { type: String, default: "", maxlength: 5000 },
    calendarLink: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const MenteeMetadataSchema = new Schema<IMenteeMetadata>(
  {
    targetRole: { type: String, maxlength: 200 },
    targetLocations: { type: [String], default: [] },
    season: { type: String, maxlength: 50 },
    currentPhase: { type: String, maxlength: 100 },
    menteeTags: { type: [String], default: [] },
    notes: { type: String, maxlength: 10000 },
    updatedAt: { type: Date, required: true, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    goal: { type: String, default: "Improve resume and job readiness", maxlength: 500 },
    focusAreas: { type: [String], default: ["Resume"] },
    sessionType: { type: String, enum: ["RESUME", "INTERVIEW", "JOB_SEARCH"], default: "RESUME", index: true },
    status: { type: String, enum: ["ACTIVE", "COMPLETED", "CANCELLED", "ENDED"], default: "ACTIVE", index: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    endedAt: { type: Date },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, maxlength: 200 },
    progressOverride: {
      overallPercent: { type: Number, min: 0, max: 100 },
      resumeReviewed: { type: Boolean },
      actionItemsCompleted: { type: Number, min: 0 },
      updatedAt: { type: Date },
      updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    mentoringPlan: { type: MentoringPlanSchema },
    meetings: { type: [MeetingSchema], default: [] },
    menteeMetadata: { type: MenteeMetadataSchema },
  },
  { timestamps: true }
);

// Non-unique compound index on { mentorId, menteeId } to allow multiple conversations
// Only one ACTIVE conversation per mentor-mentee pair is enforced in application logic
ConversationSchema.index({ mentorId: 1, menteeId: 1 });

// Index for mentor queries sorted by updatedAt
ConversationSchema.index({ mentorId: 1, updatedAt: -1 });

// Index for mentee queries sorted by updatedAt
ConversationSchema.index({ menteeId: 1, updatedAt: -1 });

export const Conversation = models.Conversation || model<IConversation>("Conversation", ConversationSchema);

