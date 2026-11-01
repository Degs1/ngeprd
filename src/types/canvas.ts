import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  Connection,
} from "@xyflow/react";

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export type QuestionStatus = "pending" | "answered";

export interface IdeaNodeData extends Record<string, unknown> {
  label?: string;
  idea?: string;
  createdAt?: string;
}

export interface QuestionNodeData extends Record<string, unknown> {
  category?: string;
  title?: string;
  question: string;
  options: QuestionOption[];
  selectedOptionId?: string | null;
  customAnswer?: string;
  status: QuestionStatus;
}

export type CanvasNode = Node<QuestionNodeData | IdeaNodeData | Record<string, unknown>>;

export interface AnswerEntry {
  optionId?: string;
  answer: string;
  category?: string;
}

export interface AnswerCounts {
  answered: number;
  pending: number;
  total: number;
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: Edge[];
  answersMap: Record<string, AnswerEntry>;

  // Answer statistics
  answeredCount: number;
  pendingCount: number;
  totalCount: number;

  // React Flow event handlers
  onNodesChange: OnNodesChange<CanvasNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // Store actions
  setNodes: (nodes: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  addNode: (node: CanvasNode) => void;
  addNodes: (nodes: CanvasNode[]) => void;
  addEdge: (edge: Edge) => void;
  selectOption: (nodeId: string, optionId: string) => void;
  setCustomAnswer: (nodeId: string, answer: string) => void;
  setAnswer: (
    nodeId: string,
    selectedOption?: string | null,
    customAnswer?: string
  ) => void;
  updateNodeStatus: (nodeId: string, status: QuestionStatus) => void;
  getAnswerCounts: () => AnswerCounts;
  applyLayout: (direction?: "TB" | "LR") => void;
  resetCanvas: () => void;
}
