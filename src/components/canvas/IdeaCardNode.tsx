"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IdeaNodeData } from "@/types/canvas";

function IdeaCardNode({ data, selected }: NodeProps) {
  const ideaData = data as unknown as IdeaNodeData;
  const ideaText = ideaData?.idea || ideaData?.label || "Ide Proyek";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-slate-900 text-white shadow-md p-4 w-[280px] select-none transition-all duration-200",
        selected
          ? "ring-2 ring-indigo-400 shadow-xl border-indigo-500"
          : "hover:shadow-lg border-slate-700"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-slate-500 border-2 border-slate-900 rounded-full hover:!bg-indigo-400 transition-colors"
      />

      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Ide Proyek</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
          Root Concept
        </span>
      </div>

      <p className="text-sm font-medium text-slate-100 leading-snug break-words">
        {ideaText}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-indigo-500 border-2 border-slate-900 rounded-full hover:!bg-indigo-400 transition-colors"
      />
    </div>
  );
}

export default memo(IdeaCardNode);
