# ngePRD — AI Worker Migration & Manual Editing

> Implementation checklist for Codex. **Do not mark a task complete without verifying its acceptance criteria.**
> Source baseline: `ngeprd-main` (Next.js 14, MongoDB, AI SDK, React Flow, Mermaid). Paths below are audit targets, not a license to assume implementation details.

## Goals / invariants

- [ ] Preserve end-user journey: idea submission → AI-generated brainstorming questions (typically 4–6) → user answers → planner and 11-section PRD generation with applicable Mermaid diagrams → infinite canvas → manual edits → export.
- [ ] All AI calls, **including brainstorming**, execute through an independently deployed worker and one smart provider pool. No long-running AI in Vercel handlers.
- [ ] Replace AI-assisted node editing with **manual-only** editing. Remove or securely disable server-side AI-edit, change propagation, and AI diagram repair entry points, not just buttons.
- [ ] Keep existing PRDs, schemas, section identifiers, diagram semantics, auth, canvas layout, and exports functional.
- [ ] Preserve user progress across closing the site, worker crashes, provider throttling, and deployment restarts.
- [ ] Avoid new paid dependencies by default: existing MongoDB Atlas as job store; no Redis required for MVP.
- [ ] Implement safe, authorized use of multiple OpenAI-compatible providers/keys; respect provider/project-wide quotas and policies.

## Phase 0 — Audit & design (approval gate)

- [ ] Inspect `src/lib/agent/brainstormer.ts`, `planner.ts`, `runner.ts`, `sectionWriter.ts`, `diagramGenerator.ts` and actual call graph.
- [ ] Inspect `src/lib/ai/aiQueue.ts`, `generateJson.ts`, model client initialization, schemas, prompt contracts, and token accounting.
- [ ] Inspect `src/lib/agent/jobRegistry.ts`, `src/app/api/prds/[id]/brainstorm/route.ts`, `brainstorm/answers/route.ts`, `generate/route.ts`, `cancel/route.ts` and progress/SSE implementation.
- [ ] Inspect `src/lib/agent/reviser.ts`, `changeSetRunner.ts`, `propagator.ts`, `impact.ts`, changeset routes, section routes, `repair-diagram/route.ts`, and all AI-edit UI controls.
- [ ] Identify all read/write paths for PRDs, questions, answers, sections, diagrams, changesets, canvas layout, and exports.
- [ ] Inspect `tests/brainstorm.test.ts`, `tests/mermaid-editing.test.ts`, E2E flows, package scripts, deployment configuration, auth, and MongoDB indexes.
- [ ] Map current and target sequence diagrams; list data migrations, compatibility risks, and rollback strategy.
- [ ] Present audit and staged plan; **obtain approval before substantial implementation**.

**Acceptance:** Real existing code paths and API contracts are documented; ambiguous stages (idea planning vs brainstorming vs post-answer planner) are resolved by source audit rather than assumption.

## Phase 1 — Shared contracts & persistence

- [ ] Define stable typed contracts for brainstorm jobs, generation jobs, tasks, progress events, errors, and checkpoints.
- [ ] Persist `jobs` and `tasks` with `userId`, `prdId`, stage, dependencies, state, attempt, `nextRunAt`, lease owner/expiry, fencing version, and timestamps.
- [ ] Define job states: `queued`, `running`, `waiting_user`, `waiting_capacity`, `retry_scheduled`, `blocked`, `completed`, `failed`, `cancelling`, `cancelled` (use stage fields for planning/writing).
- [ ] Use MongoDB atomic `findOneAndUpdate` / conditional updates to claim tasks, with indexes for eligibility, lease recovery, and idempotent submission.
- [ ] Persist checkpoints for brainstorm questions, accepted answers, plan, each section, each diagram, and finalization.
- [ ] Make writes idempotent and fenced; stale lease owners must not overwrite newer results.
- [ ] Add migration/backfill only when necessary; do not destructively modify existing PRDs.
- [ ] Implement bounded event history or snapshot-based progress reconciliation for reconnects.

**Acceptance:** Two simulated workers cannot claim the same task concurrently; crashes and expired leases recover without duplicate persisted sections.

## Phase 2 — Provider registry, credentials & quota groups

- [ ] Add admin-managed OpenAI-compatible providers with `baseURL`, model mappings, capabilities, priority, enable/disable, and health.
- [ ] Add multiple encrypted credentials per provider; separate encryption key from database; redact secrets from logs, UI, and responses.
- [ ] Support provider, account, model, and shared `quotaGroupId` constraints; do not assume keys have independent quotas.
- [ ] Validate/allowlist backend-configured base URLs to prevent SSRF; enforce admin authorization on configuration endpoints.
- [ ] Implement configurable global concurrency (initial **2**), per-account concurrency (initial **1**), per-user active jobs (initial **1**), RPM and TPM budgets.
- [ ] Use atomic distributed reservations/leases for concurrency and usage; handle multiple worker processes safely.
- [ ] Choose eligible providers by model capability, health, priority, remaining capacity, and load; prefer same model across a PRD.
- [ ] Support explicitly configured cross-model fallback only if schema/capability compatible; never silently downgrade.
- [ ] Classify 429 rate limit vs exhausted quota, 401/403 auth/permission, 5xx, timeout, invalid JSON, incompatible model.
- [ ] Honor `Retry-After` and provider reset hints; use exponential backoff + jitter, bounded attempts, and circuit breaker.
- [ ] If all compatible providers temporarily limited: checkpoint, release reservations, set `waiting_capacity` + `nextRunAt` (no busy polling).
- [ ] If all permanently unavailable/incompatible: set `blocked`, surface actionable non-sensitive reason.
- [ ] Account for uncertain outcomes after timeouts; no false exactly-once AI request claims.

**Acceptance:** Provider A 429 switches to eligible B, shared-quota keys do not exceed common limits, all-limited jobs wait without failing, and invalid credentials do not spin.

## Phase 3 — Standalone worker & full lifecycle

- [ ] Create `worker/` Node.js/TypeScript entry point, reusable agent modules, and shared contracts without importing Next.js request/runtime-only modules.
- [ ] Implement scheduler with fairness across users/PRDs and dependency-aware tasks; prevent one user monopolizing queue.
- [ ] Migrate initial idea analysis / brainstorming question generation to durable worker tasks.
- [ ] Return generated questions through persisted state; **release worker capacity while waiting for user answers**.
- [ ] On answer submission, persist validated answers and enqueue generation exactly once.
- [ ] Preserve planner → section writers (11 expected) → applicable diagram generation → finalization, following real dependencies.
- [ ] Resume only missing/incomplete tasks after restart; preserve previously completed sections and diagrams.
- [ ] Implement cancellation, graceful SIGTERM/SIGINT, lease heartbeat, stale claim recovery, DB outage handling, and shutdown.
- [ ] Implement bounded task concurrency separately from total active jobs; global AI concurrency must apply to **every** AI stage.
- [ ] Add worker Dockerfile, `.dockerignore`, `.env.worker.example`, startup scripts, and deployment/health instructions.

**Acceptance:** From idea submission through completed PRD, all AI calls originate from worker; closing browser and restarting worker do not lose progress.

## Phase 4 — Next.js integration & progress UX

- [ ] Make submit/brainstorm/generate API handlers validate auth, persist jobs/answers, and return quickly; no detached unawaited `fetch()` or long-running work.
- [ ] Preserve current endpoints where practical; document necessary API contract changes.
- [ ] Persist progress snapshots and events; support authenticated SSE with reconnect/replay or polling fallback.
- [ ] Show queued, brainstorming, awaiting answers, planning, section writing, diagram, waiting capacity, retry, blocked, completed, failed, and cancelled states.
- [ ] Show completed sections incrementally without duplicating them after reconnect.
- [ ] Implement safe cancellation and per-user job limits, submission idempotency, and anti-spam throttles.
- [ ] Never expose account IDs/keys, raw provider errors, or privileged operational details to users.

**Acceptance:** Page reload/new device shows correct current state; a closed browser does not interrupt generation.

## Phase 5 — Manual-only node editing (no AI edit)

- [ ] Inventory and remove AI edit/revise/propagate/repair actions from node toolbar, inspector, menus, shortcuts, and related UI.
- [ ] Disable or remove backend routes that invoke AI for editing, including changeset execution and `repair-diagram`, **after auditing non-AI dependencies**; reject old calls with explicit `410 Gone` or appropriate authorization-safe response.
- [ ] Preserve any existing **non-AI** changeset/history capabilities that are still useful; do not blindly delete shared code or user data.
- [ ] Provide direct editing of node title, section content, structured fields, and Mermaid source with existing schema compatibility.
- [ ] Use existing editor if adequate; introduce Tiptap/CodeMirror only if needed, avoiding gratuitous dependency/UI redesign.
- [ ] Provide local undo/redo, dirty state, explicit Save and/or debounced autosave (~800–1500ms), flush on navigation where practical.
- [ ] Use optimistic concurrency/version checks to prevent overwriting newer edits; handle save conflicts visibly.
- [ ] Validate Mermaid syntax locally before preview; allow correcting invalid draft without losing text; no AI repair calls.
- [ ] Keep canvas positions/edges, diagram preview, export, and existing PRD content intact.
- [ ] Add rate limits and payload validation to edit APIs; do not invoke AI on manual edits.

**Acceptance:** Editing a node, diagram, or title triggers **zero AI requests**; old AI-edit API paths cannot be exploited; exports reflect saved edits.

## Phase 6 — Metrics, security, tests & rollout

- [ ] Record `inputTokens`, `outputTokens`, provider/model, stage, duration, retries, queue wait, errors, and cost estimate if pricing configured.
- [ ] Aggregate usage per PRD and per stage, including known failed/retried calls; label unknown usage honestly.
- [ ] Add structured logs/metrics for queue depth, active slots, cooldowns, blocked jobs, latency, and success rate; redact secrets and user content by default.
- [ ] Unit-test queue claims, leases/fencing, idempotency, retries, fairness, quota groups, cooldowns, fallback, cancellation, and recovery.
- [ ] Integration-test brainstorming → answers → 11 sections/diagrams → manual edits → export using mocked AI endpoints.
- [ ] Test 100 concurrent submissions with global AI concurrency=2; verify no unbounded AI calls, queue corruption, or starvation.
- [ ] Test provider outage, all providers exhausted, timeout after upstream completion, worker crash mid-section, and restart.
- [ ] Verify typecheck, lint, unit tests, build, Docker build, and deployment instructions.
- [ ] Roll out behind a feature flag where feasible; keep rollback path and old data readable.
- [ ] Document operational runbook: start/restart worker, provision providers, rotate keys, unblock jobs, inspect failures, and recover leases.

**Acceptance:** End-to-end behavior passes, no AI calls remain in manual editing, and worker is deployable separately from Vercel.

## Suggested initial environment configuration

```dotenv
AI_GLOBAL_CONCURRENCY=2
AI_DEFAULT_ACCOUNT_CONCURRENCY=1
AI_MAX_ACTIVE_JOBS_PER_USER=1
AI_MAX_TASK_RETRIES=3
AI_WORKER_POLL_INTERVAL_MS=1500
AI_WORKER_LEASE_MS=120000
AI_WORKER_HEARTBEAT_MS=30000
# Secrets, MongoDB URI, encryption keys, and provider keys must be configured securely.
```

These values are starting defaults, **not** measured safe provider limits. Validate against real RPM/TPM quotas and workload.

## Definition of done

- [ ] Full idea → brainstorm → answer → 11-section PRD lifecycle works with worker-only AI calls.
- [ ] Multi-provider/multi-key failover and all-provider exhaustion are correct and policy-compliant.
- [ ] Jobs survive user disconnect, worker crash, and restart without losing checkpoints.
- [ ] Global and shared-quota concurrency limits hold under multiworker stress.
- [ ] Manual node and Mermaid editing work with no AI usage or exploitable AI-edit endpoints.
- [ ] Existing canvas, saved PRDs, auth, and export remain functional.
- [ ] Tests, build, migration, Docker deployment, runbook, and rollback instructions are delivered.
