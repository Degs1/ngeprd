export interface ParsedSseEvent<T = unknown> {
  event: string;
  data: T;
  raw: string;
  id?: string;
}

/**
 * Parses an individual SSE block (delimited by \n\n).
 */
export function parseSseBlock<T = unknown>(block: string): ParsedSseEvent<T> | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      // Comment line in SSE standard, ignored
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.startsWith("data: ") ? line.slice(6) : line.slice(5));
    } else if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    }
  }

  // If no data and no custom event, treat as empty/null
  if (dataLines.length === 0 && event === "message") {
    return null;
  }

  const rawData = dataLines.join("\n");
  let parsedData: unknown = rawData;

  if (rawData.length > 0) {
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      parsedData = rawData;
    }
  } else {
    parsedData = {};
  }

  return {
    event,
    data: parsedData as T,
    raw: rawData,
    id,
  };
}

/**
 * Parses a complete SSE text string containing multiple events.
 */
export function parseSseText<T = unknown>(text: string): ParsedSseEvent<T>[] {
  const blocks = text.split(/(?:\r?\n){2,}/);
  const events: ParsedSseEvent<T>[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;
    const parsed = parseSseBlock<T>(block);
    if (parsed) {
      events.push(parsed);
    }
  }

  return events;
}

/**
 * Streaming parser that consumes incremental chunks from a stream
 * and dispatches fully received events.
 */
export function createSseStreamParser<T = unknown>(
  onEvent: (event: ParsedSseEvent<T>) => void
) {
  let buffer = "";

  return {
    feed(chunk: string) {
      buffer += chunk;
      const parts = buffer.split(/(?:\r?\n){2,}/);
      // The last part is the incomplete buffer
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;
        const parsed = parseSseBlock<T>(part);
        if (parsed) {
          onEvent(parsed);
        }
      }
    },
    flush() {
      if (buffer.trim()) {
        const parsed = parseSseBlock<T>(buffer);
        if (parsed) {
          onEvent(parsed);
        }
        buffer = "";
      }
    },
  };
}
