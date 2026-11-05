"use client";

import React from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { PrdStatus } from "@/store/usePrdStore";
import { cn } from "@/lib/utils";

interface StatusChipProps {
  status: PrdStatus;
  size?: "sm" | "md";
  className?: string;
}

export default function StatusChip({ status, size = "sm", className }: StatusChipProps) {
  switch (status) {
    case "brainstorming":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono font-medium rounded-full border bg-[#262215] text-[#D4B36A] border-[#3D3520]",
            size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
            className
          )}
        >
          <Sparkles className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
          <span>Brainstorm</span>
        </span>
      );

    case "generating":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono font-medium rounded-full border bg-[#18262F] text-[#8CB4D9] border-[#243B4D]",
            size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
            className
          )}
        >
          <Loader2 className={cn("animate-spin", size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5")} />
          <span>Generating</span>
        </span>
      );

    case "ready":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono font-medium rounded-full border bg-[#152720] text-[#8EA690] border-[#243D31]",
            size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
            className
          )}
        >
          <CheckCircle2 className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
          <span>Ready</span>
        </span>
      );

    case "failed":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono font-medium rounded-full border bg-[#281816] text-[#D48B80] border-[#442420]",
            size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
            className
          )}
        >
          <AlertCircle className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
          <span>Failed</span>
        </span>
      );

    default:
      return null;
  }
}
