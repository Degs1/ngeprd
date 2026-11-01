import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";
import type { CanvasNode } from "@/types/canvas";

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  ranksep?: number;
  nodesep?: number;
}

export const DEFAULT_NODE_WIDTH = 320;
export const DEFAULT_NODE_HEIGHT = 360;
export const DEFAULT_ROOT_WIDTH = 280;
export const DEFAULT_ROOT_HEIGHT = 160;

/**
 * Calculates auto-layout positions for nodes and edges using Dagre.
 * Adjusts node positions from Dagre's center-origin to React Flow's top-left origin.
 */
export function getLayoutedElements<T extends Node = CanvasNode>(
  nodes: T[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: T[]; edges: Edge[] } {
  const {
    direction = "LR",
    ranksep = 100,
    nodesep = 50,
  } = options;

  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep,
    nodesep,
  });

  // Register nodes with appropriate width and height
  nodes.forEach((node) => {
    let width = options.nodeWidth;
    let height = options.nodeHeight;

    if (node.measured?.width && node.measured?.height) {
      width = node.measured.width;
      height = node.measured.height;
    } else if (node.type === "questionCard") {
      const data = node.data as { options?: unknown[] } | undefined;
      const optionCount = Array.isArray(data?.options) ? data.options.length : 3;
      width = width ?? DEFAULT_NODE_WIDTH;
      height = height ?? Math.max(300, 180 + optionCount * 52);
    } else if (
      node.type === "ideaCard" ||
      node.type === "ideaNode" ||
      node.id.startsWith("idea") ||
      node.id === "start-node"
    ) {
      width = width ?? DEFAULT_ROOT_WIDTH;
      height = height ?? DEFAULT_ROOT_HEIGHT;
    } else {
      width = width ?? 240;
      height = height ?? 140;
    }

    dagreGraph.setNode(node.id, { width, height });
  });

  // Register edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run layout
  dagre.layout(dagreGraph);

  // Map positioned nodes back with top-left origin conversion
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    if (!nodeWithPosition) {
      return node;
    }

    const width = nodeWithPosition.width || DEFAULT_NODE_WIDTH;
    const height = nodeWithPosition.height || DEFAULT_NODE_HEIGHT;

    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - width / 2),
        y: Math.round(nodeWithPosition.y - height / 2),
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
}
