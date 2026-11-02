import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import type { PrdDocument, Section } from "@/lib/schemas/prd";
import { buildSectionNumberMap } from "./outline";

export const SECTION_NODE_WIDTH = 380;
export const IDEA_NODE_WIDTH = 320;
export const IDEA_NODE_HEIGHT = 180;

export interface DocToFlowOptions {
  forceLayout?: boolean;
  nodeWidth?: number;
  ranksep?: number;
  nodesep?: number;
}

export interface FlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Estimates the height of a section node before it is mounted and measured by DOM.
 */
export function estimateSectionHeight(section: Section): number {
  let height = 180; // Base card header, status badge, metadata, actions

  if (section.content && section.content.trim().length > 0) {
    // Estimate based on characters (roughly 45 chars per line in 380px card, 18px line height)
    const lineCount = Math.ceil(section.content.length / 45);
    height += Math.min(280, Math.max(40, lineCount * 18));
  }

  if (section.diagram?.code) {
    height += 180; // Space for diagram preview or snippet
  }

  return Math.min(650, height);
}

/**
 * Removes cycles and orphaned edges, ensuring the resulting edges form a DAG.
 */
export function sanitizeAndDeduplicateEdges(
  rawEdges: Array<{ id: string; from: string; to: string }>,
  validSectionIds: Set<string>
): Array<{ id: string; from: string; to: string }> {
  // 1. Filter out orphaned edges and self-loops
  const validEdges = rawEdges.filter((edge) => {
    if (!edge.id || !edge.from || !edge.to) return false;
    if (edge.from === edge.to) {
      console.warn(`[docToFlow] Dropping self-loop edge: ${edge.id} (${edge.from})`);
      return false;
    }
    const fromValid = validSectionIds.has(edge.from);
    const toValid = validSectionIds.has(edge.to);
    if (!fromValid || !toValid) {
      console.warn(
        `[docToFlow] Dropping orphan edge: ${edge.id} (${edge.from} -> ${edge.to})`
      );
      return false;
    }
    return true;
  });

  // 2. Break cycles using DFS graph coloring (White = 0, Gray = 1, Black = 2)
  const adj = new Map<string, Array<{ id: string; to: string }>>();
  validSectionIds.forEach((id) => {
    adj.set(id, []);
  });

  // Deduplicate identical edges
  const seenPairs = new Set<string>();
  const candidates: Array<{ id: string; from: string; to: string }> = [];

  for (const edge of validEdges) {
    const pairKey = `${edge.from}->${edge.to}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    candidates.push(edge);
    adj.get(edge.from)?.push({ id: edge.id, to: edge.to });
  }

  const state = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
  validSectionIds.forEach((id) => {
    state.set(id, 0);
  });

  const cycleEdgeIds = new Set<string>();

  function dfs(u: string) {
    state.set(u, 1); // Mark as visiting (in current recursion stack)

    const neighbors = adj.get(u) || [];
    for (const { id: edgeId, to: v } of neighbors) {
      const vState = state.get(v) ?? 0;
      if (vState === 1) {
        // Back-edge found! Closing a cycle. Discard it.
        console.warn(
          `[docToFlow] Dropping cycle-closing edge: ${edgeId} (${u} -> ${v})`
        );
        cycleEdgeIds.add(edgeId);
      } else if (vState === 0) {
        dfs(v);
      }
    }

    state.set(u, 2); // Mark as completely visited
  }

  validSectionIds.forEach((id) => {
    if (state.get(id) === 0) {
      dfs(id);
    }
  });

  return candidates.filter((edge) => !cycleEdgeIds.has(edge.id));
}

/**
 * Pure function converting a MongoDB PRD document into React Flow nodes and edges
 * (PRD.md Section 6.4, Section 7.9).
 *
 * - Virtual "idea" node connects to all sections with in-degree 0.
 * - Dynamic section numbers from buildOutline are attached to node data.
 * - Orphaned edges and cycles are pruned.
 * - Positions are computed via Dagre (LR) if not already positioned or if forceLayout is set.
 */
export function docToFlow(
  doc?: Partial<Pick<PrdDocument, "title" | "idea" | "chapters" | "sections" | "edges">> | null,
  options: DocToFlowOptions = {}
): FlowGraph {
  if (!doc) {
    return { nodes: [], edges: [] };
  }

  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const rawEdges = Array.isArray(doc.edges) ? doc.edges : [];
  const validSectionIds = new Set(sections.map((s) => s.id));
  const sectionNumberMap = buildSectionNumberMap(doc);

  // 1. Sanitize edges and break cycles
  const sanitizedEdges = sanitizeAndDeduplicateEdges(rawEdges, validSectionIds);

  // 2. Identify sections with in-degree 0 (no incoming edges from other sections)
  const hasIncoming = new Set<string>();
  for (const edge of sanitizedEdges) {
    hasIncoming.add(edge.to);
  }

  // 3. Build section nodes
  const sectionNodes: Node[] = sections.map((sec) => {
    const secNumber = sectionNumberMap.get(sec.id) || "1.1";
    return {
      id: sec.id,
      type: "sectionNode",
      position: sec.position ? { ...sec.position } : { x: 0, y: 0 },
      data: {
        id: sec.id,
        sectionId: sec.id,
        number: secNumber,
        chapterId: sec.chapterId,
        title: sec.title,
        type: sec.type,
        status: sec.status,
        brief: sec.brief,
        content: sec.content,
        diagram: sec.diagram,
        rev: sec.rev,
        error: sec.error,
      },
    };
  });

  // 4. Build virtual idea node
  const ideaNode: Node = {
    id: "idea",
    type: "ideaNode",
    position: { x: 50, y: 150 },
    data: {
      id: "idea",
      title: doc.title || "Ide Proyek",
      idea: doc.idea || "",
    },
  };

  // 5. Build React Flow edges
  const flowEdges: Edge[] = [];

  // Edges from idea to root sections (in-degree 0)
  for (const sec of sections) {
    if (!hasIncoming.has(sec.id)) {
      const isWriting = sec.status === "writing";
      flowEdges.push({
        id: `e-idea-${sec.id}`,
        source: "idea",
        target: sec.id,
        type: "smoothstep",
        animated: isWriting,
        style: {
          stroke: isWriting ? "#6366f1" : "#94a3b8",
          strokeWidth: 2,
        },
      });
    }
  }

  // Edges between sections
  const sectionStatusMap = new Map(sections.map((s) => [s.id, s.status]));
  for (const edge of sanitizedEdges) {
    const targetStatus = sectionStatusMap.get(edge.to);
    const isWriting = targetStatus === "writing";
    const isFailed = targetStatus === "failed";

    flowEdges.push({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "smoothstep",
      animated: isWriting,
      style: {
        stroke: isWriting ? "#6366f1" : isFailed ? "#f43f5e" : "#94a3b8",
        strokeWidth: 2,
      },
    });
  }

  const allNodes = [ideaNode, ...sectionNodes];

  // 6. Dagre Auto-Layout
  // Check if we need to run Dagre layout:
  // - If forceLayout is requested
  // - Or if any section lacks a stored position
  const needsLayout =
    options.forceLayout ||
    sections.some(
      (s) => s.position === undefined || s.position === null || (s.position.x === 0 && s.position.y === 0)
    );

  if (needsLayout && allNodes.length > 0) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const ranksep = options.ranksep ?? 100;
    const nodesep = options.nodesep ?? 50;

    dagreGraph.setGraph({
      rankdir: "LR",
      ranksep,
      nodesep,
    });

    // Add nodes to Dagre graph
    for (const node of allNodes) {
      if (node.id === "idea") {
        dagreGraph.setNode(node.id, {
          width: IDEA_NODE_WIDTH,
          height: IDEA_NODE_HEIGHT,
        });
      } else {
        const sec = sections.find((s) => s.id === node.id);
        const width = options.nodeWidth ?? SECTION_NODE_WIDTH;
        const height = sec ? estimateSectionHeight(sec) : 220;
        dagreGraph.setNode(node.id, { width, height });
      }
    }

    // Add edges to Dagre graph
    for (const edge of flowEdges) {
      dagreGraph.setEdge(edge.source, edge.target);
    }

    dagre.layout(dagreGraph);

    // Reposition nodes using top-left coordinates
    const positionedNodes = allNodes.map((node) => {
      const dNode = dagreGraph.node(node.id);
      if (!dNode) return node;

      const width =
        node.id === "idea" ? IDEA_NODE_WIDTH : options.nodeWidth ?? SECTION_NODE_WIDTH;
      const sec = sections.find((s) => s.id === node.id);
      const height =
        node.id === "idea" ? IDEA_NODE_HEIGHT : sec ? estimateSectionHeight(sec) : 220;

      return {
        ...node,
        position: {
          x: Math.round(dNode.x - width / 2),
          y: Math.round(dNode.y - height / 2),
        },
      };
    });

    return {
      nodes: positionedNodes,
      edges: flowEdges,
    };
  }

  // If positions are preserved, place idea node intelligently if needed
  if (!needsLayout && sections.length > 0) {
    const minX = Math.min(...sections.map((s) => s.position?.x ?? 0));
    const minY = Math.min(...sections.map((s) => s.position?.y ?? 0));
    ideaNode.position = {
      x: minX - (IDEA_NODE_WIDTH + (options.ranksep ?? 100)),
      y: minY,
    };
  }

  return {
    nodes: allNodes,
    edges: flowEdges,
  };
}
