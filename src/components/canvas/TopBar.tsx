"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  FileDown,
  Sparkles,
  LayoutGrid,
  RotateCcw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { cn } from "@/lib/utils";

export interface TopBarProps {
  onOpenIdeaModal?: () => void;
  onExportPrd?: () => void;
  onLayout?: () => void;
  onReset?: () => void;
  className?: string;
}

export default function TopBar({
  onOpenIdeaModal,
  onExportPrd,
  onLayout,
  onReset,
  className,
}: TopBarProps) {
  const answeredCount = useCanvasStore((state) => state.answeredCount);
  const pendingCount = useCanvasStore((state) => state.pendingCount);
  const totalCount = useCanvasStore((state) => state.totalCount);
  const isGeneratingPrd = useCanvasStore((state) => state.isGeneratingPrd);
  const applyLayout = useCanvasStore((state) => state.applyLayout);
  const resetCanvas = useCanvasStore((state) => state.resetCanvas);
  const setPrdDrawerOpen = useCanvasStore((state) => state.setPrdDrawerOpen);
  const generatePrd = useCanvasStore((state) => state.generatePrd);
  const activeIdea = useCanvasStore((state) => state.getActiveIdea());

  const isAllAnswered = totalCount > 0 && answeredCount >= totalCount;
  const progressPercent =
    totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const handleExportClick = async () => {
    if (onExportPrd) {
      onExportPrd();
    } else {
      setPrdDrawerOpen(true);
      if (!useCanvasStore.getState().prdMarkdown) {
        await generatePrd();
      }
    }
  };

  const handleLayoutClick = () => {
    if (onLayout) {
      onLayout();
    } else {
      applyLayout("LR");
    }
  };

  const handleResetClick = () => {
    if (onReset) {
      onReset();
    } else {
      if (confirm("Reset seluruh kanvas dan mulai dari awal?")) {
        resetCanvas();
      }
    }
  };

  return (
    <header
      className={cn(
        "absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none gap-2",
        className
      )}
    >
      {/* Brand & Project Info */}
      <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 bg-[#101A16]/95 backdrop-blur-md rounded-xl shadow-xs border border-[#1F3028] transition-all hover:border-[#2D4539]">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer" title="Kembali ke Dashboard">
          <div className="w-7 h-7 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-icon.png"
              alt="ngePRD"
              className="w-7 h-7 object-contain"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-serif font-bold tracking-tight text-[#EAF0EB] leading-tight">
                ngePRD
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#14221C] text-[#8EA690] rounded border border-[#1F3028]">
                v2.2
              </span>
            </div>
            <span
              className="text-[10px] text-[#8FA396] font-medium truncate max-w-[140px] sm:max-w-[220px]"
              title={activeIdea}
            >
              {activeIdea || "Visual Discovery Canvas"}
            </span>
          </div>
        </Link>
      </div>

      {/* Action Controls & Progress Indicator */}
      <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end">
        {/* Progress Counter Pill */}
        {totalCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-lg shadow-xs border border-slate-200/80 text-xs"
            title={`Progress: ${answeredCount} dari ${totalCount} pertanyaan terjawab (${progressPercent}%)`}
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{answeredCount} Terjawab</span>
            </div>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>{pendingCount} Pending</span>
            </div>
            <div className="hidden md:block w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden ml-1 border border-slate-200/60">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Auto Layout Button */}
        <button
          type="button"
          onClick={handleLayoutClick}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:text-slate-900 transition-all cursor-pointer active:scale-95"
          title="Tata letak otomatis dengan Dagre"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
          <span>Auto Layout</span>
        </button>

        {/* Reset Canvas Button */}
        <button
          type="button"
          onClick={handleResetClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 hover:bg-white text-slate-600 hover:text-rose-600 text-xs font-medium rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer active:scale-95"
          title="Reset Kanvas"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* New Idea Button */}
        <button
          type="button"
          onClick={onOpenIdeaModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer active:scale-95"
          title="Buka dialog input ide baru"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden xs:inline">+ Ide Baru</span>
        </button>

        {/* Export PRD Button */}
        <button
          type="button"
          onClick={handleExportClick}
          disabled={isGeneratingPrd}
          data-testid="export-prd-btn"
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer active:scale-95",
            isAllAnswered
              ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30"
              : "bg-indigo-600 hover:bg-indigo-700 text-white",
            isGeneratingPrd && "opacity-80 cursor-wait"
          )}
          title="Pratinjau dan Ekspor Dokumen PRD"
        >
          {isGeneratingPrd ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isAllAnswered ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
          ) : (
            <FileDown className="w-3.5 h-3.5 text-indigo-200" />
          )}
          <span>Export PRD</span>
        </button>
      </div>
    </header>
  );
}
