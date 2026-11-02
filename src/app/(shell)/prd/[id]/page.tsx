"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  RotateCcw,
  Pencil,
  Check,
  X,
  LayoutGrid,
  Download,
  Square,
  Play,
  BookOpen,
} from "lucide-react";
import StatusChip from "@/components/dashboard/StatusChip";
import BrainstormWizard from "@/components/brainstorm/BrainstormWizard";
import WorkspaceCanvas from "@/components/canvas/WorkspaceCanvas";
import OutlinePanel from "@/components/outline/OutlinePanel";
import PrdDrawer from "@/components/prd/PrdDrawer";
import { usePrdStore } from "@/store/usePrdStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { docToMarkdown } from "@/lib/converter/docToMarkdown";
import { getOutlineStats } from "@/lib/converter/outline";
import { cn } from "@/lib/utils";

export default function PrdWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { renamePrd } = usePrdStore();

  // Workspace store state & actions
  const document = useWorkspaceStore((state) => state.document);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const error = useWorkspaceStore((state) => state.error);
  const loadPrd = useWorkspaceStore((state) => state.loadPrd);
  const isGenerating = useWorkspaceStore((state) => state.isGenerating);
  const generationProgress = useWorkspaceStore((state) => state.generationProgress);
  const startGeneration = useWorkspaceStore((state) => state.startGeneration);
  const cancelGeneration = useWorkspaceStore((state) => state.cancelGeneration);
  const relayout = useWorkspaceStore((state) => state.relayout);
  const outlineTree = useWorkspaceStore((state) => state.outlineTree);
  const activeChangeSet = useWorkspaceStore((state) => state.activeChangeSet);

  // Outline panel collapse state for desktop
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);

  // Mobile drawer state for Outline & Revisions
  const [isOutlineOpenMobile, setIsOutlineOpenMobile] = useState(false);

  // PRD Export Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Inline title editing in TopBar
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Load PRD document into workspace
  useEffect(() => {
    if (id) {
      loadPrd(id);
    }
  }, [id, loadPrd]);

  // Sync edited title when document loads
  useEffect(() => {
    if (document?.title) {
      setEditedTitle(document.title);
    }
  }, [document?.title]);

  // Auto-connect SSE generator if document is in generating status upon load
  useEffect(() => {
    if (document && document.status === "generating" && !isGenerating) {
      startGeneration();
    }
  }, [document?.status, isGenerating, startGeneration]);

  const handleSaveTitle = async () => {
    if (!document || !editedTitle.trim() || isSavingTitle) return;
    setIsSavingTitle(true);
    try {
      const ok = await renamePrd(document._id.toString(), editedTitle.trim());
      if (ok) {
        setIsEditingTitle(false);
      }
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleStartGeneration = useCallback(async () => {
    await startGeneration();
  }, [startGeneration]);

  // Outline stats
  const stats = useMemo(() => getOutlineStats(outlineTree), [outlineTree]);

  // Pending revisions count
  const pendingRevisionCount =
    activeChangeSet &&
    (activeChangeSet.status === "pending" || activeChangeSet.status === "generating")
      ? activeChangeSet.items.length
      : 0;

  // Markdown for export
  const exportMarkdown = useMemo(() => {
    return document ? docToMarkdown(document) : "";
  }, [document]);

  // Loading view
  if (isLoading && !document) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-700">Memuat workspace PRD...</p>
        <p className="text-xs text-slate-400 mt-1">Menyiapkan kanvas dan outline...</p>
      </div>
    );
  }

  // Error / Not Found view
  if (error && !document) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">PRD Tidak Ditemukan</h2>
        <p className="text-sm text-slate-500 mt-2">
          {error || "Dokumen PRD yang Anda cari tidak tersedia atau sudah dihapus."}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadPrd(id)}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!document) return null;

  // View 1: Brainstorming Wizard
  if (document.status === "brainstorming") {
    return (
      <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
        {/* TopBar */}
        <header className="h-14 border-b border-slate-200 bg-white px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
              title="Kembali ke Dashboard"
              aria-label="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xs sm:text-base font-bold text-slate-900 truncate max-w-[150px] xs:max-w-xs sm:max-w-md">
              {document.title}
            </h1>
            <StatusChip status="brainstorming" size="sm" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <BrainstormWizard
              prdId={document._id.toString()}
              idea={document.idea}
              initialQuestions={document.brainstorm?.questions || []}
              initialAnswers={document.brainstorm?.answers || []}
              isGenerating={isGenerating}
              onAnswersUpdated={(updatedAnswers) => {
                useWorkspaceStore.setState((prev) => ({
                  document: prev.document
                    ? {
                        ...prev.document,
                        brainstorm: {
                          ...prev.document.brainstorm,
                          answers: updatedAnswers,
                        },
                      }
                    : prev.document,
                }));
              }}
              onGeneratePrd={() => {
                handleStartGeneration();
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  // View 2, 3, 4: Workspace Canvas with Outline Panel
  return (
    <ReactFlowProvider>
      <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
        {/* TopBar */}
        <header className="h-14 border-b border-slate-200 bg-white px-3 sm:px-5 flex items-center justify-between shrink-0 shadow-xs z-20 gap-2">
          {/* Left Title & Status Area */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
              title="Kembali ke Dashboard"
              aria-label="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            {/* Editable Title */}
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setIsEditingTitle(false);
                      setEditedTitle(document.title);
                    }
                  }}
                  autoFocus
                  disabled={isSavingTitle}
                  className="px-2 py-1 text-xs sm:text-sm font-semibold border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-28 xs:w-44 sm:w-60 md:w-72"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle || !editedTitle.trim()}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                  aria-label="Simpan judul"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTitle(false);
                    setEditedTitle(document.title);
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                  aria-label="Batal ubah judul"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 group">
                <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate max-w-[100px] xs:max-w-[160px] sm:max-w-xs md:max-w-md">
                  {document.title}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setEditedTitle(document.title);
                    setIsEditingTitle(true);
                  }}
                  className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded transition-opacity"
                  title="Ganti judul"
                  aria-label="Ganti judul PRD"
                >
                  <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            )}

            <div className="shrink-0 hidden xxs:block">
              <StatusChip status={document.status} size="sm" />
            </div>

            {/* Section Progress Counter */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shrink-0">
              <span>
                {stats.readySections}/{stats.totalSections} section
              </span>
              {isGenerating && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Generation In-Progress / Cancel Button */}
            {isGenerating ? (
              <div className="flex items-center gap-1.5">
                <div className="hidden lg:flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-xl font-medium animate-pulse border border-indigo-200/60">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Menulis dokumen...</span>
                </div>
                <button
                  type="button"
                  onClick={cancelGeneration}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span className="hidden xs:inline">Batalkan</span>
                </button>
              </div>
            ) : (
              document.status === "failed" && (
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  disabled={isGenerating}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lanjutkan</span>
                </button>
              )
            )}

            {/* Rapikan Layout (FR-CNV-07) */}
            <button
              type="button"
              onClick={relayout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              title="Rapikan tata letak otomatis (Dagre LR)"
              aria-label="Rapikan tata letak otomatis"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Rapikan</span>
            </button>

            {/* Outline & Revisi Toggle on Mobile (< 768px) */}
            <button
              type="button"
              onClick={() => setIsOutlineOpenMobile(true)}
              className="md:hidden px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-colors flex items-center gap-1 relative cursor-pointer"
              title="Buka Outline & Revisi"
              aria-label="Buka Outline dan Revisi"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden xs:inline">Outline</span>
              {pendingRevisionCount > 0 ? (
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              ) : (
                <span className="text-[10px] font-mono text-slate-500">
                  {stats.readySections}/{stats.totalSections}
                </span>
              )}
            </button>

            {/* Export PRD Button */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              disabled={document.status !== "ready"}
              title={
                document.status !== "ready"
                  ? "PRD harus berstatus ready untuk diekspor"
                  : "Buka preview dan ekspor PRD"
              }
              aria-label="Export PRD"
              className={cn(
                "px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer",
                document.status === "ready"
                  ? "text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95"
                  : "text-slate-400 bg-slate-100 cursor-not-allowed opacity-60"
              )}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Export</span>
              <span className="hidden sm:inline"> PRD</span>
            </button>
          </div>
        </header>

        {/* Failure Banner if Document Failed */}
        {!isGenerating && document.status === "failed" && (
          <div className="bg-rose-50 border-b border-rose-200 px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-rose-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="truncate">
                {document.lastError?.message ||
                  "Proses terhenti sebelum semua section selesai."}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartGeneration}
              disabled={isGenerating}
              className="font-bold underline hover:text-rose-950 ml-3 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Main Split View: Canvas + Desktop Outline */}
        <div className="flex-1 flex flex-row min-h-0 relative overflow-hidden">
          {/* Main Graph Canvas */}
          <main className="flex-1 h-full relative w-full">
            <WorkspaceCanvas />
          </main>

          {/* Collapsible Right Outline & Revisions Panel (Desktop >= 768px) */}
          <OutlinePanel
            isCollapsed={isOutlineCollapsed}
            onToggleCollapse={() => setIsOutlineCollapsed(!isOutlineCollapsed)}
          />
        </div>

        {/* Mobile Slide-Over Outline & Revisions Drawer (< 768px with smooth slide animation) */}
        <div
          className={cn(
            "md:hidden fixed inset-0 z-40 flex justify-end transition-all duration-300 ease-in-out",
            isOutlineOpenMobile ? "pointer-events-auto visible" : "pointer-events-none invisible"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Panel Outline dan Revisi"
        >
          {/* Backdrop */}
          <div
            className={cn(
              "fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out",
              isOutlineOpenMobile ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setIsOutlineOpenMobile(false)}
            aria-hidden={!isOutlineOpenMobile}
          />
          {/* Drawer */}
          <div
            className={cn(
              "relative ml-auto w-84 max-w-[88vw] h-full bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)",
              isOutlineOpenMobile ? "translate-x-0" : "translate-x-full"
            )}
          >
            <OutlinePanel
              isMobileDrawer
              onCloseMobile={() => setIsOutlineOpenMobile(false)}
            />
          </div>
        </div>

        {/* Slide-over Export PRD Drawer */}
        <PrdDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          docId={document._id.toString()}
          docTitle={document.title}
          docStatus={document.status}
          markdown={exportMarkdown}
          isLoading={isGenerating}
          pendingOrFailedCount={stats.totalSections - stats.readySections}
        />
      </div>
    </ReactFlowProvider>
  );
}
