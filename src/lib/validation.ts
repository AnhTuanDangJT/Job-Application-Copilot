import { z } from "zod";
import { sanitizeEmail, sanitizeString, sanitizeTextContent } from "./sanitize";

// Helper to sanitize strings in Zod schemas - validation before transformation
const sanitizedString = (maxLength: number = 10000, minLength: number = 1) =>
  z.string()
    .min(minLength, `Must be at least ${minLength} character${minLength > 1 ? 's' : ''}`)
    .max(maxLength, `Must be at most ${maxLength} characters`)
    .transform((val) => sanitizeString(val, maxLength));

export const sanitizedEmail = () =>
  z.string()
    .email("Invalid email address")
    .max(255, "Email too long")
    .transform((val) => sanitizeEmail(val));

const sanitizedText = (maxLength: number = 50000, minLength: number = 1) =>
  z.string()
    .min(minLength, `Must be at least ${minLength} character${minLength > 1 ? 's' : ''}`)
    .max(maxLength, `Must be at most ${maxLength} characters`)
    .transform((val) => sanitizeTextContent(val, maxLength));

// Auth validation schemas
export const registerSchema = z.object({
  name: sanitizedString(100, 1),
  email: sanitizedEmail(),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  role: z.enum(["mentee", "mentor", "admin"]).optional(),
});

export const loginSchema = z.object({
  email: sanitizedEmail(),
  password: z.string().min(1, "Password is required").max(100, "Password too long"),
});

export const verifyEmailSchema = z.object({
  email: sanitizedEmail(),
  code: z.string().length(6, "Verification code must be 6 digits").regex(/^\d+$/, "Verification code must be numeric"),
});

export const resendVerificationSchema = z.object({
  email: sanitizedEmail(),
});

// Job validation schemas
export const jobListSchema = z.object({
  q: sanitizedString(200).optional(),
});

export const jobScrapeSchema = z.object({
  title: sanitizedString(200, 1).optional(),
  company: sanitizedString(200, 1).optional(),
  jd_text: sanitizedText(100000, 1).optional(),
  source: sanitizedString(100).optional(),
});

// Application validation schemas
export const submitApplicationSchema = z.object({
  jobId: z.string().min(1, "Job ID is required").max(100, "Invalid job ID"),
  resume_version: sanitizedText(100000).optional(),
  cover_letter: sanitizedText(100000).optional(),
});

// Analysis validation schemas
export const analyzeSchema = z.object({
  resume: sanitizedText(100000, 1),
  jd: sanitizedText(100000, 1),
});

export const tailorResumeSchema = z.object({
  resume: sanitizedText(100000, 1),
  jd: sanitizedText(100000, 1),
});

export const generateCoverLetterSchema = z.object({
  jd: sanitizedText(100000, 1),
  resume: sanitizedText(100000, 1),
  tone: z.enum(["professional", "confident", "friendly"]).optional(),
});

// Orchestration validation schemas
export const orchestrateStartSchema = z.object({
  jobId: z.string().min(1, "Job ID is required").max(100, "Invalid job ID"),
});

// Mentor communication validation schemas
export const createConversationSchema = z.object({
  mentorId: z.string().min(1, "Mentor ID is required").max(100, "Invalid mentor ID").optional(),
  menteeId: z.string().min(1, "Mentee ID is required").max(100, "Invalid mentee ID").optional(),
});

// Email-based conversation creation (privacy-safe)
export const startConversationSchema = z.object({
  email: sanitizedEmail(),
});

export const sendMessageSchema = z.object({
  content: z.string().max(10000).optional(),
  imageUrl: z.string().url().optional(),
}).refine((data) => (data.content && data.content.trim().length > 0) || data.imageUrl, {
  message: "Either content or imageUrl must be provided",
}).transform((data) => ({
  content: data.content?.trim() || undefined,
  imageUrl: data.imageUrl,
}));

export const createFeedbackSchema = z.object({
  resumeShareId: z.string().min(1, "Resume share ID is required").max(100, "Invalid resume share ID"),
  feedbackText: sanitizedText(10000).optional(),
  strengths: sanitizedText(5000).optional(),
  issues: sanitizedText(5000).optional(),
  actionItems: z.array(z.string().min(1).max(500)).max(20).optional(),
  rating: z.number().min(1).max(5).optional(),
});

// Application Board validation schemas
const columnSchema = z.object({
  _id: z.string().optional(), // Optional, for preserving existing column IDs
  key: sanitizedString(100, 1),
  name: sanitizedString(100, 1),
  type: z.enum(["text", "longtext", "date", "select", "number", "checkbox"]),
  required: z.boolean().optional(),
  options: z.array(sanitizedString(200)).optional(), // For select type
  width: z.number().min(50).max(1000).optional(),
  order: z.number().int().min(0),
});

export const updateColumnsSchema = z.object({
  columns: z.array(columnSchema).min(1).max(50), // Limit to 50 columns
});

const cellValueSchema = z.union([
  z.string().max(10000), // Max length for text/longtext
  z.number(),
  z.boolean(),
  z.null(),
]);

export const createRowSchema = z.object({
  cells: z.record(sanitizedString(100), cellValueSchema).optional(), // Optional, can be empty initially
});

export const updateRowSchema = z.object({
  cells: z
    .record(sanitizedString(100), cellValueSchema)
    .refine(
      (obj) => Object.keys(obj).length > 0,
      { message: "At least one cell must be updated" }
    ),
});

export const rowsQuerySchema = z.object({
  page: z.string().optional().transform((val) => {
    if (!val) return 1;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }),
  limit: z.string().optional().transform((val) => {
    if (!val) return 50;
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) return 50;
    return parsed > 100 ? 100 : parsed; // Max 100 per page
  }),
});

// Collaboration feature validation schemas
export const tagSchema = z.object({
  id: z.string().min(1).max(100),
  label: sanitizedString(100, 1),
  color: sanitizedString(20, 1),
});

export const reminderSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["follow-up", "interview", "thank-you"]),
  date: z.string().datetime(),
  createdBy: z.enum(["mentor", "mentee"]),
});

export const activityLogEntrySchema = z.object({
  id: z.string().min(1).max(100),
  authorRole: z.enum(["mentor", "mentee"]),
  message: sanitizedString(5000, 1),
  timestamp: z.date().optional(),
});

export const historyEntrySchema = z.object({
  id: z.string().min(1).max(100),
  field: sanitizedString(100, 1),
  oldValue: cellValueSchema,
  newValue: cellValueSchema,
  changedBy: z.enum(["mentor", "mentee"]),
  timestamp: z.date().optional(),
});

export const mentoringPlanSchema = z.object({
  goals: z.array(sanitizedString(500, 1)).max(50),
  milestones: z.array(sanitizedString(500, 1)).max(50),
  mentorNotes: sanitizedText(10000).optional(),
  menteeNotes: sanitizedText(10000).optional(),
  lastUpdatedBy: z.enum(["mentor", "mentee"]),
  updatedAt: z.date().optional(),
});

export const meetingSchema = z.object({
  id: z.string().min(1).max(100),
  title: sanitizedString(200, 1),
  date: z.string().datetime(),
  timezone: sanitizedString(50, 1),
  notes: sanitizedText(5000).optional(),
  calendarLink: sanitizedString(500).optional(),
});

export const createSuggestionSchema = z.object({
  applicationId: z.string().min(1).max(100),
  field: sanitizedString(100, 1),
  oldValue: cellValueSchema,
  proposedValue: cellValueSchema,
});

export const addActivityLogSchema = z.object({
  message: sanitizedString(5000, 1),
});

export const addReminderSchema = z.object({
  type: z.enum(["follow-up", "interview", "thank-you"]),
  date: z.string().datetime(),
});

// Standalone Reminder validation schemas
export const createReminderSchema = z.object({
  conversationId: z.string().min(1).max(100),
  applicationId: z.string().min(1).max(100).optional(),
  type: z.enum(["follow-up", "interview", "thank-you"]),
  dueAt: z.string().datetime(),
});

export const updateReminderSchema = z.object({
  type: z.enum(["follow-up", "interview", "thank-you"]).optional(),
  dueAt: z.string().datetime().optional(),
  status: z.enum(["pending", "triggered", "cancelled"]).optional(),
});

export const updateMentoringPlanSchema = z.object({
  goals: z.array(sanitizedString(500, 1)).max(50).optional(),
  milestones: z.array(sanitizedString(500, 1)).max(50).optional(),
  mentorNotes: sanitizedText(10000).optional(),
  menteeNotes: sanitizedText(10000).optional(),
});

export const createMeetingSchema = z.object({
  title: sanitizedString(200, 1),
  date: z.string().datetime(),
  timezone: sanitizedString(50, 1),
  notes: sanitizedText(5000).optional(),
  calendarLink: sanitizedString(500).optional(),
});

// Mentor mentee metadata update schema
export const updateMenteeMetadataSchema = z.object({
  conversationId: z.string().min(1).max(100),
  targetRole: sanitizedString(200).optional(),
  targetLocations: z.array(sanitizedString(200)).max(50).optional(),
  season: sanitizedString(50).optional(),
  currentPhase: sanitizedString(100).optional(),
  menteeTags: z.array(sanitizedString(100)).max(50).optional(),
  notes: sanitizedText(10000).optional(),
});

// Group validation schemas
export const createGroupSchema = z.object({
  name: sanitizedString(200, 1),
});

export const updateGroupSchema = z.object({
  name: sanitizedString(200, 1),
});

export const addGroupMemberSchema = z.object({
  menteeId: z.string().min(1, "Mentee ID is required").max(100, "Invalid mentee ID"),
});

export const createGroupAnnouncementSchema = z.object({
  content: sanitizedText(5000, 1),
});

// AI validation schemas
export const aiChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: sanitizedText(10000, 1),
    })
  ).min(1).max(20), // Max 20 messages in conversation
});

export const aiCoverLetterSchema = z.object({
  jobDescription: sanitizedText(50000, 1),
  resumeText: sanitizedText(50000, 1),
  tone: z.enum(["professional", "confident", "friendly"]).optional(),
});

export const aiResumeFeedbackSchema = z.object({
  resumeText: sanitizedText(50000, 1),
});

export const aiResumeSummarySchema = z.object({
  resumeText: sanitizedText(50000, 1),
});

export const aiAnnouncementRewriteSchema = z.object({
  draftText: sanitizedText(5000, 1),
});

export const aiResumeGradingSchema = z.object({
  resumeText: sanitizedText(50000, 1),
});

// Helper function to validate request body
export async function validateRequestBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; status: number; details?: z.ZodError }> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      // Return detailed error information
      const issues = result.error.issues;
      const firstError = issues[0];
      const errorMessage = firstError?.message || "Validation error";
      return {
        success: false,
        error: errorMessage,
        status: 400,
        details: result.error,
      };
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: "Invalid JSON in request body",
        status: 400,
      };
    }
    return {
      success: false,
      error: "Invalid request body",
      status: 400,
    };
  }
}

// Helper to validate MongoDB ObjectId format
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Helper function to validate query parameters
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string; status: number } {
  try {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues;
      const firstError = issues[0];
      return {
        success: false,
        error: firstError?.message || "Validation error",
        status: 400,
      };
    }
    return {
      success: false,
      error: "Invalid query parameters",
      status: 400,
    };
  }
}

