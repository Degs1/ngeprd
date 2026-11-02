import { z } from "zod";
import { ObjectId } from "mongodb";

export const ChangeSetStatusSchema = z.enum([
  "generating",
  "pending",
  "applied",
  "rejected",
  "reverted",
  "failed",
]);
export type ChangeSetStatus = z.infer<typeof ChangeSetStatusSchema>;

export const ChangeItemRoleSchema = z.enum(["origin", "impacted"]);
export type ChangeItemRole = z.infer<typeof ChangeItemRoleSchema>;

export const ChangeItemDetectedBySchema = z.enum(["origin", "ai", "term-match"]);
export type ChangeItemDetectedBy = z.infer<typeof ChangeItemDetectedBySchema>;

export const ChangeItemStatusSchema = z.enum(["pending", "ready", "failed"]);
export type ChangeItemStatus = z.infer<typeof ChangeItemStatusSchema>;

export const ChangeItemSnapshotSchema = z.object({
  title: z.string(),
  content: z.string(),
  diagramCode: z.string().optional(),
});
export type ChangeItemSnapshot = z.infer<typeof ChangeItemSnapshotSchema>;

export const ChangeItemSchema = z.object({
  sectionId: z.string(),
  role: ChangeItemRoleSchema,
  reason: z.string(),
  detectedBy: ChangeItemDetectedBySchema,
  baseRev: z.number().int().nonnegative(),
  before: ChangeItemSnapshotSchema,
  after: ChangeItemSnapshotSchema.nullable(),
  status: ChangeItemStatusSchema.default("pending"),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  appliedRev: z.number().int().nonnegative().optional(),
});
export type ChangeItem = z.infer<typeof ChangeItemSchema>;

export const KeyDecisionChangeSchema = z.object({
  before: z.string().optional(),
  after: z.string(),
});
export type KeyDecisionChange = z.infer<typeof KeyDecisionChangeSchema>;

export const PrdChangeSetSchema = z.object({
  _id: z.instanceof(ObjectId),
  ownerId: z.string().min(1),
  docId: z.instanceof(ObjectId),
  originSectionId: z.string().min(1),
  instruction: z.string().min(1),
  status: ChangeSetStatusSchema.default("generating"),
  rationale: z.string().default(""),
  warnings: z.array(z.string()).default([]),
  keyDecisionChanges: z.array(KeyDecisionChangeSchema).default([]),
  items: z.array(ChangeItemSchema).default([]),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
  resolvedAt: z.coerce.date().optional(),
});
export type PrdChangeSet = z.infer<typeof PrdChangeSetSchema>;

// Request schemas for change sets
export const CreateChangeSetSchema = z.object({
  originSectionId: z.string().min(1),
  instruction: z.string().trim().min(1, "Instruction must not be empty").max(1000, "Instruction must be at most 1000 characters"),
});
export type CreateChangeSetInput = z.infer<typeof CreateChangeSetSchema>;

export const ApplyChangeSetActionSchema = z.object({
  action: z.literal("apply"),
  sectionIds: z.array(z.string()).optional(),
});

export const RejectChangeSetActionSchema = z.object({
  action: z.literal("reject"),
});

export const RevertChangeSetActionSchema = z.object({
  action: z.literal("revert"),
});

export const ChangeSetActionSchema = z.discriminatedUnion("action", [
  ApplyChangeSetActionSchema,
  RejectChangeSetActionSchema,
  RevertChangeSetActionSchema,
]);
export type ChangeSetActionInput = z.infer<typeof ChangeSetActionSchema>;
