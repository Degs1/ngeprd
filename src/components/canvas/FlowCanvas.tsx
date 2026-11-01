"use client";

import React from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
} from "@xyflow/react";
import QuestionCardNode from "./QuestionCardNode";
import { useCanvasStore } from "@/store/useCanvasStore";

const nodeTypes: NodeTypes = {
  questionCard: QuestionCardNode,
};

export default function FlowCanvas() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.25 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b8" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "questionCard") {
              const isAnswered = (node.data as { status?: string })?.status === "answered";
              return isAnswered ? "#10b981" : "#6366f1";
            }
            return "#94a3b8";
          }}
          maskColor="rgba(241, 245, 249, 0.7)"
          className="rounded-lg shadow-sm border border-slate-200"
        />
      </ReactFlow>
    </div>
  );
}
