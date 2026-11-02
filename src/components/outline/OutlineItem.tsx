"use client";

import React, { forwardRef } from "react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { OutlineSectionItem } from "@/lib/converter/outline";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

export interface OutlineItemProps {
  item: OutlineSectionItem;
  isSelected: boolean;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export const OutlineItem = forwardRef<HTMLButtonElement, OutlineItemProps>(
  ({ item, isSelected, onClick, onKeyDown }, ref) => {
    const { section, number } = item;
    const status = section.status;

    const activeChangeSet = useWorkspaceStore((state) => state.activeChangeSet);
    const isRevisionActive =
      activeChangeSet &&
      (activeChangeSet.status === "pending" || activeChangeSet.status === "generating");
    const isOrigin =
      Boolean(isRevisionActive && activeChangeSet.originSectionId === section.id);
    const isImpacted =
      Boolean(
        isRevisionActive &&
          !isOrigin &&
          activeChangeSet.items.some((i) => i.sectionId === section.id)
      );

    // Type label mapping for readability
    const typeLabelMap: Record<string, string> = {
      overview: "Ringkasan",
      problem: "Masalah",
      goals: "Tujuan",
      users: "Pengguna",
      features: "Fitur",
      flow: "Alur",
      architecture: "Arsitektur",
      data_model: "Data Model",
      tech_stack: "Tech Stack",
      api: "API",
      security: "Keamanan",
      nfr: "NFR",
      risks: "Risiko",
      roadmap: "Roadmap",
      custom: "Kustom",
    };

    const typeBadge = typeLabelMap[section.type] || section.type;

    return (
      <button
        ref={ref}
        type="button"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all outline-none border",
          isSelected
            ? "bg-indigo-50/90 border-indigo-300 text-indigo-950 font-medium shadow-xs ring-1 ring-indigo-200"
            : "border-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 focus-visible:bg-slate-100"
        )}
      >
        {/* Status Indicator Icon */}
        <div className="shrink-0">
          {status === "writing" && (
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
          )}
          {status === "ready" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          )}
          {status === "failed" && (
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          )}
          {status === "pending" && (
            <Clock className="w-3.5 h-3.5 text-slate-300" />
          )}
        </div>

        {/* Dynamic Number Badge */}
        <span
          className={cn(
            "font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md shrink-0",
            isSelected
              ? "bg-indigo-200/70 text-indigo-800"
              : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
          )}
        >
          {number}
        </span>

        {/* Section Title */}
        <span className="truncate flex-1 font-medium">{section.title}</span>

        {/* Revision Indicator Badge (TASK-016, Section 8.2) */}
        {isOrigin && (
          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Origin</span>
          </span>
        )}
        {isImpacted && (
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-md shrink-0">
            ⟳ Revisi
          </span>
        )}

        {/* Type badge */}
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 font-medium",
            isSelected
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-100/80 text-slate-400"
          )}
        >
          {typeBadge}
        </span>
      </button>
    );
  }
);

OutlineItem.displayName = "OutlineItem";
