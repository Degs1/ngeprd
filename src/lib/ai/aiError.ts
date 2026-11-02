export type AiErrorCode =
  | "AI_TIMEOUT"
  | "AI_UNREACHABLE"
  | "AI_INVALID_OUTPUT"
  | "AI_AUTH_ERROR"
  | "AI_SERVER_ERROR"
  | "AI_RATE_LIMIT";

export class AiError extends Error {
  code: AiErrorCode;
  stage?: string;
  docId?: string;
  sectionId?: string;

  constructor(
    code: AiErrorCode,
    message: string,
    options?: { stage?: string; docId?: string; sectionId?: string }
  ) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.stage = options?.stage;
    this.docId = options?.docId;
    this.sectionId = options?.sectionId;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        stage: this.stage,
      },
    };
  }
}
