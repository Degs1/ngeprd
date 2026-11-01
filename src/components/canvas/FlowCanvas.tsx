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
import QuestionCardNode from "./QuestionCardNode";
import IdeaCardNode from "./IdeaCardNode";
import IdeaInputModal from "./IdeaInputModal";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Sparkles, LayoutGrid, RotateCcw } from "lucide-react";

const nodeTypes: NodeTypes = {
  questionCard: QuestionCardNode,
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

  const { fitView } = useReactFlow();

  // Open modal by default when canvas is first opened
  const [isModalOpen, setIsModalOpen] = useState(true);

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

  return (
    <div className="w-full h-full relative">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        {/* Brand Header */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 bg-white/90 backdrop-blur-md rounded-xl shadow-xs border border-slate-200">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
            P
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800 leading-tight">
              ngePRD
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Visual Discovery Canvas
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            title="Tata letak otomatis dengan Dagre"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
            <span>Auto Layout</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 hover:bg-white text-slate-600 hover:text-rose-600 text-xs font-medium rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            title="Reset Kanvas"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            title="Buka dialog input ide baru"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>+ Ide Baru</span>
          </button>
        </div>
      </div>

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

      {/* Idea Submission Modal */}
      <IdeaInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
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
