"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Lightbulb } from "lucide-react";
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
        "relative rounded-2xl border bg-[#121E19] text-[#EAF0EB] shadow-xl p-5 w-[340px] select-none transition-all duration-200",
        selected
          ? "ring-1 ring-[#8EA690] border-[#8EA690] shadow-2xl"
          : "hover:border-[#355243] border-[#22352B]"
      )}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1F3028]">
        <div className="flex items-center gap-2 text-xs font-serif font-bold text-[#EAF0EB]">
          <span className="truncate max-w-[200px]">{title}</span>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#162720] text-[#8EA690] border border-[#243D31]">
          Root Ide
        </span>
      </div>

      <div className="flex items-start gap-2.5 mt-1">
        <Lightbulb className="w-4 h-4 text-[#8EA690] shrink-0 mt-0.5" />
        <p className="text-xs text-[#8FA396] leading-relaxed break-words font-normal line-clamp-4">
          {idea || "Rancang spesifikasi produk dengan agen AI otonom."}
        </p>
      </div>

      {/* Outgoing Handle to Sections with in-degree 0 */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 !bg-[#8EA690] border-2 border-[#121E19] rounded-full hover:!bg-[#A0B8A2] transition-colors shadow-xs"
      />
    </div>
  );
}

export default memo(IdeaNode);
