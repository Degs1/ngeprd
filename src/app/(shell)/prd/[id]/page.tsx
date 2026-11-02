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

  // Outline panel collapse state
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);

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

  // Markdown for export
  const exportMarkdown = useMemo(() => {
    return document ? docToMarkdown(document) : "";
  }, [document]);

  // Loading view
  if (isLoading && !document) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-700">Memuat workspace PRD...</p>
        <p className="text-xs text-slate-400 mt-1">Menyiapkan kanvas dan outline...</p>
      </div>
    );
  }

  // Error / Not Found view
  if (error && !document) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
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
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
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
        <header className="h-14 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">
              {document.title}
            </h1>
            <StatusChip status="brainstorming" size="md" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <BrainstormWizard
              prdId={document._id.toString()}
              idea={document.idea}
              initialQuestions={document.brainstorm?.questions || []}
              initialAnswers={document.brainstorm?.answers || []}
              onAnswersUpdated={(updatedAnswers) => {
                // Update local document
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
        {/* TopBar (Section 8.2) */}
        <header className="h-14 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs z-20">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            {/* Editable Title */}
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
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
                  className="px-2.5 py-1 text-sm font-semibold border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-60 md:w-72"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle || !editedTitle.trim()}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTitle(false);
                    setEditedTitle(document.title);
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 group">
                <h1 className="text-sm md:text-base font-bold text-slate-900 truncate max-w-xs md:max-w-md">
                  {document.title}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setEditedTitle(document.title);
                    setIsEditingTitle(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded transition-opacity"
                  title="Ganti judul"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <StatusChip status={document.status} size="md" />

            {/* Section Progress Counter */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
              <span>
                {stats.readySections}/{stats.totalSections} section
              </span>
              {isGenerating && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Generation In-Progress / Cancel Button */}
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl font-medium animate-pulse border border-indigo-200/60">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Menulis dokumen...</span>
                </div>
                <button
                  type="button"
                  onClick={cancelGeneration}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Batalkan</span>
                </button>
              </div>
            ) : (
              document.status === "failed" && (
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Lanjutkan Generate</span>
                </button>
              )
            )}

            {/* Rapikan Layout (FR-CNV-07) */}
            <button
              type="button"
              onClick={relayout}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              title="Rapikan tata letak otomatis (Dagre LR)"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Rapikan</span>
            </button>

            {/* Export PRD Button */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PRD</span>
            </button>
          </div>
        </header>

        {/* Failure Banner if Document Failed */}
        {document.status === "failed" && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between text-xs text-rose-800 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {document.lastError?.message ||
                  "Proses terhenti sebelum semua section selesai. Anda dapat melanjutkan proses kapan saja."}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartGeneration}
              className="font-bold underline hover:text-rose-950 ml-4 shrink-0"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Main Split View: Canvas + Outline */}
        <div className="flex-1 flex flex-row min-h-0 relative overflow-hidden">
          {/* Main Graph Canvas */}
          <main className="flex-1 h-full relative">
            <WorkspaceCanvas />
          </main>

          {/* Collapsible Right Outline & Revisions Panel */}
          <OutlinePanel
            isCollapsed={isOutlineCollapsed}
            onToggleCollapse={() => setIsOutlineCollapsed(!isOutlineCollapsed)}
          />
        </div>

        {/* Slide-over Export PRD Drawer */}
        <PrdDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          markdown={exportMarkdown}
          isLoading={isGenerating}
        />
      </div>
    </ReactFlowProvider>
  );
}
