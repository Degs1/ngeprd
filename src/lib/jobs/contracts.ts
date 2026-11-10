import { ObjectId } from "mongodb";

export type JobKind = "brainstorm" | "generation";
export type JobState =
  | "queued" | "running" | "waiting_user" | "waiting_capacity"
  | "retry_scheduled" | "blocked" | "completed" | "failed"
  | "cancelling" | "cancelled";
export type TaskStage = "brainstorm" | "planner" | "section" | "diagram" | "finalize";
export type TaskState = "queued" | "leased" | "waiting_capacity" | "retry_scheduled" | "completed" | "failed" | "cancelled";

export interface AiTaskError {
  code: string;
  message: string;
  category: "capacity" | "provider" | "validation" | "persistence" | "cancelled";
  retryable: boolean;
  at: Date;
}

/** A completed task points to a fenced PRD checkpoint, rather than duplicating its content. */
export interface AiCheckpoint {
  taskKey: string;
  stage: TaskStage;
  sectionId?: string;
  fence: number;
  persistedAt: Date;
}

export interface AiJob {
  _id: ObjectId;
  ownerId: string;
  activeOwnerId?: string;
  prdId: ObjectId;
  kind: JobKind;
  state: JobState;
  stage: TaskStage;
  submissionId: string;
  sectionIds?: string[];
  progress: { total: number; ready: number; failed: number; diagrams: number };
  eventSeq: number;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  lastClaimedAt?: Date;
}

export interface AiTask {
  _id: ObjectId;
  jobId: ObjectId;
  ownerId: string;
  prdId: ObjectId;
  key: string;
  stage: TaskStage;
  sectionId?: string;
  dependsOn: string[];
  state: TaskState;
  attempt: number;
  nextRunAt: Date;
  leaseOwner?: string;
  leaseUntil?: Date;
  fence: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiEvent {
  _id: ObjectId;
  jobId: ObjectId;
  ownerId: string;
  prdId: ObjectId;
  seq: number;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
}
