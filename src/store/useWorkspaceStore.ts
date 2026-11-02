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

  // Layout persistence
  isSavingLayout: boolean;

  // Actions
  loadPrd: (id: string) => Promise<boolean>;
  setDocument: (doc: PrdDocument) => void;
  onNodesChange: (changes: NodeChanges) => void;
  onEdgesChange: (changes: EdgeChanges) => void;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => void;
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

  isSavingLayout: false,

  loadPrd: async (id: string) => {
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
}));
