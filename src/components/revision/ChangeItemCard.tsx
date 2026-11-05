"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { ClientChangeItem } from "@/store/useWorkspaceStore";
import { DiffView } from "./DiffView";
import { cn } from "@/lib/utils";

export interface ChangeItemCardProps {
  key?: string;
  item: ClientChangeItem;
  sectionNumber?: string;
  isSelected: boolean;
  onToggleSelect: (sectionId: string) => void;
  disabled?: boolean;
}

export function ChangeItemCard({
  item,
  sectionNumber,
  isSelected,
  onToggleSelect,
  disabled = false,
}: ChangeItemCardProps) {
  const isOrigin = item.role === "origin";
  const [isExpanded, setIsExpanded] = useState(true);

  // Status indicators
  const isGenerating = item.status === "pending";
  const isReady = item.status === "ready";
  const isFailed = item.status === "failed";

  // Check if unselected and detected by term-match
  const showConsistencyWarning = item.detectedBy === "term-match" && !isSelected;

  const titleBefore = item.before?.title;
  const titleAfter = item.after?.title || titleBefore;
  const contentBefore = item.before?.content || "";
  const contentAfter = item.after?.content || "";
  const diagramBefore = item.before?.diagramCode;
  const diagramAfter = item.after?.diagramCode;

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-hidden bg-[#121E19] text-[#EAF0EB] shadow-xl",
        isOrigin
          ? "border-[#8EA690] ring-1 ring-[#8EA690]"
          : isSelected
          ? "border-[#243C30]"
          : "border-[#1F3028] opacity-75"
      )}
    >
      {/* Header bar */}
      <div className="p-3 bg-[#15231D] flex items-start gap-2.5 border-b border-[#1F3028]">
        {/* Checkbox */}
        <div className="pt-0.5 shrink-0">
          <input
            type="checkbox"
            id={`checkbox-${item.sectionId}`}
            checked={isFailed ? false : (isOrigin ? true : isSelected)}
            disabled={disabled || isOrigin || isFailed}
            onChange={() => onToggleSelect(item.sectionId)}
            className={cn(
              "w-4 h-4 rounded border-[#243C30] bg-[#0C1310] accent-[#8EA690] transition-colors",
              isOrigin
                ? "cursor-not-allowed opacity-90"
                : isFailed
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer"
            )}
            title={
              isFailed
                ? "Bagian ini gagal disusun dan tidak dapat dicentang"
                : isOrigin
                ? "Origin section wajib disertakan"
                : "Pilih untuk menerapkan"
            }
          />
        </div>

        {/* Title, Badges, Reason */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Section Number Pill */}
            {sectionNumber && (
              <span className="font-mono text-xs font-bold text-[#8EA690] bg-[#162720] border border-[#243D31] px-1.5 py-0.5 rounded">
                {sectionNumber}
              </span>
            )}

            {/* Section Title */}
            <h4 className="text-xs font-serif font-bold text-[#EAF0EB] truncate">
              {titleAfter || titleBefore}
            </h4>

            {/* Role Badge: Origin vs Impacted */}
            {isOrigin ? (
              <span className="text-[10px] font-mono font-semibold text-[#8EA690] bg-[#162720] border border-[#243D31] px-1.5 py-0.2 rounded">
                Origin
              </span>
            ) : (
              <span className="text-[10px] font-mono font-semibold text-[#8CB4D9] bg-[#18262F] border border-[#243B4D] px-1.5 py-0.2 rounded">
                Terdampak
              </span>
            )}

            {/* Detection Badge */}
            {item.detectedBy === "origin" ? null : item.detectedBy === "ai" ? (
              <span className="text-[10px] font-mono text-[#8EA690] bg-[#162720] border border-[#243D31] px-1.5 py-0.2 rounded">
                AI
              </span>
            ) : (
              <span className="text-[10px] font-mono text-[#D4B36A] bg-[#262215] border border-[#3D3520] px-1.5 py-0.2 rounded">
                Term-Match
              </span>
            )}

            {/* Processing status badge */}
            <div className="ml-auto shrink-0 flex items-center gap-1">
              {isGenerating && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#8CB4D9]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Menyusun...</span>
                </span>
              )}
              {isFailed && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#D48B80]">
                  <AlertCircle className="w-3 h-3" />
                  <span>Gagal</span>
                </span>
              )}
            </div>
          </div>

          {/* Reason text */}
          {item.reason && (
            <p className="text-[11px] text-[#8FA396] mt-1 leading-normal line-clamp-2">
              <span className="font-semibold text-[#EAF0EB]">Alasan: </span>
              {item.reason}
            </p>
          )}

          {/* Consistency Warning Banner */}
          {showConsistencyWarning && (
            <div className="mt-2 text-xs text-[#D4B36A] bg-[#262215] border border-[#3D3520] rounded-xl p-2.5 flex items-start gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-[#D4B36A] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                <strong className="font-semibold">Potensi Inkonsistensi:</strong> Bagian ini
                terdeteksi memuat istilah lama. Melewatinya dapat menyebabkan istilah usang
                tetap tertinggal di dokumen.
              </p>
            </div>
          )}

          {/* Error Message if failed */}
          {item.error && (
            <div className="mt-2 text-xs text-[#D48B80] bg-[#281816] border border-[#442420] rounded-xl p-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#D48B80] shrink-0" />
              <span className="text-[11px] font-medium">{item.error.message}</span>
            </div>
          )}
        </div>

        {/* Expand/Collapse Toggle Button */}
        {isReady && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-[#586C61] hover:text-[#EAF0EB] hover:bg-[#162620] transition-colors shrink-0 cursor-pointer"
            title={isExpanded ? "Sembunyikan diff" : "Tampilkan diff"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Expandable Diff Viewer */}
      {isReady && isExpanded && (
        <div className="p-3 bg-[#101A16]">
          <DiffView
            beforeText={contentBefore}
            afterText={contentAfter}
            beforeTitle={titleBefore}
            afterTitle={titleAfter}
            beforeDiagram={diagramBefore}
            afterDiagram={diagramAfter}
            initialMode="words"
          />
        </div>
      )}
    </div>
  );
}

export default ChangeItemCard;
