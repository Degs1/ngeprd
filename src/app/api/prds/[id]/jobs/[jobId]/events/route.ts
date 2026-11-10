import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getEvents, getJob } from "@/lib/jobs/repository";
import { encodeSseEvent, SSE_HEADERS } from "@/lib/sse/encode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; jobId: string }> | { id: string; jobId: string } }) {
  const { id, jobId } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  const job = await getJob(jobId, auth.ownerId);
  if (!job || job.prdId.toString() !== id) return new Response(null, { status: 404 });
  let cursor = Math.max(0, Number(req.headers.get("last-event-id") || new URL(req.url).searchParams.get("after") || 0));
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const until = Date.now() + 25000;
      while (!req.signal.aborted && Date.now() < until) {
        const events = await getEvents(job._id, auth.ownerId, cursor);
        for (const event of events) {
          controller.enqueue(encoder.encode(encodeSseEvent(event.type, event.data, String(event.seq))));
          cursor = event.seq;
        }
        const current = await getJob(jobId, auth.ownerId);
        if (!current || ["completed", "failed", "blocked", "cancelled", "waiting_user"].includes(current.state)) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
