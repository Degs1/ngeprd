import { z } from "zod";
import { ObjectId } from "mongodb";

export const PrdStatusSchema = z.enum(["brainstorming", "generating", "ready", "failed"]);
export type PrdStatus = z.infer<typeof PrdStatusSchema>;

export const SectionStatusSchema = z.enum(["pending", "writing", "ready", "failed"]);
export type SectionStatus = z.infer<typeof SectionStatusSchema>;

export const SectionTypeSchema = z.enum([
  "overview",
  "problem",
  "goals",
  "users",
  "features",
  "flow",
  "architecture",
  "data_model",
  "tech_stack",
  "api",
  "security",
  "nfr",
  "risks",
  "roadmap",
  "custom",
]);
export type SectionType = z.infer<typeof SectionTypeSchema>;

export const DiagramHintSchema = z.enum(["flowchart", "sequence", "er", "state"]);
export type DiagramHint = z.infer<typeof DiagramHintSchema>;

export const DiagramSchema = z.object({
  kind: z.literal("mermaid"),
  code: z.string(),
  status: z.enum(["unchecked", "ok", "invalid"]).default("unchecked"),
  error: z.string().optional(),
});
export type Diagram = z.infer<typeof DiagramSchema>;

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  order: z.number().int(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  type: SectionTypeSchema,
  title: z.string().min(1),
  brief: z.string().optional(),
  diagramHint: DiagramHintSchema.optional(),
  content: z.string().default(""),
  diagram: DiagramSchema.optional(),
  order: z.number().int(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  status: SectionStatusSchema.default("pending"),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  rev: z.number().int().nonnegative().default(1),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type Section = z.infer<typeof SectionSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
});
export type Edge = z.infer<typeof EdgeSchema>;

export const BrainstormQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  why: z.string().optional(),
  options: z.array(z.string()),
  allowCustom: z.boolean().default(true),
});
export type BrainstormQuestion = z.infer<typeof BrainstormQuestionSchema>;

export const BrainstormAnswerSchema = z.object({
  questionId: z.string(),
  value: z.string(),
  isCustom: z.boolean(),
  delegated: z.boolean().optional(),
});
export type BrainstormAnswer = z.infer<typeof BrainstormAnswerSchema>;

export const PrdDocumentSchema = z.object({
  _id: z.instanceof(ObjectId),
  ownerId: z.string().min(1),
  title: z.string().min(1),
  titleEdited: z.boolean().default(false),
  titleRev: z.number().int().positive().optional(),
  idea: z.string().min(1),
  lang: z.enum(["id", "en"]).default("id"),
  status: PrdStatusSchema.default("brainstorming"),
  brainstorm: z.object({
    questions: z.array(BrainstormQuestionSchema).default([]),
    answers: z.array(BrainstormAnswerSchema).default([]),
  }).default({ questions: [], answers: [] }),
  keyDecisions: z.array(z.string()).default([]),
  chapters: z.array(ChapterSchema).default([]),
  sections: z.array(SectionSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  run: z
    .object({
      id: z.string(),
      startedAt: z.coerce.date(),
      heartbeatAt: z.coerce.date(),
    })
    .nullable()
    .optional(),
  lastError: z
    .object({
      code: z.string(),
      message: z.string(),
      stage: z.string(),
      at: z.coerce.date(),
    })
    .nullable()
    .optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type PrdDocument = z.infer<typeof PrdDocumentSchema>;

// Light-weight projection for listing
export interface PrdListItem {
  _id: ObjectId;
  title: string;
  status: PrdStatus;
  updatedAt: Date;
}

// Request validation schemas
export const CreatePrdSchema = z.object({
  idea: z.string().trim().min(1, "Idea must not be empty").max(2000, "Idea must be at most 2000 characters"),
  lang: z.enum(["id", "en"]).optional(),
});
export type CreatePrdInput = z.infer<typeof CreatePrdSchema>;

export const UpdatePrdTitleSchema = z.object({
  title: z.string().trim().min(1, "Title must not be empty").max(200),
  baseRev: z.number().int().positive().optional(),
});
export type UpdatePrdTitleInput = z.infer<typeof UpdatePrdTitleSchema>;

export const UpdateLayoutSchema = z.object({
  positions: z.array(
    z.object({
      sectionId: z.string().min(1),
      x: z.number(),
      y: z.number(),
    })
  ).min(1),
});
export type UpdateLayoutInput = z.infer<typeof UpdateLayoutSchema>;

export const AddSectionSchema = z.object({
  chapterId: z.string().min(1, "chapterId is required"),
  title: z.string().trim().min(1, "title is required"),
  type: SectionTypeSchema.optional().default("custom"),
});
export type AddSectionInput = z.infer<typeof AddSectionSchema>;

export const UpdateSectionSchema = z.object({
  baseRev: z.number().int().nonnegative("baseRev is required and must be non-negative"),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(200000).optional(),
  diagram: DiagramSchema.extend({ code: z.string().max(8192) }).optional(),
});
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>;

/**
 * ID generator helpers matching section 7.3 specifications:
 * Chapter: "chap_" + nanoid
 * Section: "sec_" + nanoid
 */
export function generateId(prefix: string, length = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}_${result}`;
}

export function generateChapterId(): string {
  return generateId("chap", 10);
}

export function generateSectionId(): string {
  return generateId("sec", 10);
}

export function generateEdgeId(): string {
  return generateId("edge", 8);
}
