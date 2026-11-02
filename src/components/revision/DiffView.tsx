"use client";

import React, { useState, useMemo } from "react";
import { diffWordsWithSpace, diffLines, type Change } from "diff";
import { FileText, Code2, Columns, AlignLeft, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DiffViewProps {
  beforeText: string;
  afterText: string;
  beforeTitle?: string;
  afterTitle?: string;
  beforeDiagram?: string;
  afterDiagram?: string;
  initialMode?: "words" | "lines";
  className?: string;
  maxHeight?: string;
}

export function DiffView({
  beforeText,
  afterText,
  beforeTitle,
  afterTitle,
  beforeDiagram,
  afterDiagram,
  initialMode = "words",
  className,
  maxHeight = "max-h-72",
}: DiffViewProps) {
  const [mode, setMode] = useState<"words" | "lines">(initialMode);
  const [isDiagramExpanded, setIsDiagramExpanded] = useState(false);

  // Compute word-level diff
  const wordDiff = useMemo(() => {
    return diffWordsWithSpace(beforeText || "", afterText || "");
  }, [beforeText, afterText]);

  // Compute line-level diff
  const lineDiff = useMemo(() => {
    return diffLines(beforeText || "", afterText || "");
  }, [beforeText, afterText]);

  // Compute summary stats
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    wordDiff.forEach((part) => {
      const words = part.value.trim().split(/\s+/).filter(Boolean).length;
      if (part.added) additions += words;
      if (part.removed) deletions += words;
    });
    return { additions, deletions };
  }, [wordDiff]);

  // Diagram diff if diagram was changed
  const hasDiagramChange =
    beforeDiagram !== undefined &&
    afterDiagram !== undefined &&
    beforeDiagram.trim() !== afterDiagram.trim();

  const diagramLineDiff = useMemo(() => {
    if (!hasDiagramChange) return [];
    return diffLines(beforeDiagram || "", afterDiagram || "");
  }, [beforeDiagram, afterDiagram, hasDiagramChange]);

  const hasTitleChange =
    beforeTitle !== undefined &&
    afterTitle !== undefined &&
    beforeTitle.trim() !== afterTitle.trim();

  return (
    <div className={cn("flex flex-col text-xs rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs", className)}>
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 select-none">
        <div className="flex items-center gap-2">
          {/* Summary pill */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200/60">
              +{stats.additions} kata
            </span>
            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-semibold border border-rose-200/60">
              -{stats.deletions} kata
            </span>
          </div>
        </div>

        {/* Mode Toggle Buttons: Words vs Lines */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("words")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1",
              mode === "words"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
            title="Tampilkan perbedaan per kata"
          >
            <AlignLeft className="w-3 h-3" />
            <span>Kata</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("lines")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1",
              mode === "lines"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
            title="Tampilkan perbedaan per baris"
          >
            <Columns className="w-3 h-3" />
            <span>Baris</span>
          </button>
        </div>
      </div>

      {/* Title Diff Banner if Changed */}
      {hasTitleChange && (
        <div className="px-3 py-2 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600 shrink-0">Judul:</span>
          <span className="line-through text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 truncate">
            {beforeTitle}
          </span>
          <span className="text-slate-400">→</span>
          <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 truncate">
            {afterTitle}
          </span>
        </div>
      )}

      {/* Main Diff Content Container */}
      <div className={cn("overflow-y-auto p-3 font-sans leading-relaxed select-text", maxHeight)}>
        {mode === "words" ? (
          <div className="whitespace-pre-wrap break-words text-slate-700">
            {wordDiff.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-emerald-100/90 text-emerald-950 font-medium px-0.5 py-0.2 rounded border border-emerald-200"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-rose-100/90 text-rose-950 line-through decoration-rose-500/70 px-0.5 py-0.2 rounded border border-rose-200"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        ) : (
          <div className="font-mono text-[11px] leading-5 divide-y divide-slate-100">
            {lineDiff.map((part, index) => {
              const lines = part.value.replace(/\n$/, "").split("\n");
              if (part.added) {
                return lines.map((line, lineIdx) => (
                  <div
                    key={`${index}-${lineIdx}`}
                    className="flex bg-emerald-50/80 text-emerald-950 border-l-2 border-emerald-500 px-2 py-0.5"
                  >
                    <span className="w-5 shrink-0 text-emerald-600 select-none font-bold">+</span>
                    <span className="whitespace-pre-wrap break-words flex-1">{line || " "}</span>
                  </div>
                ));
              }
              if (part.removed) {
                return lines.map((line, lineIdx) => (
                  <div
                    key={`${index}-${lineIdx}`}
                    className="flex bg-rose-50/80 text-rose-950 border-l-2 border-rose-500 px-2 py-0.5 line-through decoration-rose-400"
                  >
                    <span className="w-5 shrink-0 text-rose-600 select-none font-bold">-</span>
                    <span className="whitespace-pre-wrap break-words flex-1">{line || " "}</span>
                  </div>
                ));
              }
              return lines.map((line, lineIdx) => (
                <div
                  key={`${index}-${lineIdx}`}
                  className="flex text-slate-600 hover:bg-slate-50 px-2 py-0.5"
                >
                  <span className="w-5 shrink-0 text-slate-300 select-none"> </span>
                  <span className="whitespace-pre-wrap break-words flex-1">{line || " "}</span>
                </div>
              ));
            })}
          </div>
        )}
      </div>

      {/* Diagram Mermaid Diff Collapsible Section */}
      {hasDiagramChange && (
        <div className="border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setIsDiagramExpanded(!isDiagramExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-indigo-700 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <Code2 className="w-3.5 h-3.5" />
              <span>Perubahan Diagram Mermaid</span>
            </div>
            {isDiagramExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {isDiagramExpanded && (
            <div className="p-2 border-t border-slate-200 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-48 leading-5">
              {diagramLineDiff.map((part, idx) => {
                const lines = part.value.replace(/\n$/, "").split("\n");
                if (part.added) {
                  return lines.map((l, li) => (
                    <div key={`${idx}-${li}`} className="text-emerald-400 bg-emerald-950/40 px-1">
                      + {l}
                    </div>
                  ));
                }
                if (part.removed) {
                  return lines.map((l, li) => (
                    <div key={`${idx}-${li}`} className="text-rose-400 bg-rose-950/40 px-1 line-through">
                      - {l}
                    </div>
                  ));
                }
                return lines.map((l, li) => (
                  <div key={`${idx}-${li}`} className="text-slate-400 px-1">
                    &nbsp;&nbsp;{l}
                  </div>
                ));
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DiffView;
