import type { SectionType, SectionStatus, Diagram } from "../schemas/prd";

export interface RunStartedPayload {
  runId: string;
  total: number;
}

export interface PlanReadyPayload {
  title: string;
  keyDecisions: string[];
  chapters: Array<{
    id: string;
    title: string;
    order: number;
  }>;
  sections: Array<{
    id: string;
    chapterId: string;
    type: SectionType;
    title: string;
    order: number;
    status: SectionStatus;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
  }>;
}

export interface SectionStartedPayload {
  sectionId: string;
}

export interface SectionCompletedPayload {
  sectionId: string;
  rev: number;
  content: string;
  diagram?: Diagram;
}

export interface SectionFailedPayload {
  sectionId: string;
  code: string;
  message: string;
}

export interface RunCompletedPayload {
  ready: number;
  failed: number;
}

export interface RunFailedPayload {
  code: string;
  message: string;
}

export type HeartbeatPayload = Record<string, never>;

export type GenerateSseEventMap = {
  "run.started": RunStartedPayload;
  "plan.ready": PlanReadyPayload;
  "section.started": SectionStartedPayload;
  "section.completed": SectionCompletedPayload;
  "section.failed": SectionFailedPayload;
  "run.completed": RunCompletedPayload;
  "run.failed": RunFailedPayload;
  heartbeat: HeartbeatPayload;
};

export type GenerateSseEventName = keyof GenerateSseEventMap;

/**
 * Encodes a single Server-Sent Event message per HTML5 EventSource specifications.
 * Format:
 *   [id: <id>\n]
 *   event: <event>\n
 *   data: <json or string line>\n\n
 */
export function encodeSseEvent(event: string, data: unknown, id?: string): string {
  let output = "";
  if (id !== undefined) {
    output += `id: ${id}\n`;
  }
  output += `event: ${event}\n`;

  const rawData =
    typeof data === "string" ? data : JSON.stringify(data ?? {});

  // Handle multi-line data lines correctly
  const lines = rawData.split(/\r?\n/);
  for (const line of lines) {
    output += `data: ${line}\n`;
  }
  output += "\n";
  return output;
}

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
