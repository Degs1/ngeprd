"use client";

import React, { useState, useMemo } from "react";
import { diffWordsWithSpace, diffLines } from "diff";
import { Code2, Columns, AlignLeft, ChevronDown, ChevronRight } from "lucide-react";
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
    <div className={cn("flex flex-col text-xs rounded-xl border border-[#1F3028] bg-[#0C1310] overflow-hidden text-[#EAF0EB] shadow-2xs", className)}>
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121E19] border-b border-[#1F3028] select-none">
        <div className="flex items-center gap-2">
          {/* Summary pill */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-[#8EA690] bg-[#162720] px-1.5 py-0.5 rounded font-semibold border border-[#243D31]">
              +{stats.additions} kata
            </span>
            <span className="text-[#D48B80] bg-[#281816] px-1.5 py-0.5 rounded font-semibold border border-[#442420]">
              -{stats.deletions} kata
            </span>
          </div>
        </div>

        {/* Mode Toggle Buttons: Words vs Lines */}
        <div className="flex items-center gap-1 bg-[#0C1310] border border-[#1F3028] p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("words")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer",
              mode === "words"
                ? "bg-[#162620] text-[#EAF0EB] shadow-2xs"
                : "text-[#8FA396] hover:text-[#EAF0EB]"
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
              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer",
              mode === "lines"
                ? "bg-[#162620] text-[#EAF0EB] shadow-2xs"
                : "text-[#8FA396] hover:text-[#EAF0EB]"
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
        <div className="px-3 py-2 bg-[#15231D] border-b border-[#1F3028] flex items-center gap-2 text-xs">
          <span className="font-semibold text-[#8FA396] shrink-0">Judul:</span>
          <span className="line-through text-[#D48B80] bg-[#281816] px-1.5 py-0.5 rounded border border-[#442420] truncate">
            {beforeTitle}
          </span>
          <span className="text-[#586C61]">→</span>
          <span className="font-semibold text-[#8EA690] bg-[#162720] px-1.5 py-0.5 rounded border border-[#243D31] truncate">
            {afterTitle}
          </span>
        </div>
      )}

      {/* Main Diff Content Container */}
      <div className={cn("overflow-y-auto p-3 font-sans leading-relaxed select-text", maxHeight)}>
        {mode === "words" ? (
          <div className="whitespace-pre-wrap break-words text-[#8FA396]">
            {wordDiff.map((part, index) => {
              if (part.added) {
                return (
                  <ins
                    key={index}
                    className="bg-[#162720] text-[#8EA690] font-medium px-1 py-0.2 rounded border border-[#243D31] no-underline"
                  >
                    {part.value}
                  </ins>
                );
              }
              if (part.removed) {
                return (
                  <del
                    key={index}
                    className="bg-[#281816] text-[#D48B80] line-through decoration-[#D48B80]/70 px-1 py-0.2 rounded border border-[#442420]"
                  >
                    {part.value}
                  </del>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        ) : (
          <div className="font-mono text-[11px] leading-5 divide-y divide-[#1F3028]">
            {lineDiff.map((part, index) => {
              const lines = part.value.replace(/\n$/, "").split("\n");
              if (part.added) {
                return lines.map((line, lineIdx) => (
                  <div
                    key={`${index}-${lineIdx}`}
                    className="flex bg-[#162720]/80 text-[#8EA690] border-l-2 border-[#8EA690] px-2 py-0.5"
                  >
                    <span className="w-5 shrink-0 text-[#8EA690] select-none font-bold">+</span>
                    <span className="whitespace-pre-wrap break-words flex-1">{line || " "}</span>
                  </div>
                ));
              }
              if (part.removed) {
                return lines.map((line, lineIdx) => (
                  <div
                    key={`${index}-${lineIdx}`}
                    className="flex bg-[#281816]/80 text-[#D48B80] border-l-2 border-[#D48B80] px-2 py-0.5 line-through decoration-[#D48B80]/70"
                  >
                    <span className="w-5 shrink-0 text-[#D48B80] select-none font-bold">-</span>
                    <span className="whitespace-pre-wrap break-words flex-1">{line || " "}</span>
                  </div>
                ));
              }
              return lines.map((line, lineIdx) => (
                <div
                  key={`${index}-${lineIdx}`}
                  className="flex text-[#8FA396] hover:bg-[#121E19] px-2 py-0.5"
                >
                  <span className="w-5 shrink-0 text-[#586C61] select-none"> </span>
                  <span className="whitespace-pre-wrap break-words flex-1">{line || " "}</span>
                </div>
              ));
            })}
          </div>
        )}
      </div>

      {/* Diagram Mermaid Diff Collapsible Section */}
      {hasDiagramChange && (
        <div className="border-t border-[#1F3028] bg-[#121E19]">
          <button
            type="button"
            onClick={() => setIsDiagramExpanded(!isDiagramExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-[#8EA690] hover:bg-[#162620] transition-colors"
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
            <div className="p-2 border-t border-[#1F3028] bg-[#0C1310] text-[#EAF0EB] font-mono text-[11px] overflow-x-auto max-h-48 leading-5">
              {diagramLineDiff.map((part, idx) => {
                const lines = part.value.replace(/\n$/, "").split("\n");
                if (part.added) {
                  return lines.map((l, li) => (
                    <div key={`${idx}-${li}`} className="text-[#8EA690] bg-[#162720] px-1">
                      + {l}
                    </div>
                  ));
                }
                if (part.removed) {
                  return lines.map((l, li) => (
                    <div key={`${idx}-${li}`} className="text-[#D48B80] bg-[#281816] px-1 line-through">
                      - {l}
                    </div>
                  ));
                }
                return lines.map((l, li) => (
                  <div key={`${idx}-${li}`} className="text-[#586C61] px-1">
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
