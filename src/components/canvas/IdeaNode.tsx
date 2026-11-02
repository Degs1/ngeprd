"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Sparkles, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IdeaNodeData {
  id: string;
  title?: string;
  idea: string;
}

function IdeaNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as IdeaNodeData;
  const title = nodeData?.title || "Ide Proyek";
  const idea = nodeData?.idea || "";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-slate-900 text-white shadow-lg p-5 w-[320px] select-none transition-all duration-200",
        selected
          ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-50 border-indigo-500 shadow-xl"
          : "hover:shadow-xl border-slate-700/80"
      )}
    >
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-amber-300">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="truncate max-w-[170px]">{title}</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
          Root Ide
        </span>
      </div>

      <div className="flex items-start gap-2.5 mt-1">
        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-200 leading-relaxed break-words font-medium line-clamp-4">
          {idea || "Rancang spesifikasi produk dengan agen AI otonom."}
        </p>
      </div>

      {/* Outgoing Handle to Sections with in-degree 0 */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 !bg-indigo-500 border-2 border-white rounded-full hover:!bg-indigo-400 transition-colors shadow-xs"
      />
    </div>
  );
}

export default memo(IdeaNode);
