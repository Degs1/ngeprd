"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
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

  // Check if unselected and detected by term-match (triggers consistency warning per FR-AI-05)
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
        "rounded-2xl border transition-all duration-200 overflow-hidden bg-white shadow-2xs",
        isOrigin
          ? "border-purple-300 ring-1 ring-purple-200/70"
          : isSelected
          ? "border-slate-200/90 hover:border-slate-300"
          : "border-slate-200/60 bg-slate-50/50 opacity-80"
      )}
    >
      {/* Header bar */}
      <div className="p-3 bg-white flex items-start gap-2.5">
        {/* Checkbox (Origin is locked/disabled per FR-AI-05, failed items are disabled per Section 7.6) */}
        <div className="pt-0.5 shrink-0">
          <input
            type="checkbox"
            id={`checkbox-${item.sectionId}`}
            checked={isFailed ? false : (isOrigin ? true : isSelected)}
            disabled={disabled || isOrigin || isFailed}
            onChange={() => onToggleSelect(item.sectionId)}
            className={cn(
              "w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors",
              isOrigin
                ? "cursor-not-allowed opacity-90 accent-purple-600"
                : isFailed
                ? "cursor-not-allowed opacity-40 bg-slate-200"
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
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                {sectionNumber}
              </span>
            )}

            {/* Section Title */}
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {titleAfter || titleBefore}
            </h4>

            {/* Role Badge: Origin vs Impacted */}
            {isOrigin ? (
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 px-1.5 py-0.2 rounded-full">
                Origin
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-1.5 py-0.2 rounded-full">
                Terdampak
              </span>
            )}

            {/* Detection Badge */}
            {item.detectedBy === "origin" ? null : item.detectedBy === "ai" ? (
              <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>AI</span>
              </span>
            ) : (
              <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full">
                Term-Match
              </span>
            )}

            {/* Processing status badge */}
            <div className="ml-auto shrink-0 flex items-center gap-1">
              {isGenerating && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Menyusun...</span>
                </span>
              )}
              {isFailed && (
                <span className="flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  <span>Gagal</span>
                </span>
              )}
            </div>
          </div>

          {/* Reason text */}
          {item.reason && (
            <p className="text-[11px] text-slate-500 mt-1 leading-normal line-clamp-2">
              <span className="font-medium text-slate-600">Alasan: </span>
              {item.reason}
            </p>
          )}

          {/* Consistency Warning Banner (FR-AI-05) */}
          {showConsistencyWarning && (
            <div className="mt-2 text-xs text-amber-900 bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                <strong className="font-semibold">Potensi Inkonsistensi:</strong> Bagian ini
                terdeteksi memuat istilah lama. Melewatinya dapat menyebabkan istilah usang
                tetap tertinggal di dokumen.
              </p>
            </div>
          )}

          {/* Error Message if failed */}
          {item.error && (
            <div className="mt-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="text-[11px] font-medium">{item.error.message}</span>
            </div>
          )}
        </div>

        {/* Expand/Collapse Toggle Button */}
        {isReady && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
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
        <div className="px-3 pb-3 pt-0">
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
