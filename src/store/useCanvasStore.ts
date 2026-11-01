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
} from "@/types/canvas";

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

export const useCanvasStore = create<CanvasState>((set) => ({
  nodes: initialNodes,
  edges: initialEdges,
  answersMap: {},

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: rfAddEdge({ ...connection, animated: true }, state.edges),
    }));
  },

  setNodes: (nodes) => {
    set((state) => ({
      nodes: typeof nodes === "function" ? nodes(state.nodes) : nodes,
    }));
  },

  setEdges: (edges) => {
    set((state) => ({
      edges: typeof edges === "function" ? edges(state.edges) : edges,
    }));
  },

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },

  addNodes: (newNodes) => {
    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
    }));
  },

  addEdge: (edge) => {
    set((state) => ({
      edges: rfAddEdge(edge, state.edges),
    }));
  },

  selectOption: (nodeId: string, optionId: string) => {
    set((state) => {
      let chosenAnswer = "";
      let category = "";

      const updatedNodes = state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const currentData = (node.data || {}) as QuestionNodeData;
        const option = currentData.options?.find((opt) => opt.id === optionId);
        chosenAnswer = option ? option.label : optionId;
        category = currentData.category || currentData.title || "";

        return {
          ...node,
          data: {
            ...currentData,
            selectedOptionId: optionId,
            customAnswer: "",
            status: "answered" as const,
          },
        };
      });

      return {
        nodes: updatedNodes,
        answersMap: {
          ...state.answersMap,
          [nodeId]: {
            optionId,
            answer: chosenAnswer,
            category,
          },
        },
      };
    });
  },

  setCustomAnswer: (nodeId: string, answer: string) => {
    set((state) => {
      let category = "";
      const trimmed = answer.trim();
      const isAnswered = trimmed.length > 0;

      const updatedNodes = state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const currentData = (node.data || {}) as QuestionNodeData;
        category = currentData.category || currentData.title || "";

        return {
          ...node,
          data: {
            ...currentData,
            selectedOptionId: isAnswered ? "custom" : null,
            customAnswer: answer,
            status: isAnswered ? ("answered" as const) : ("pending" as const),
          },
        };
      });

      const nextAnswersMap = { ...state.answersMap };
      if (isAnswered) {
        nextAnswersMap[nodeId] = {
          optionId: "custom",
          answer: trimmed,
          category,
        };
      } else {
        delete nextAnswersMap[nodeId];
      }

      return {
        nodes: updatedNodes,
        answersMap: nextAnswersMap,
      };
    });
  },

  updateNodeStatus: (nodeId: string, status: QuestionStatus) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...(node.data as QuestionNodeData),
                status,
              },
            }
          : node
      ),
    }));
  },

  resetCanvas: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      answersMap: {},
    });
  },
}));
