import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
} from "@xyflow/react";

type NodeChanges = Parameters<typeof applyNodeChanges>[0];
type EdgeChanges = Parameters<typeof applyEdgeChanges>[0];
import type {
  PrdDocument,
  Section,
  SectionType,
  Chapter,
} from "@/lib/schemas/prd";
import {
  buildOutline,
  buildSectionNumberMap,
  type OutlineTree,
} from "@/lib/converter/outline";
import { docToFlow } from "@/lib/converter/docToFlow";
import { createSseStreamParser } from "@/lib/sse/parse";
import type {
  PlanReadyPayload,
  RunStartedPayload,
  SectionCompletedPayload,
  SectionFailedPayload,
  SectionStartedPayload,
  RunCompletedPayload,
  RunFailedPayload,
} from "@/lib/sse/encode";

export interface GenerationProgress {
  total: number;
  ready: number;
  failed: number;
  currentSectionId?: string;
}

export interface ClientChangeItemSnapshot {
  title: string;
  content: string;
  diagramCode?: string;
}

export interface ClientChangeItem {
  sectionId: string;
  role: "origin" | "impacted";
  reason: string;
  detectedBy: "origin" | "ai" | "term-match";
  baseRev: number;
  before: ClientChangeItemSnapshot;
  after: ClientChangeItemSnapshot | null;
  status: "pending" | "ready" | "failed";
  error?: { code: string; message: string };
  appliedRev?: number;
}

export interface ClientChangeSet {
  _id: string;
  ownerId?: string;
  docId: string;
  originSectionId: string;
  instruction: string;
  status: "generating" | "pending" | "applied" | "rejected" | "reverted" | "failed";
  rationale?: string;
  warnings?: string[];
  keyDecisionChanges?: { before?: string; after: string }[];
  items: ClientChangeItem[];
  error?: { code: string; message: string };
  createdAt?: string | Date;
  updatedAt?: string | Date;
  resolvedAt?: string | Date;
}

export interface ChangeSetProgress {
  step: "idle" | "analyzing" | "propagating" | "ready" | "failed";
  current: number;
  total: number;
  message?: string;
}

export interface WorkspaceState {
  prdId: string | null;
  document: PrdDocument | null;
  isLoading: boolean;
  error: string | null;

  // React Flow state
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  // Outline and Navigation
  outlineTree: OutlineTree;
  sectionNumberMap: Map<string, string>;
  collapsedChapters: Record<string, boolean>;
  activeTab: "outline" | "revisions";

  // Generation & SSE
  isGenerating: boolean;
  generationProgress: GenerationProgress;
  abortController: AbortController | null;

  // ChangeSet and AI Revision state (TASK-016)
  activeChangeSet: ClientChangeSet | null;
  changeSetHistory: ClientChangeSet[];
  changeSetProgress: ChangeSetProgress;
  selectedChangeItemIds: string[];
  changeSetRedirect: { sectionId: string; reason: string; instruction?: string } | null;
  isCreatingChangeSet: boolean;
  isApplyingChangeSet: boolean;
  isRevertingChangeSet: boolean;
  changeSetError: string | null;
  changeSetConflicts: Array<{ sectionId: string; baseRev: number; currentRev: number }> | null;
  changesetAbortController: AbortController | null;

  // Layout persistence
  isSavingLayout: boolean;

  // Actions
  loadPrd: (id: string, reloadChangeset?: boolean) => Promise<boolean>;
  setDocument: (doc: PrdDocument) => void;
  onNodesChange: (changes: NodeChanges) => void;
  onEdgesChange: (changes: EdgeChanges) => void;
  onNodeDragStop: (event: any, node: Node) => void;
  selectNode: (id: string | null) => void;
  toggleChapter: (chapterId: string) => void;
  setAllChaptersCollapsed: (collapsed: boolean) => void;
  setActiveTab: (tab: "outline" | "revisions") => void;
  relayout: () => void;
  saveLayoutToServer: () => Promise<boolean>;
  startGeneration: (sectionIds?: string[]) => Promise<void>;
  cancelGeneration: () => void;
  handleSseEvent: (event: string, data: unknown) => void;
  addSection: (chapterId: string, title: string, type?: SectionType) => Promise<boolean>;
  deleteSection: (sectionId: string) => Promise<boolean>;
  updateSectionInStore: (sectionId: string, updates: Partial<Section>) => void;
  saveSection: (
    sectionId: string,
    baseRev: number,
    updates: {
      title?: string;
      content?: string;
      diagram?: Section["diagram"];
    }
  ) => Promise<{
    success: boolean;
    rev?: number;
    conflict?: boolean;
    currentRev?: number;
    error?: string;
  }>;

  // ChangeSet actions (TASK-016)
  createChangeSet: (originSectionId: string, instruction: string) => Promise<boolean>;
  applyChangeSet: (
    changeSetId: string,
    sectionIds?: string[]
  ) => Promise<{
    success: boolean;
    conflicts?: Array<{ sectionId: string; baseRev: number; currentRev: number }>;
    error?: string;
  }>;
  rejectChangeSet: (changeSetId: string) => Promise<boolean>;
  revertChangeSet: (changeSetId: string) => Promise<{
    success: boolean;
    revertedSectionIds?: string[];
    skipped?: string[];
    error?: string;
  }>;
  toggleChangeItemSelection: (sectionId: string) => void;
  selectAllChangeItems: () => void;
  deselectImpactedChangeItems: () => void;
  clearChangeSetRedirect: () => void;
  clearChangeSetError: () => void;
  loadActiveChangeSet: (docId: string) => Promise<void>;
}

// Debounce timer for saving layout
let layoutSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  prdId: null,
  document: null,
  isLoading: false,
  error: null,

  nodes: [],
  edges: [],
  selectedNodeId: null,

  outlineTree: [],
  sectionNumberMap: new Map(),
  collapsedChapters: {},
  activeTab: "outline",

  isGenerating: false,
  generationProgress: { total: 0, ready: 0, failed: 0 },
  abortController: null,

  // ChangeSet and AI Revision state (TASK-016)
  activeChangeSet: null,
  changeSetHistory: [],
  changeSetProgress: { step: "idle", current: 0, total: 0 },
  selectedChangeItemIds: [],
  changeSetRedirect: null,
  isCreatingChangeSet: false,
  isApplyingChangeSet: false,
  isRevertingChangeSet: false,
  changeSetError: null,
  changeSetConflicts: null,
  changesetAbortController: null,

  isSavingLayout: false,

  loadPrd: async (id: string, reloadChangeset: boolean = true) => {
    set({ isLoading: true, error: null, prdId: id });
    try {
      const res = await fetch(`/api/prds/${id}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Gagal memuat dokumen PRD (${res.statusText})`);
      }
      const doc: PrdDocument = await res.json();
      const outlineTree = buildOutline(doc);
      const sectionNumberMap = buildSectionNumberMap(doc);
      const { nodes, edges } = docToFlow(doc);

      set({
        document: doc,
        outlineTree,
        sectionNumberMap,
        nodes,
        edges,
        isLoading: false,
      });

      // Load active or recent changesets for this PRD (TASK-016)
      if (reloadChangeset) {
        await get().loadActiveChangeSet(id).catch(() => {});
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat dokumen";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  setDocument: (doc: PrdDocument) => {
    const outlineTree = buildOutline(doc);
    const sectionNumberMap = buildSectionNumberMap(doc);
    const { nodes, edges } = docToFlow(doc);
    set({
      document: doc,
      outlineTree,
      sectionNumberMap,
      nodes,
      edges,
    });
  },

  onNodesChange: (changes: NodeChanges) => {
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      return { nodes: nextNodes };
    });
  },

  onEdgesChange: (changes: EdgeChanges) => {
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges);
      return { edges: nextEdges };
    });
  },

  onNodeDragStop: () => {
    // Debounce saving layout by 800ms to avoid unnecessary network roundtrips
    if (layoutSaveTimer) {
      clearTimeout(layoutSaveTimer);
    }
    layoutSaveTimer = setTimeout(() => {
      get().saveLayoutToServer();
    }, 800);
  },

  selectNode: (id: string | null) => {
    set((state) => {
      const updatedNodes = state.nodes.map((node) => ({
        ...node,
        selected: node.id === id,
      }));
      return {
        selectedNodeId: id,
        nodes: updatedNodes,
      };
    });
  },

  toggleChapter: (chapterId: string) => {
    set((state) => ({
      collapsedChapters: {
        ...state.collapsedChapters,
        [chapterId]: !state.collapsedChapters[chapterId],
      },
    }));
  },

  setAllChaptersCollapsed: (collapsed: boolean) => {
    set((state) => {
      const next: Record<string, boolean> = {};
      state.outlineTree.forEach((c) => {
        next[c.chapter.id] = collapsed;
      });
      return { collapsedChapters: next };
    });
  },

  setActiveTab: (tab: "outline" | "revisions") => {
    set({ activeTab: tab });
  },

  relayout: () => {
    const { document } = get();
    if (!document) return;
    const { nodes, edges } = docToFlow(document, { forceLayout: true });
    set({ nodes, edges });
    get().saveLayoutToServer();
  },

  saveLayoutToServer: async () => {
    const { prdId, nodes, document } = get();
    if (!prdId || !document) return false;

    // Collect positions for all section nodes
    const positions = nodes
      .filter((n) => n.type === "sectionNode")
      .map((n) => ({
        sectionId: n.id,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      }));

    if (positions.length === 0) return true;

    set({ isSavingLayout: true });
    try {
      const res = await fetch(`/api/prds/${prdId}/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });

      if (!res.ok) {
        console.error("Failed to persist layout:", res.statusText);
        return false;
      }

      // Update local document section positions
      const posMap = new Map(positions.map((p) => [p.sectionId, { x: p.x, y: p.y }]));
      const updatedSections = (document.sections || []).map((sec) => {
        const pos = posMap.get(sec.id);
        return pos ? { ...sec, position: pos } : sec;
      });

      set((state) => ({
        document: state.document ? { ...state.document, sections: updatedSections } : null,
      }));

      return true;
    } catch (err) {
      console.error("Error saving layout:", err);
      return false;
    } finally {
      set({ isSavingLayout: false });
    }
  },

  handleSseEvent: (event: string, data: unknown) => {
    set((state) => {
      const doc = state.document;
      if (!doc) return {};

      switch (event) {
        case "run.started": {
          const payload = data as RunStartedPayload;
          return {
            isGenerating: true,
            generationProgress: {
              total: payload.total,
              ready: 0,
              failed: 0,
            },
          };
        }

        case "plan.ready": {
          const payload = data as PlanReadyPayload;
          const updatedDoc: PrdDocument = {
            ...doc,
            title: payload.title || doc.title,
            keyDecisions: payload.keyDecisions || doc.keyDecisions,
            chapters: (payload.chapters || []).map((c) => ({
              id: c.id,
              title: c.title,
              order: c.order,
            })),
            sections: (payload.sections || []).map((s) => ({
              id: s.id,
              chapterId: s.chapterId,
              type: s.type,
              title: s.title,
              order: s.order,
              status: s.status || "pending",
              content: "",
              rev: 1,
              updatedAt: new Date(),
            })),
            edges: (payload.edges || []).map((e) => ({
              id: e.id,
              from: e.from,
              to: e.to,
            })),
            status: "generating",
          };

          const outlineTree = buildOutline(updatedDoc);
          const sectionNumberMap = buildSectionNumberMap(updatedDoc);
          // Skeleton nodes appear immediately
          const { nodes, edges } = docToFlow(updatedDoc);

          return {
            document: updatedDoc,
            outlineTree,
            sectionNumberMap,
            nodes,
            edges,
            generationProgress: {
              total: updatedDoc.sections.length,
              ready: 0,
              failed: 0,
            },
          };
        }

        case "section.started": {
          const payload = data as SectionStartedPayload;
          const updatedSections = (doc.sections || []).map((s) =>
            s.id === payload.sectionId ? { ...s, status: "writing" as const } : s
          );
          const updatedDoc = { ...doc, sections: updatedSections };
          const { nodes, edges } = docToFlow(updatedDoc);

          return {
            document: updatedDoc,
            nodes,
            edges,
            generationProgress: {
              ...state.generationProgress,
              currentSectionId: payload.sectionId,
            },
          };
        }

        case "section.completed": {
          const payload = data as SectionCompletedPayload;
          const updatedSections = (doc.sections || []).map((s) =>
            s.id === payload.sectionId
              ? {
                  ...s,
                  status: "ready" as const,
                  rev: payload.rev,
                  content: payload.content,
                  diagram: payload.diagram,
                  error: undefined,
                }
              : s
          );
          const updatedDoc = { ...doc, sections: updatedSections };
          const outlineTree = buildOutline(updatedDoc);
          const { nodes, edges } = docToFlow(updatedDoc);

          return {
            document: updatedDoc,
            outlineTree,
            nodes,
            edges,
            generationProgress: {
              ...state.generationProgress,
              ready: state.generationProgress.ready + 1,
              currentSectionId: undefined,
            },
          };
        }

        case "section.failed": {
          const payload = data as SectionFailedPayload;
          const updatedSections = (doc.sections || []).map((s) =>
            s.id === payload.sectionId
              ? {
                  ...s,
                  status: "failed" as const,
                  error: { code: payload.code, message: payload.message },
                }
              : s
          );
          const updatedDoc = { ...doc, sections: updatedSections };
          const outlineTree = buildOutline(updatedDoc);
          const { nodes, edges } = docToFlow(updatedDoc);

          return {
            document: updatedDoc,
            outlineTree,
            nodes,
            edges,
            generationProgress: {
              ...state.generationProgress,
              failed: state.generationProgress.failed + 1,
              currentSectionId: undefined,
            },
          };
        }

        case "run.completed": {
          const payload = data as RunCompletedPayload;
          return {
            isGenerating: false,
            document: {
              ...doc,
              status: "ready" as const,
            },
            generationProgress: {
              ...state.generationProgress,
              ready: payload.ready,
              failed: payload.failed,
            },
          };
        }

        case "run.failed": {
          const payload = data as RunFailedPayload;
          return {
            isGenerating: false,
            document: {
              ...doc,
              status: "failed" as const,
              lastError: {
                code: payload.code,
                message: payload.message,
                stage: "runtime",
                at: new Date(),
              },
            },
          };
        }

        default:
          return {};
      }
    });
  },

  startGeneration: async (sectionIds?: string[]) => {
    const { prdId } = get();
    if (!prdId) return;

    // Abort previous connection if active
    if (get().abortController) {
      get().abortController?.abort();
    }

    const controller = new AbortController();
    set({ isGenerating: true, abortController: controller });

    try {
      const res = await fetch(`/api/prds/${prdId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sectionIds ? { sectionIds } : {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 409) {
          console.warn("Generation already running for this PRD (HTTP 409)");
        } else {
          console.error("Failed to start generation:", res.statusText);
        }
        set({ isGenerating: false });
        return;
      }

      if (!res.body) {
        set({ isGenerating: false });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const parser = createSseStreamParser((event) => {
        get().handleSseEvent(event.event, event.data);
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        parser.feed(text);
      }
      parser.flush();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Generation connection aborted by client");
      } else {
        console.error("Error during SSE stream reading:", err);
      }
    } finally {
      set({ isGenerating: false, abortController: null });
    }
  },

  cancelGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isGenerating: false, abortController: null });
    }
  },

  addSection: async (chapterId: string, title: string, type: SectionType = "custom") => {
    const { prdId, document } = get();
    if (!prdId || !document) return false;

    try {
      const res = await fetch(`/api/prds/${prdId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, title, type }),
      });

      if (!res.ok) return false;

      const newSection: Section = await res.json();
      const updatedSections = [...(document.sections || []), newSection];
      const updatedDoc = { ...document, sections: updatedSections };

      const outlineTree = buildOutline(updatedDoc);
      const sectionNumberMap = buildSectionNumberMap(updatedDoc);
      const { nodes, edges } = docToFlow(updatedDoc);

      set({
        document: updatedDoc,
        outlineTree,
        sectionNumberMap,
        nodes,
        edges,
      });
      return true;
    } catch (err) {
      console.error("Failed to add section:", err);
      return false;
    }
  },

  deleteSection: async (sectionId: string) => {
    const { prdId, document } = get();
    if (!prdId || !document) return false;

    try {
      const res = await fetch(`/api/prds/${prdId}/sections/${sectionId}`, {
        method: "DELETE",
      });

      if (!res.ok) return false;

      const updatedSections = (document.sections || []).filter((s) => s.id !== sectionId);
      const updatedEdges = (document.edges || []).filter(
        (e) => e.from !== sectionId && e.to !== sectionId
      );
      const updatedDoc = {
        ...document,
        sections: updatedSections,
        edges: updatedEdges,
      };

      const outlineTree = buildOutline(updatedDoc);
      const sectionNumberMap = buildSectionNumberMap(updatedDoc);
      const { nodes, edges } = docToFlow(updatedDoc);

      set({
        document: updatedDoc,
        outlineTree,
        sectionNumberMap,
        nodes,
        edges,
        selectedNodeId: get().selectedNodeId === sectionId ? null : get().selectedNodeId,
      });
      return true;
    } catch (err) {
      console.error("Failed to delete section:", err);
      return false;
    }
  },

  updateSectionInStore: (sectionId: string, updates: Partial<Section>) => {
    const { document } = get();
    if (!document) return;

    const updatedSections = (document.sections || []).map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, ...updates, updatedAt: new Date() };
    });

    const updatedDoc = {
      ...document,
      sections: updatedSections,
    };

    const outlineTree = buildOutline(updatedDoc);
    const sectionNumberMap = buildSectionNumberMap(updatedDoc);
    const { nodes, edges } = docToFlow(updatedDoc);

    set({
      document: updatedDoc,
      outlineTree,
      sectionNumberMap,
      nodes,
      edges,
    });
  },

  saveSection: async (
    sectionId: string,
    baseRev: number,
    updates: {
      title?: string;
      content?: string;
      diagram?: Section["diagram"];
    }
  ) => {
    const { prdId, document } = get();
    if (!prdId || !document) {
      return { success: false, error: "PRD document not loaded" };
    }

    try {
      const res = await fetch(`/api/prds/${prdId}/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseRev, ...updates }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 409) {
        return {
          success: false,
          conflict: true,
          currentRev: data?.error?.currentRev ?? data?.currentRev,
        };
      }

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || "Gagal menyimpan perubahan",
        };
      }

      const newRev = data.rev;
      const updatedSections = (document.sections || []).map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          ...updates,
          rev: newRev ?? s.rev + 1,
          updatedAt: new Date(),
        };
      });

      const updatedDoc = {
        ...document,
        sections: updatedSections,
      };

      const outlineTree = buildOutline(updatedDoc);
      const sectionNumberMap = buildSectionNumberMap(updatedDoc);
      const { nodes, edges } = docToFlow(updatedDoc);

      set({
        document: updatedDoc,
        outlineTree,
        sectionNumberMap,
        nodes,
        edges,
      });

      return { success: true, rev: newRev };
    } catch (err: unknown) {
      console.error(`Failed to save section ${sectionId}:`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Gagal menyimpan perubahan",
      };
    }
  },

  createChangeSet: async (originSectionId: string, instruction: string) => {
    const { prdId, document } = get();
    if (!prdId || !document) return false;

    // Clear previous error, redirect, and reset progress
    set({
      isCreatingChangeSet: true,
      changeSetError: null,
      changeSetRedirect: null,
      changeSetConflicts: null,
      activeTab: "revisions",
      changeSetProgress: {
        step: "analyzing",
        current: 0,
        total: 0,
        message: "Menganalisis dampak...",
      },
    });

    const abortController = new AbortController();
    set({ changesetAbortController: abortController });

    try {
      const res = await fetch(`/api/prds/${prdId}/changesets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originSectionId, instruction }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 409) {
          // ChangeSet active already exists - reload changesets to display it
          await get().loadActiveChangeSet(prdId);
          set({
            isCreatingChangeSet: false,
            changeSetError:
              "Terdapat change set aktif yang sedang berlangsung atau menunggu persetujuan.",
          });
          return false;
        }
        throw new Error(
          errData?.error?.message || `Gagal mengajukan revisi (${res.statusText})`
        );
      }

      if (!res.body) {
        throw new Error("Respons stream tidak tersedia");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const parser = createSseStreamParser((event) => {
        const evName = event.event;
        const data = event.data as Record<string, any>;

        if (evName === "changeset.started") {
          const originSec = document.sections.find((s) => s.id === originSectionId);
          const newCs: ClientChangeSet = {
            _id: data.changesetId,
            docId: prdId,
            originSectionId,
            instruction,
            status: "generating",
            rationale: "",
            warnings: [],
            keyDecisionChanges: [],
            items: originSec
              ? [
                  {
                    sectionId: originSectionId,
                    role: "origin",
                    reason: instruction,
                    detectedBy: "origin",
                    baseRev: originSec.rev,
                    before: {
                      title: originSec.title,
                      content: originSec.content,
                      diagramCode: originSec.diagram?.code,
                    },
                    after: null,
                    status: "pending",
                  },
                ]
              : [],
          };
          set({
            activeChangeSet: newCs,
            selectedChangeItemIds: [originSectionId],
            changeSetProgress: {
              step: "analyzing",
              current: 0,
              total: 0,
              message: "Menganalisis dampak...",
            },
          });
        } else if (evName === "origin.ready") {
          set((state) => {
            if (!state.activeChangeSet) return {};
            const currentOrigin = state.activeChangeSet.items.find(
              (it) => it.sectionId === originSectionId
            );
            const updatedOrigin: ClientChangeItem = currentOrigin
              ? { ...currentOrigin, after: data.after, status: "ready" }
              : {
                  sectionId: originSectionId,
                  role: "origin",
                  reason: instruction,
                  detectedBy: "origin",
                  baseRev: 1,
                  before: { title: "", content: "" },
                  after: data.after,
                  status: "ready",
                };

            const remainingItems = state.activeChangeSet.items.filter(
              (it) => it.sectionId !== originSectionId
            );

            return {
              activeChangeSet: {
                ...state.activeChangeSet,
                rationale: data.rationale || state.activeChangeSet.rationale,
                warnings: data.warnings || state.activeChangeSet.warnings,
                keyDecisionChanges:
                  data.keyDecisionChanges || state.activeChangeSet.keyDecisionChanges,
                items: [updatedOrigin, ...remainingItems],
              },
            };
          });
        } else if (evName === "impact.ready") {
          set((state) => {
            if (!state.activeChangeSet) return {};
            const existingOrigin = state.activeChangeSet.items.find(
              (it) => it.sectionId === originSectionId
            );
            const impactList = (data.items || []) as Array<{
              sectionId: string;
              reason: string;
              detectedBy: "origin" | "ai" | "term-match";
            }>;

            const newImpactedItems: ClientChangeItem[] = impactList.map((imp) => {
              const sec = document.sections.find((s) => s.id === imp.sectionId);
              return {
                sectionId: imp.sectionId,
                role: "impacted",
                reason: imp.reason,
                detectedBy: imp.detectedBy,
                baseRev: sec?.rev || 1,
                before: {
                  title: sec?.title || "Section",
                  content: sec?.content || "",
                  diagramCode: sec?.diagram?.code,
                },
                after: null,
                status: "pending",
              };
            });

            const allSectionIds = [
              originSectionId,
              ...newImpactedItems.map((i) => i.sectionId),
            ];

            return {
              activeChangeSet: {
                ...state.activeChangeSet,
                items: existingOrigin
                  ? [existingOrigin, ...newImpactedItems]
                  : newImpactedItems,
              },
              selectedChangeItemIds: allSectionIds,
              changeSetProgress: {
                step: "propagating",
                current: 0,
                total: impactList.length,
                message:
                  impactList.length > 0
                    ? `Menyusun perubahan 0/${impactList.length}...`
                    : "Menganalisis dampak selesai",
              },
            };
          });
        } else if (evName === "item.ready") {
          set((state) => {
            if (!state.activeChangeSet) return {};
            const updatedItems = state.activeChangeSet.items.map((it) =>
              it.sectionId === data.sectionId
                ? { ...it, after: data.after, status: "ready" as const }
                : it
            );
            const readyCount = updatedItems.filter(
              (it) =>
                it.role === "impacted" &&
                (it.status === "ready" || it.status === "failed")
            ).length;
            const totalImpacted = updatedItems.filter(
              (it) => it.role === "impacted"
            ).length;

            return {
              activeChangeSet: {
                ...state.activeChangeSet,
                items: updatedItems,
              },
              changeSetProgress: {
                ...state.changeSetProgress,
                current: readyCount,
                total: totalImpacted,
                message: `Menyusun perubahan ${readyCount}/${totalImpacted}...`,
              },
            };
          });
        } else if (evName === "item.failed") {
          set((state) => {
            if (!state.activeChangeSet) return {};
            const updatedItems = state.activeChangeSet.items.map((it) =>
              it.sectionId === data.sectionId
                ? {
                    ...it,
                    status: "failed" as const,
                    error: { code: data.code, message: data.message },
                  }
                : it
            );
            const processedCount = updatedItems.filter(
              (it) =>
                it.role === "impacted" &&
                (it.status === "ready" || it.status === "failed")
            ).length;
            const totalImpacted = updatedItems.filter(
              (it) => it.role === "impacted"
            ).length;

            return {
              activeChangeSet: {
                ...state.activeChangeSet,
                items: updatedItems,
              },
              selectedChangeItemIds: state.selectedChangeItemIds.filter(
                (id) => id !== data.sectionId
              ),
              changeSetProgress: {
                ...state.changeSetProgress,
                current: processedCount,
                total: totalImpacted,
                message: `Menyusun perubahan ${processedCount}/${totalImpacted}...`,
              },
            };
          });
        } else if (evName === "changeset.redirect") {
          set({
            activeChangeSet: null,
            changeSetRedirect: {
              sectionId: data.sectionId,
              reason: data.reason,
              instruction: instruction,
            },
            changeSetProgress: {
              step: "idle",
              current: 0,
              total: 0,
              message: "",
            },
          });
        } else if (evName === "changeset.ready") {
          set((state) => {
            if (!state.activeChangeSet) return {};
            return {
              activeChangeSet: {
                ...state.activeChangeSet,
                status: "pending",
              },
              changeSetProgress: {
                step: "ready",
                current: state.activeChangeSet.items.length,
                total: state.activeChangeSet.items.length,
                message: "Perubahan siap ditinjau",
              },
            };
          });
        } else if (evName === "changeset.failed") {
          set({
            changeSetError: data.message || "Gagal menyusun perubahan",
            changeSetProgress: {
              step: "failed",
              current: 0,
              total: 0,
              message: data.message || "Gagal menyusun perubahan",
            },
          });
        }
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        parser.feed(text);
      }
      parser.flush();

      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Changeset generation connection aborted");
      } else {
        console.error("Error creating changeset:", err);
        set({
          changeSetError:
            err instanceof Error ? err.message : "Gagal mengajukan revisi",
          changeSetProgress: {
            step: "failed",
            current: 0,
            total: 0,
            message: "Terjadi kesalahan pada revisi AI",
          },
        });
      }
      return false;
    } finally {
      set({ isCreatingChangeSet: false, changesetAbortController: null });
    }
  },

  applyChangeSet: async (changeSetId: string, sectionIds?: string[]) => {
    const { prdId } = get();
    if (!prdId) return { success: false, error: "PRD document not loaded" };

    set({ isApplyingChangeSet: true, changeSetError: null, changeSetConflicts: null });
    try {
      const res = await fetch(`/api/prds/${prdId}/changesets/${changeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          sectionIds: sectionIds && sectionIds.length > 0 ? sectionIds : undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 409) {
        const conflicts = data?.conflicts || data?.error?.conflicts || [];
        set({
          changeSetConflicts: conflicts,
          changeSetError: "Konflik versi: Section telah berubah sejak revisi dibuat.",
        });
        return { success: false, conflicts };
      }

      if (!res.ok) {
        const msg = data?.error?.message || "Gagal menerapkan perubahan";
        set({ changeSetError: msg });
        return { success: false, error: msg };
      }

      // Success! Refresh PRD to update node contents and key decisions on canvas and outline
      await get().loadPrd(prdId, false);

      // Update active changeset state to 'applied'
      set((state) => ({
        activeChangeSet: state.activeChangeSet
          ? { ...state.activeChangeSet, status: "applied", resolvedAt: new Date() }
          : null,
        changeSetProgress: {
          step: "ready",
          current: 0,
          total: 0,
          message: "Perubahan telah diterapkan",
        },
      }));

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menerapkan perubahan";
      set({ changeSetError: msg });
      return { success: false, error: msg };
    } finally {
      set({ isApplyingChangeSet: false });
    }
  },

  rejectChangeSet: async (changeSetId: string) => {
    const { prdId } = get();
    if (!prdId) return false;

    try {
      const res = await fetch(`/api/prds/${prdId}/changesets/${changeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        set({ changeSetError: data?.error?.message || "Gagal menolak perubahan" });
        return false;
      }

      set((state) => ({
        activeChangeSet: state.activeChangeSet
          ? { ...state.activeChangeSet, status: "rejected", resolvedAt: new Date() }
          : null,
        changeSetProgress: { step: "idle", current: 0, total: 0 },
      }));

      return true;
    } catch (err: unknown) {
      set({
        changeSetError: err instanceof Error ? err.message : "Gagal menolak perubahan",
      });
      return false;
    }
  },

  revertChangeSet: async (changeSetId: string) => {
    const { prdId } = get();
    if (!prdId) return { success: false, error: "PRD document not loaded" };

    set({ isRevertingChangeSet: true, changeSetError: null });
    try {
      const res = await fetch(`/api/prds/${prdId}/changesets/${changeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert" }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error?.message || "Gagal mengurungkan perubahan";
        set({ changeSetError: msg });
        return { success: false, error: msg };
      }

      // Refresh PRD to revert canvas and outline contents back
      await get().loadPrd(prdId, false);

      set((state) => ({
        activeChangeSet: state.activeChangeSet
          ? { ...state.activeChangeSet, status: "reverted", resolvedAt: new Date() }
          : null,
        changeSetProgress: { step: "idle", current: 0, total: 0 },
      }));

      return {
        success: true,
        revertedSectionIds: data?.revertedSectionIds,
        skipped: data?.skipped,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengurungkan perubahan";
      set({ changeSetError: msg });
      return { success: false, error: msg };
    } finally {
      set({ isRevertingChangeSet: false });
    }
  },

  toggleChangeItemSelection: (sectionId: string) => {
    set((state) => {
      // Origin section can NEVER be unselected (FR-AI-05)
      if (state.activeChangeSet?.originSectionId === sectionId) {
        return {};
      }

      // Failed items cannot be selected
      const targetItem = state.activeChangeSet?.items.find((i) => i.sectionId === sectionId);
      if (targetItem?.status === "failed") {
        return {};
      }

      const currentSelected = state.selectedChangeItemIds;
      const isAlreadySelected = currentSelected.includes(sectionId);
      const updatedSelected = isAlreadySelected
        ? currentSelected.filter((id) => id !== sectionId)
        : [...currentSelected, sectionId];

      return { selectedChangeItemIds: updatedSelected };
    });
  },

  selectAllChangeItems: () => {
    set((state) => {
      if (!state.activeChangeSet) return {};
      const selectableIds = state.activeChangeSet.items
        .filter((i) => i.status !== "failed")
        .map((i) => i.sectionId);
      return { selectedChangeItemIds: selectableIds };
    });
  },

  deselectImpactedChangeItems: () => {
    set((state) => {
      if (!state.activeChangeSet) return {};
      // Keep only origin section selected
      return { selectedChangeItemIds: [state.activeChangeSet.originSectionId] };
    });
  },

  clearChangeSetRedirect: () => {
    set({ changeSetRedirect: null });
  },

  clearChangeSetError: () => {
    set({ changeSetError: null, changeSetConflicts: null });
  },

  loadActiveChangeSet: async (docId: string) => {
    try {
      const res = await fetch(`/api/prds/${docId}/changesets`, { cache: "no-store" });
      if (!res.ok) return;
      const rawList: any[] = await res.json();
      if (!Array.isArray(rawList) || rawList.length === 0) return;

      const list: ClientChangeSet[] = rawList.map((cs) => ({
        ...cs,
        _id:
          typeof cs._id === "object" && cs._id !== null
            ? cs._id.toString()
            : String(cs._id),
        docId:
          typeof cs.docId === "object" && cs.docId !== null
            ? cs.docId.toString()
            : String(cs.docId),
      }));

      // Find pending or generating changeset first
      const active = list.find(
        (cs) => cs.status === "pending" || cs.status === "generating"
      );
      if (active) {
        const selected = active.items
          .filter((it) => it.status === "ready" || it.role === "origin")
          .map((it) => it.sectionId);

        set({
          activeChangeSet: active,
          selectedChangeItemIds: selected,
          changeSetHistory: list,
        });
        return;
      }

      // If no pending, find the most recently applied changeset (for Urungkan)
      const lastApplied = list.find((cs) => cs.status === "applied");
      if (lastApplied) {
        set({
          activeChangeSet: lastApplied,
          selectedChangeItemIds: lastApplied.items.map((i) => i.sectionId),
          changeSetHistory: list,
        });
        return;
      }

      set({ changeSetHistory: list });
    } catch (err) {
      console.error("Failed to load active changeset:", err);
    }
  },
}));
