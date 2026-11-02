import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import {
  generateJson,
  parseRetryAfterHeader,
  calculateRateLimitDelayMs,
  sleepWithSignal,
  AiError,
} from "../src/lib/ai/generateJson";
import { AiRequestQueue } from "../src/lib/ai/aiQueue";

test("parseRetryAfterHeader - parses seconds from retry-after header", () => {
  const err = {
    responseHeaders: {
      "retry-after": "5",
    },
  };
  assert.equal(parseRetryAfterHeader(err), 5000);
});

test("parseRetryAfterHeader - parses milliseconds from retry-after-ms and x-ratelimit-reset-after-ms", () => {
  const err1 = {
    headers: {
      "retry-after-ms": "2500",
    },
  };
  assert.equal(parseRetryAfterHeader(err1), 2500);

  const err2 = {
    headers: {
      "x-ratelimit-reset-after-ms": "1750",
    },
  };
  assert.equal(parseRetryAfterHeader(err2), 1750);
});

test("parseRetryAfterHeader - parses date format from retry-after header", () => {
  const future = new Date(Date.now() + 8000).toUTCString();
  const err = {
    responseHeaders: {
      "retry-after": future,
    },
  };
  const parsed = parseRetryAfterHeader(err);
  assert.ok(parsed !== null && parsed > 5000 && parsed <= 9000);
});

test("parseRetryAfterHeader - parses retry timing from error message strings", () => {
  const err1 = new Error("Rate limit exceeded. Please retry after 3.5 seconds.");
  assert.equal(parseRetryAfterHeader(err1), 3500);

  const err2 = new Error("Too many requests: resets in 12s");
  assert.equal(parseRetryAfterHeader(err2), 12000);

  const err3 = new Error("Gateway throttled, try again in 500ms");
  assert.equal(parseRetryAfterHeader(err3), 500);

  const errNone = new Error("Generic failure without timing info");
  assert.equal(parseRetryAfterHeader(errNone), null);
});

test("calculateRateLimitDelayMs - applies exponential backoff with jitter and respects max cap", () => {
  // Retry 0: base 2000 * 1 + jitter (0..1000) -> 2000..3000ms
  const delay0 = calculateRateLimitDelayMs(0, null, 2000, 30000);
  assert.ok(delay0 >= 2000 && delay0 <= 3000);

  // Retry 1: base 2000 * 2 + jitter -> 4000..5000ms
  const delay1 = calculateRateLimitDelayMs(1, null, 2000, 30000);
  assert.ok(delay1 >= 4000 && delay1 <= 5000);

  // Retry 2: base 2000 * 4 + jitter -> 8000..9000ms
  const delay2 = calculateRateLimitDelayMs(2, null, 2000, 30000);
  assert.ok(delay2 >= 8000 && delay2 <= 9000);

  // Max cap test
  const delayCapped = calculateRateLimitDelayMs(10, null, 2000, 15000);
  assert.equal(delayCapped, 15000);

  // Explicit Retry-After header
  const explicitErr = { headers: { "retry-after": "2" } };
  const delayExplicit = calculateRateLimitDelayMs(0, explicitErr, 2000, 30000);
  // 2000ms + 10..300ms jitter
  assert.ok(delayExplicit >= 2000 && delayExplicit <= 2500);
});

test("sleepWithSignal - aborts cleanly when signal triggers", async () => {
  const controller = new AbortController();
  const promise = sleepWithSignal(10000, controller.signal);

  // Abort immediately
  controller.abort();

  await assert.rejects(
    async () => {
      await promise;
    },
    (err: unknown) => {
      assert.equal(err instanceof AiError, true);
      if (err instanceof AiError) {
        assert.equal(err.code, "AI_TIMEOUT");
      }
      return true;
    }
  );
});

test("generateJson - rate limit (429) retries with backoff and succeeds on retry", async () => {
  let callCount = 0;

  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      // First attempt returns 429 with explicit short retry-after
      return new Response(
        JSON.stringify({ error: { message: "Rate limit exceeded", type: "rate_limit_error" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "retry-after-ms": "50",
          },
        }
      );
    }

    // Second attempt succeeds
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: Date.now(),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: '{"recovered": true, "attempt": 2}',
            },
            finish_reason: "stop",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  const mockClient = createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "test-key",
    fetch: mockFetch,
  });

  const schema = z.object({
    recovered: z.boolean(),
    attempt: z.number(),
  });

  const result = await generateJson({
    stage: "test-ratelimit-recover",
    system: "Test system",
    user: "Test ratelimit",
    schema,
    client: mockClient,
    bypassQueue: true,
  });

  assert.equal(callCount, 2);
  assert.equal(result.recovered, true);
  assert.equal(result.attempt, 2);
});

test("generateJson - rate limit (429) exhausts retries and throws AI_RATE_LIMIT", async () => {
  let callCount = 0;

  const mockFetch = async () => {
    callCount++;
    return new Response(
      JSON.stringify({ error: { message: "Rate limit reached", type: "rate_limit_error" } }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "retry-after-ms": "10",
        },
      }
    );
  };

  const mockClient = createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "test-key",
    fetch: mockFetch,
  });

  const schema = z.object({ value: z.string() });

  await assert.rejects(
    async () => {
      await generateJson({
        stage: "test-ratelimit-exhausted",
        system: "Test system",
        user: "Test 429",
        schema,
        client: mockClient,
        bypassQueue: true,
      });
    },
    (err: unknown) => {
      assert.equal(err instanceof AiError, true);
      if (err instanceof AiError) {
        assert.equal(err.code, "AI_RATE_LIMIT");
      }
      return true;
    }
  );

  // 1 initial attempt + 3 rate limit retries = 4 total calls
  assert.equal(callCount, 4);
});

test("AiRequestQueue - enforces maxConcurrency and processes queued tasks", async () => {
  const queue = new AiRequestQueue({ maxConcurrency: 2, maxRpm: 0 });

  let concurrentRunning = 0;
  let maxConcurrentObserved = 0;
  const executionOrder: number[] = [];

  const makeTask = (id: number, delayMs: number) => {
    return async () => {
      concurrentRunning++;
      maxConcurrentObserved = Math.max(maxConcurrentObserved, concurrentRunning);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      executionOrder.push(id);
      concurrentRunning--;
      return id;
    };
  };

  const p1 = queue.enqueue(makeTask(1, 40));
  const p2 = queue.enqueue(makeTask(2, 40));
  const p3 = queue.enqueue(makeTask(3, 20));
  const p4 = queue.enqueue(makeTask(4, 20));

  const stats = queue.getStats();
  assert.equal(stats.activeCount, 2);
  assert.equal(stats.queuedCount, 2);

  const results = await Promise.all([p1, p2, p3, p4]);
  assert.deepEqual(results, [1, 2, 3, 4]);
  assert.equal(maxConcurrentObserved, 2);

  const finalStats = queue.getStats();
  assert.equal(finalStats.activeCount, 0);
  assert.equal(finalStats.queuedCount, 0);
});

test("AiRequestQueue - distributes requests fairly across documents via round-robin", async () => {
  const queue = new AiRequestQueue({ maxConcurrency: 1, maxRpm: 0 });

  const executionLog: string[] = [];

  const makeDocTask = (docId: string, label: string) => {
    return async () => {
      executionLog.push(`${docId}:${label}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return label;
    };
  };

  // Doc A enqueues 3 tasks
  const a1 = queue.enqueue(makeDocTask("docA", "A1"), { docId: "docA" });
  const a2 = queue.enqueue(makeDocTask("docA", "A2"), { docId: "docA" });
  const a3 = queue.enqueue(makeDocTask("docA", "A3"), { docId: "docA" });

  // Doc B enqueues 2 tasks
  const b1 = queue.enqueue(makeDocTask("docB", "B1"), { docId: "docB" });
  const b2 = queue.enqueue(makeDocTask("docB", "B2"), { docId: "docB" });

  await Promise.all([a1, a2, a3, b1, b2]);

  // Round-robin: docA first task started immediately, then docB, then docA, docB, docA
  assert.deepEqual(executionLog, [
    "docA:A1",
    "docB:B1",
    "docA:A2",
    "docB:B2",
    "docA:A3",
  ]);
});

test("AiRequestQueue - notifyRateLimit pauses execution until cooldown expires", async () => {
  const queue = new AiRequestQueue({ maxConcurrency: 2, maxRpm: 0 });

  let task2StartedAt = 0;
  const start = Date.now();

  const p1 = queue.enqueue(async () => {
    // Simulate task encountering rate limit and notifying queue
    queue.notifyRateLimit(80);
    return "ok1";
  });

  const p2 = queue.enqueue(async () => {
    task2StartedAt = Date.now();
    return "ok2";
  });

  await Promise.all([p1, p2]);

  // task2 should only have started after ~80ms cooldown
  assert.ok(task2StartedAt - start >= 70, `Expected delay >= 70ms, got ${task2StartedAt - start}ms`);
});

test("AiRequestQueue - cancels queued task on AbortSignal", async () => {
  const queue = new AiRequestQueue({ maxConcurrency: 1, maxRpm: 0 });

  // First task holds the only slot for 50ms
  const p1 = queue.enqueue(async () => {
    await new Promise((r) => setTimeout(r, 50));
    return "done1";
  });

  // Second task is queued with an AbortController
  const controller = new AbortController();
  const p2 = queue.enqueue(
    async () => {
      return "done2";
    },
    { signal: controller.signal }
  );

  // Abort p2 while it's still waiting in queue
  controller.abort();

  await assert.rejects(
    async () => {
      await p2;
    },
    (err: unknown) => {
      assert.equal(err instanceof AiError, true);
      if (err instanceof AiError) {
        assert.equal(err.code, "AI_TIMEOUT");
      }
      return true;
    }
  );

  // p1 still succeeds
  const res1 = await p1;
  assert.equal(res1, "done1");

  // Queue should now be empty
  assert.equal(queue.getStats().queuedCount, 0);
  assert.equal(queue.getStats().activeCount, 0);
});
