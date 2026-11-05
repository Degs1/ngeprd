"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { IdeaNodeData } from "@/types/canvas";

function IdeaCardNode({ data, selected }: NodeProps) {
  const ideaData = data as unknown as IdeaNodeData;
  const ideaText = ideaData?.idea || ideaData?.label || "Ide Proyek";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-[#121E19] text-[#EAF0EB] shadow-xl p-4 w-[300px] select-none transition-all duration-200",
        selected
          ? "ring-1 ring-[#8EA690] border-[#8EA690] shadow-2xl"
          : "hover:border-[#355243] border-[#22352B]"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-[#586C61] border-2 border-[#121E19] rounded-full hover:!bg-[#8EA690] transition-colors"
      />

      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1F3028]">
        <div className="text-xs font-serif font-bold text-[#EAF0EB]">
          <span>Ide Proyek</span>
        </div>
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#162720] text-[#8EA690] border border-[#243D31]">
          Root Concept
        </span>
      </div>

      <p className="text-xs text-[#8FA396] leading-relaxed break-words">
        {ideaText}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-[#8EA690] border-2 border-[#121E19] rounded-full hover:!bg-[#A0B8A2] transition-colors"
      />
    </div>
  );
}

export default memo(IdeaCardNode);
