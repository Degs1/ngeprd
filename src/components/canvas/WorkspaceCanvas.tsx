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
    <div className="w-full h-full relative bg-[#0C1310]">
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
          style: { strokeWidth: 1.5, stroke: "#284234" },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1C2D24"
        />
        <Controls
          className="bg-[#121E19] border border-[#22352B] shadow-xl rounded-xl overflow-hidden m-2 sm:m-4 text-[#EAF0EB]"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.id === "idea") return "#8EA690";
            const status = (n.data as { status?: string })?.status;
            if (status === "ready") return "#3D5947";
            if (status === "writing") return "#35516B";
            if (status === "failed") return "#753A35";
            return "#1C2E24";
          }}
          className="hidden sm:block border border-[#22352B] rounded-xl overflow-hidden shadow-xs bg-[#101A16]"
          maskColor="rgba(12, 19, 16, 0.75)"
        />
      </ReactFlow>
    </div>
  );
}
