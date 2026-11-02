import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
  type Edge,
} from "@xyflow/react";
import type {
  CanvasNode,
  CanvasState,
  QuestionNodeData,
  QuestionStatus,
  AnswerCounts,
} from "@/types/canvas";
import { getLayoutedElements } from "@/lib/layout/dagre";
import { generateFallbackPrd } from "@/lib/ai/fallbackPrd";

export const initialNodes: CanvasNode[] = [
  {
    id: "start-node",
    type: "default",
    position: { x: 100, y: 220 },
    data: {
      label: "Start Planning\nIde Proyek: Rancang alur idemu di sini",
    },
    style: {
      background: "#ffffff",
      border: "1px solid #cbd5e1",
      borderRadius: "12px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      padding: "12px 16px",
      minWidth: "220px",
      fontWeight: 500,
      color: "#1e293b",
    },
  },
  {
    id: "question-1",
    type: "questionCard",
    position: { x: 420, y: 150 },
    data: {
      category: "Tech Stack",
      title: "Pilihan Arsitektur",
      question: "Apa fondasi tech stack utama yang ingin kamu gunakan?",
      status: "pending",
      selectedOptionId: null,
      customAnswer: "",
      options: [
        {
          id: "opt-nextjs",
          label: "Next.js 14 + Tailwind CSS",
          description: "Fullstack React App Router dengan SSR",
        },
        {
          id: "opt-vite-express",
          label: "React (Vite) + Express API",
          description: "Single Page App dengan REST backend terpisah",
        },
        {
          id: "opt-mobile",
          label: "React Native / Expo",
          description: "Aplikasi mobile lintas platform iOS & Android",
        },
      ],
    },
  },
];

export const initialEdges: Edge[] = [
  {
    id: "e-start-q1",
    source: "start-node",
    target: "question-1",
    animated: true,
    style: { stroke: "#6366f1", strokeWidth: 2 },
  },
];

/**
 * Computes answered vs pending counts from the canvas nodes.
 */
export function computeCounts(nodes: CanvasNode[]): AnswerCounts {
  const questionNodes = nodes.filter(
    (n) =>
      n.type === "questionCard" ||
      (n.data && (n.data as QuestionNodeData).question !== undefined)
  );
  const total = questionNodes.length;
  const answered = questionNodes.filter(
    (n) => (n.data as QuestionNodeData)?.status === "answered"
  ).length;
  const pending = total - answered;
  return { answered, pending, total };
}

/**
 * Synchronizes edge styles and highlights according to completed / answered status.
 * Incoming edges to an answered question node turn emerald green.
 */
export function syncEdgesWithNodeStatus(
  edges: Edge[],
  nodes: CanvasNode[]
): Edge[] {
  const answeredNodeIds = new Set(
    nodes
      .filter((n) => (n.data as QuestionNodeData)?.status === "answered")
      .map((n) => n.id)
  );

  return edges.map((edge) => {
    const isCompleted = answeredNodeIds.has(edge.target);
    return {
      ...edge,
      animated: !isCompleted,
      style: {
        ...edge.style,
        stroke: isCompleted ? "#10b981" : "#6366f1",
        strokeWidth: isCompleted ? 2.5 : 2,
      },
      data: {
        ...edge.data,
        completed: isCompleted,
      },
    };
  });
}

const initialCounts = computeCounts(initialNodes);
const initialPrdMarkdown = generateFallbackPrd("Rancang alur idemu di sini");

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: syncEdgesWithNodeStatus(initialEdges, initialNodes),
  answersMap: {},
  answeredCount: initialCounts.answered,
  pendingCount: initialCounts.pending,
  totalCount: initialCounts.total,

  // PRD State
  currentIdea: undefined,
  prdMarkdown: initialPrdMarkdown,
  isPrdDrawerOpen: false,
  isGeneratingPrd: false,
  prdError: null,

  onNodesChange: (changes) => {
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      const counts = computeCounts(nextNodes);
      return {
        nodes: nextNodes,
        answeredCount: counts.answered,
        pendingCount: counts.pending,
        totalCount: counts.total,
      };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    set((state) => {
      const nextEdges = rfAddEdge({ ...connection, animated: true }, state.edges);
      return {
        edges: syncEdgesWithNodeStatus(nextEdges, state.nodes),
      };
    });
  },

  setNodes: (nodes) => {
    set((state) => {
      const nextNodes = typeof nodes === "function" ? nodes(state.nodes) : nodes;
      const { answered, pending, total } = computeCounts(nextNodes);
      const updatedEdges = syncEdgesWithNodeStatus(state.edges, nextNodes);
      return {
        nodes: nextNodes,
        edges: updatedEdges,
        answeredCount: answered,
        pendingCount: pending,
        totalCount: total,
      };
    });
  },

  setEdges: (edges) => {
    set((state) => {
      const nextEdges = typeof edges === "function" ? edges(state.edges) : edges;
      return {
        edges: syncEdgesWithNodeStatus(nextEdges, state.nodes),
      };
    });
  },

  addNode: (node) => {
    set((state) => {
      const nextNodes = [...state.nodes, node];
      const { answered, pending, total } = computeCounts(nextNodes);
      const updatedEdges = syncEdgesWithNodeStatus(state.edges, nextNodes);
      return {
        nodes: nextNodes,
        edges: updatedEdges,
        answeredCount: answered,
        pendingCount: pending,
        totalCount: total,
      };
    });
  },

  addNodes: (newNodes) => {
    set((state) => {
      const nextNodes = [...state.nodes, ...newNodes];
      const { answered, pending, total } = computeCounts(nextNodes);
      const updatedEdges = syncEdgesWithNodeStatus(state.edges, nextNodes);
      return {
        nodes: nextNodes,
        edges: updatedEdges,
        answeredCount: answered,
        pendingCount: pending,
        totalCount: total,
      };
    });
  },

  addEdge: (edge) => {
    set((state) => {
      const nextEdges = rfAddEdge(edge, state.edges);
      return {
        edges: syncEdgesWithNodeStatus(nextEdges, state.nodes),
      };
    });
  },

  setAnswer: (nodeId, selectedOption, customAnswer) => {
    set((state) => {
      let chosenAnswer = "";
      let category = "";
      let isAnswered = false;
      let selectedOptionId: string | null = null;
      let customAnswerValue = "";

      // Determine whether this is a custom answer or predefined option selection
      const isCustom =
        (selectedOption === "custom" || !selectedOption) &&
        customAnswer !== undefined &&
        customAnswer !== null;

      if (isCustom) {
        const trimmed = customAnswer.trim();
        if (trimmed.length > 0) {
          isAnswered = true;
          selectedOptionId = "custom";
          customAnswerValue = customAnswer;
          chosenAnswer = trimmed;
        } else {
          isAnswered = false;
          selectedOptionId = null;
          customAnswerValue = "";
          chosenAnswer = "";
        }
      } else if (selectedOption) {
        isAnswered = true;
        selectedOptionId = selectedOption;
        customAnswerValue = "";
      } else {
        isAnswered = false;
        selectedOptionId = null;
        customAnswerValue = "";
      }

      const updatedNodes = state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const currentData = (node.data || {}) as QuestionNodeData;
        category = currentData.category || currentData.title || "";

        if (selectedOption && !isCustom) {
          const option = currentData.options?.find(
            (opt) => opt.id === selectedOption || opt.label === selectedOption
          );
          chosenAnswer = option ? option.label : selectedOption;
        }

        return {
          ...node,
          data: {
            ...currentData,
            selectedOptionId,
            customAnswer: customAnswerValue,
            status: (isAnswered ? "answered" : "pending") as QuestionStatus,
          },
        };
      });

      const nextAnswersMap = { ...state.answersMap };
      if (isAnswered) {
        nextAnswersMap[nodeId] = {
          optionId: selectedOptionId || undefined,
          answer: chosenAnswer,
          category,
        };
      } else {
        delete nextAnswersMap[nodeId];
      }

      const updatedEdges = syncEdgesWithNodeStatus(state.edges, updatedNodes);
      const { answered, pending, total } = computeCounts(updatedNodes);

      return {
        nodes: updatedNodes,
        edges: updatedEdges,
        answersMap: nextAnswersMap,
        answeredCount: answered,
        pendingCount: pending,
        totalCount: total,
      };
    });
  },

  selectOption: (nodeId: string, optionId: string) => {
    get().setAnswer(nodeId, optionId, undefined);
  },

  setCustomAnswer: (nodeId: string, answer: string) => {
    get().setAnswer(nodeId, "custom", answer);
  },

  updateNodeStatus: (nodeId: string, status: QuestionStatus) => {
    set((state) => {
      const updatedNodes = state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...(node.data as QuestionNodeData),
                status,
              },
            }
          : node
      );
      const { answered, pending, total } = computeCounts(updatedNodes);
      const updatedEdges = syncEdgesWithNodeStatus(state.edges, updatedNodes);
      return {
        nodes: updatedNodes,
        edges: updatedEdges,
        answeredCount: answered,
        pendingCount: pending,
        totalCount: total,
      };
    });
  },

  getAnswerCounts: () => {
    return computeCounts(get().nodes);
  },

  applyLayout: (direction = "LR") => {
    set((state) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        state.nodes,
        state.edges,
        { direction }
      );
      const updatedEdges = syncEdgesWithNodeStatus(layoutedEdges, layoutedNodes);
      return {
        nodes: layoutedNodes,
        edges: updatedEdges,
      };
    });
  },

  resetCanvas: () => {
    const counts = computeCounts(initialNodes);
    set({
      nodes: initialNodes,
      edges: syncEdgesWithNodeStatus(initialEdges, initialNodes),
      answersMap: {},
      answeredCount: counts.answered,
      pendingCount: counts.pending,
      totalCount: counts.total,
      currentIdea: undefined,
      prdMarkdown: initialPrdMarkdown,
      isPrdDrawerOpen: false,
      isGeneratingPrd: false,
      prdError: null,
    });
  },

  // PRD State Actions
  setCurrentIdea: (idea: string) => {
    set({ currentIdea: idea });
  },

  getActiveIdea: () => {
    const state = get();
    if (state.currentIdea && state.currentIdea.trim()) {
      return state.currentIdea.trim();
    }

    const ideaNode = state.nodes.find(
      (n) => n.type === "ideaCard" || n.type === "ideaNode"
    );
    if (ideaNode && ideaNode.data) {
      const dataObj = ideaNode.data as Record<string, unknown>;
      const ideaText = (dataObj.idea || dataObj.label) as string | undefined;
      if (ideaText && ideaText.trim()) return ideaText.trim();
    }

    const startNode = state.nodes.find((n) => n.id === "start-node");
    if (startNode && startNode.data) {
      const dataObj = startNode.data as Record<string, unknown>;
      const text = (dataObj.idea || dataObj.label) as string | undefined;
      if (text && text.trim()) {
        const lines = text.split("\n");
        const matched = lines.find((l) => l.toLowerCase().includes("ide"));
        if (matched) {
          const cleaned = matched.replace(/ide\s*(proyek)?\s*:\s*/i, "").trim();
          if (cleaned) return cleaned;
        }
        return text.trim();
      }
    }

    return "Aplikasi Web ngePRD";
  },

  setPrdDrawerOpen: (open: boolean) => {
    set({ isPrdDrawerOpen: open });
  },

  setPrdMarkdown: (markdown: string | null) => {
    set({ prdMarkdown: markdown });
  },

  generatePrd: async () => {
    const state = get();
    const idea = state.getActiveIdea();
    set({ isGeneratingPrd: true, prdError: null });

    try {
      const response = await fetch("/api/plan/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea,
          answersMap: state.answersMap,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Gagal menyusun PRD (Status ${response.status})`;
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const markdown = (data.markdown || data.prd || "") as string;
      set({
        prdMarkdown: markdown,
        isGeneratingPrd: false,
        prdError: null,
      });
      return markdown;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyusun PRD.";
      set({
        prdError: message,
        isGeneratingPrd: false,
      });
      return null;
    }
  },
}));
