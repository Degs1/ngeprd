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
            "inline-flex items-center gap-1 font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-200",
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1",
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
            "inline-flex items-center gap-1 font-medium rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200",
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1",
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
            "inline-flex items-center gap-1 font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200",
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1",
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
            "inline-flex items-center gap-1 font-medium rounded-full border bg-rose-50 text-rose-700 border-rose-200",
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1",
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
