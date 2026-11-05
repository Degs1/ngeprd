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
            ? "bg-[#162620] border-[#243C30] text-[#EAF0EB] font-medium shadow-xs"
            : "border-transparent text-[#8FA396] hover:bg-[#13211B] hover:text-[#EAF0EB]"
        )}
      >
        {/* Status Indicator Icon */}
        <div className="shrink-0">
          {status === "writing" && (
            <Loader2 className="w-3.5 h-3.5 text-[#8CB4D9] animate-spin" />
          )}
          {status === "ready" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#8EA690]" />
          )}
          {status === "failed" && (
            <AlertCircle className="w-3.5 h-3.5 text-[#D48B80]" />
          )}
          {status === "pending" && (
            <Clock className="w-3.5 h-3.5 text-[#586C61]" />
          )}
        </div>

        {/* Dynamic Number Badge */}
        <span
          className={cn(
            "font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md shrink-0 border",
            isSelected
              ? "bg-[#1A2F25] text-[#8EA690] border-[#2E4F3E]"
              : "bg-[#101A16] text-[#8FA396] border-[#1F3028]"
          )}
        >
          {number}
        </span>

        {/* Section Title */}
        <span
          className={cn(
            "truncate flex-1 font-medium transition-colors",
            isSelected ? "text-[#EAF0EB]" : "text-[#8FA396]"
          )}
        >
          {section.title}
        </span>

        {/* Revision Indicator Badge */}
        {isOrigin && (
          <span className="text-[10px] font-mono font-semibold text-[#8EA690] bg-[#162720] border border-[#243D31] px-1.5 py-0.2 rounded-md shrink-0">
            Origin
          </span>
        )}
        {isImpacted && (
          <span className="text-[10px] font-mono font-semibold text-[#D4B36A] bg-[#262215] border border-[#3D3520] px-1.5 py-0.2 rounded-md shrink-0">
            Revisi
          </span>
        )}

        {/* Type badge */}
        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 font-medium border",
            isSelected
              ? "bg-[#101A16] text-[#8EA690] border-[#1F3028]"
              : "bg-[#101A16] text-[#586C61] border-[#1F3028]"
          )}
        >
          {typeBadge}
        </span>
      </button>
    );
  }
);

OutlineItem.displayName = "OutlineItem";
