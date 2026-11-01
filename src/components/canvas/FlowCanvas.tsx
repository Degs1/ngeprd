"use client";

import React, { useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";

const initialNodes: Node[] = [
  {
    id: "start-node",
    type: "default",
    position: { x: 300, y: 250 },
    data: {
      label: (
        <div className="p-2 text-center select-none">
          <div className="font-semibold text-sm text-slate-800">
            Start Planning
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Ide Proyek: Rancang alur idemu di sini
          </div>
        </div>
      ),
    },
    style: {
      background: "#ffffff",
      border: "1px solid #cbd5e1",
      borderRadius: "12px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      padding: "8px 12px",
      minWidth: "220px",
    },
  },
];

const initialEdges: Edge[] = [];

export default function FlowCanvas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b8" />
        <Controls />
        <MiniMap
          nodeColor="#94a3b8"
          maskColor="rgba(241, 245, 249, 0.7)"
          className="rounded-lg shadow-sm border border-slate-200"
        />
      </ReactFlow>
    </div>
  );
}
