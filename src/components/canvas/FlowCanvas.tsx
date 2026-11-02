"use client";

import React, { useState, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import IdeaCardNode from "./IdeaCardNode";
import TopBar from "./TopBar";
import PrdDrawer from "@/components/prd/PrdDrawer";
import { useCanvasStore } from "@/store/useCanvasStore";

const nodeTypes: NodeTypes = {
  ideaCard: IdeaCardNode,
  ideaNode: IdeaCardNode,
};

function FlowCanvasContent() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const applyLayout = useCanvasStore((state) => state.applyLayout);
  const resetCanvas = useCanvasStore((state) => state.resetCanvas);
  const setPrdDrawerOpen = useCanvasStore((state) => state.setPrdDrawerOpen);
  const generatePrd = useCanvasStore((state) => state.generatePrd);

  const { fitView } = useReactFlow();

  // Open modal by default when canvas is first opened
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLayout = useCallback(() => {
    applyLayout("LR");
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 50);
  }, [applyLayout, fitView]);

  const handleModalSuccess = useCallback(() => {
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 100);
  }, [fitView]);

  const handleReset = useCallback(() => {
    if (confirm("Reset seluruh kanvas dan mulai dari awal?")) {
      resetCanvas();
      setTimeout(() => {
        fitView({ padding: 0.25, duration: 400 });
      }, 50);
    }
  }, [resetCanvas, fitView]);

  const handleExportPrd = useCallback(() => {
    setPrdDrawerOpen(true);
    if (!useCanvasStore.getState().prdMarkdown) {
      generatePrd();
    }
  }, [setPrdDrawerOpen, generatePrd]);

  return (
    <div className="w-full h-full relative">
      {/* Top Floating Control Bar */}
      <TopBar
        onOpenIdeaModal={() => setIsModalOpen(true)}
        onExportPrd={handleExportPrd}
        onLayout={handleLayout}
        onReset={handleReset}
      />

      {/* Main Graph Viewport */}
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
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#94a3b8"
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "questionCard") {
              const isAnswered =
                (node.data as { status?: string })?.status === "answered";
              return isAnswered ? "#10b981" : "#6366f1";
            }
            if (node.type === "ideaCard" || node.type === "ideaNode") {
              return "#0f172a";
            }
            return "#94a3b8";
          }}
          maskColor="rgba(241, 245, 249, 0.7)"
          className="rounded-lg shadow-sm border border-slate-200"
        />
      </ReactFlow>


      {/* PRD Preview & Export Drawer */}
      <PrdDrawer />
    </div>
  );
}

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasContent />
    </ReactFlowProvider>
  );
}
