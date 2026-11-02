"use client";

import React, { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
  type Node,
} from "@xyflow/react";
import IdeaNode from "./IdeaNode";
import SectionNode from "./SectionNode";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

const nodeTypes: NodeTypes = {
  ideaNode: IdeaNode,
  sectionNode: SectionNode,
};

export default function WorkspaceCanvas() {
  const nodes = useWorkspaceStore((state) => state.nodes);
  const edges = useWorkspaceStore((state) => state.edges);
  const onNodesChange = useWorkspaceStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkspaceStore((state) => state.onEdgesChange);
  const onNodeDragStop = useWorkspaceStore((state) => state.onNodeDragStop);
  const selectNode = useWorkspaceStore((state) => state.selectNode);

  const { fitView } = useReactFlow();

  // Initial auto fit-view when nodes first load
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="w-full h-full relative bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { strokeWidth: 2, stroke: "#94a3b8" },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="#cbd5e1"
        />
        <Controls
          className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden m-2 sm:m-4"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.id === "idea") return "#0f172a";
            const status = (n.data as { status?: string })?.status;
            if (status === "ready") return "#10b981";
            if (status === "writing") return "#6366f1";
            if (status === "failed") return "#ef4444";
            return "#cbd5e1";
          }}
          className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden shadow-xs"
          maskColor="rgba(241, 245, 249, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
