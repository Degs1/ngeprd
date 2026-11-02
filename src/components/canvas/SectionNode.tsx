"use client";

import React, { memo, useMemo, useState, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Pencil,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  Layers,
  Code2,
} from "lucide-react";
import { marked } from "marked";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { Section, SectionType, SectionStatus, Diagram } from "@/lib/schemas/prd";
import { cn } from "@/lib/utils";
import { MermaidView } from "./MermaidView";
import { NodeInstructionBar } from "./NodeInstructionBar";

export interface SectionNodeData {
  id: string;
  sectionId?: string;
  number?: string;
  chapterId?: string;
  title?: string;
  type?: SectionType;
  status?: SectionStatus;
  brief?: string;
  content?: string;
  diagram?: Diagram;
  error?: { code: string; message: string };
}

const typeLabelMap: Record<string, { label: string; color: string }> = {
  overview: { label: "Ringkasan", color: "bg-blue-50 text-blue-700 border-blue-200" },
  problem: { label: "Masalah", color: "bg-amber-50 text-amber-700 border-amber-200" },
  goals: { label: "Tujuan", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  users: { label: "Pengguna", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  features: { label: "Fitur", color: "bg-purple-50 text-purple-700 border-purple-200" },
  flow: { label: "Alur", color: "bg-sky-50 text-sky-700 border-sky-200" },
  architecture: { label: "Arsitektur", color: "bg-violet-50 text-violet-700 border-violet-200" },
  data_model: { label: "Data Model", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  tech_stack: { label: "Tech Stack", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  api: { label: "API", color: "bg-teal-50 text-teal-700 border-teal-200" },
  security: { label: "Keamanan", color: "bg-rose-50 text-rose-700 border-rose-200" },
  nfr: { label: "NFR", color: "bg-slate-50 text-slate-700 border-slate-200" },
  risks: { label: "Risiko", color: "bg-orange-50 text-orange-700 border-orange-200" },
  roadmap: { label: "Roadmap", color: "bg-lime-50 text-lime-700 border-lime-200" },
  custom: { label: "Kustom", color: "bg-gray-50 text-gray-700 border-gray-200" },
};

function SectionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SectionNodeData;

  // Read section from store to avoid stale copies (PRD.md Section 7.9)
  const storeSection = useWorkspaceStore((state) =>
    state.document?.sections.find((s) => s.id === id)
  );
  const storeChapter = useWorkspaceStore((state) =>
    state.document?.chapters.find(
      (c) => c.id === (storeSection?.chapterId || nodeData.chapterId)
    )
  );
  const prdId = useWorkspaceStore((state) => state.prdId);
  const sectionNumber =
    useWorkspaceStore((state) => state.sectionNumberMap.get(id)) ||
    nodeData.number ||
    "1.1";
  const startGeneration = useWorkspaceStore((state) => state.startGeneration);
  const selectNode = useWorkspaceStore((state) => state.selectNode);
  const saveSection = useWorkspaceStore((state) => state.saveSection);
  const updateSectionInStore = useWorkspaceStore(
    (state) => state.updateSectionInStore
  );
  const loadPrd = useWorkspaceStore((state) => state.loadPrd);
  const activeChangeSet = useWorkspaceStore((state) => state.activeChangeSet);

  const isRevisionActive =
    activeChangeSet &&
    (activeChangeSet.status === "pending" || activeChangeSet.status === "generating");
  const isRevisionOrigin =
    Boolean(isRevisionActive && activeChangeSet.originSectionId === id);
  const isRevisionImpacted =
    Boolean(
      isRevisionActive &&
        !isRevisionOrigin &&
        activeChangeSet.items.some((it) => it.sectionId === id)
    );

  const section: Partial<Section> = storeSection || nodeData;
  const status: SectionStatus = section.status || "pending";
  const title = section.title || nodeData.title || "Section";
  const type = (section.type || nodeData.type || "custom") as string;
  const content = section.content || "";
  const brief = section.brief || nodeData.brief || "";
  const diagram = section.diagram || nodeData.diagram;
  const error = section.error || nodeData.error;
  const rev = section.rev || 1;

  // Inline editing state (FR-EDT-01, FR-EDT-02, FR-EDT-03)
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(content);
  const [editDiagramCode, setEditDiagramCode] = useState(diagram?.code || "");
  const [editActiveTab, setEditActiveTab] = useState<"content" | "diagram">(
    "content"
  );

  // Optimistic concurrency & save state tracking
  const [baseRev, setBaseRev] = useState(rev);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [conflictRev, setConflictRev] = useState<number | null>(null);

  // Debounce autosave timer ref
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValuesRef = useRef({
    title: editTitle,
    content: editContent,
    diagramCode: editDiagramCode,
    baseRev,
  });

  // Keep latest values updated for timer closures
  useEffect(() => {
    latestValuesRef.current = {
      title: editTitle,
      content: editContent,
      diagramCode: editDiagramCode,
      baseRev,
    };
  }, [editTitle, editContent, editDiagramCode, baseRev]);

  // Keep local values in sync when store changes externally (and not actively editing)
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(title);
      setEditContent(content);
      setEditDiagramCode(diagram?.code || "");
      setBaseRev(rev);
    }
  }, [title, content, diagram?.code, rev, isEditing]);

  // Prevent editing on pending or writing sections (FR-EDT-04)
  useEffect(() => {
    if ((status === "pending" || status === "writing") && isEditing) {
      setIsEditing(false);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    }
  }, [status, isEditing]);

  const typeMeta = typeLabelMap[type] || {
    label: type,
    color: "bg-slate-50 text-slate-700 border-slate-200",
  };

  // Render markdown safely
  const renderedContent = useMemo(() => {
    if (!content) return "";
    try {
      return marked.parse(content, { breaks: true, gfm: true }) as string;
    } catch {
      return content;
    }
  }, [content]);

  // Core save executor
  const performSave = async (
    titleToSave: string,
    contentToSave: string,
    diagramCodeToSave: string,
    targetBaseRev: number
  ) => {
    setSaveState("saving");
    setSaveErrorMessage(null);

    const diagramPayload =
      diagramCodeToSave.trim().length > 0
        ? {
            kind: "mermaid" as const,
            code: diagramCodeToSave.trim(),
            status:
              diagramCodeToSave.trim() === diagram?.code
                ? diagram.status || ("unchecked" as const)
                : ("unchecked" as const),
          }
        : undefined;

    const result = await saveSection(id, targetBaseRev, {
      title: titleToSave,
      content: contentToSave,
      diagram: diagramPayload,
    });

    if (result.success && result.rev !== undefined) {
      setBaseRev(result.rev);
      setSaveState("saved");
      setConflictRev(null);

      // Auto revert 'saved' indicator back to 'idle' after 2.5s
      setTimeout(() => {
        setSaveState((prev) => (prev === "saved" ? "idle" : prev));
      }, 2500);
    } else if (result.conflict) {
      // 409 Concurrency Conflict (FR-EDT-03)
      setSaveState("conflict");
      setConflictRev(result.currentRev ?? null);
    } else {
      setSaveState("error");
      setSaveErrorMessage(result.error || "Gagal menyimpan perubahan");
    }
  };

  // Schedule autosave with ~800ms debounce (FR-EDT-01)
  const scheduleAutosave = (
    newTitle: string,
    newContent: string,
    newDiagramCode: string
  ) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setSaveState("saving");

    autosaveTimerRef.current = setTimeout(() => {
      performSave(
        newTitle,
        newContent,
        newDiagramCode,
        latestValuesRef.current.baseRev
      );
    }, 800);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditTitle(val);
    scheduleAutosave(val, editContent, editDiagramCode);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditContent(val);
    scheduleAutosave(editTitle, val, editDiagramCode);
  };

  const handleDiagramCodeChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const val = e.target.value;
    setEditDiagramCode(val);
    scheduleAutosave(editTitle, editContent, val);
  };

  // Conflict Resolution: Muat ulang (Reload from server)
  const handleConflictReload = async () => {
    if (prdId) {
      await loadPrd(prdId);
    }
    // Pull latest values from store section
    const current = storeSection;
    if (current) {
      setEditTitle(current.title || "");
      setEditContent(current.content || "");
      setEditDiagramCode(current.diagram?.code || "");
      setBaseRev(current.rev);
    }
    setSaveState("idle");
    setConflictRev(null);
  };

  // Conflict Resolution: Timpa (Overwrite server version with current edits)
  const handleConflictOverwrite = async () => {
    const overwriteBaseRev = conflictRev ?? baseRev;
    await performSave(
      editTitle,
      editContent,
      editDiagramCode,
      overwriteBaseRev
    );
  };

  // Finish editing: flush any pending autosave and exit
  const handleFinishEditing = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      await performSave(
        editTitle,
        editContent,
        editDiagramCode,
        baseRev
      );
    }
    setIsEditing(false);
  };

  // MermaidView status update callback: persists status changes ('ok' / 'invalid' / auto-repaired code)
  const handleDiagramStatusChange = async (
    newStatus: "ok" | "invalid",
    repairedCode?: string,
    errorMsg?: string
  ) => {
    if (!diagram) return;

    const codeToPersist = repairedCode || diagram.code;
    const isUnchanged =
      diagram.status === newStatus &&
      codeToPersist === diagram.code &&
      diagram.error === errorMsg;

    if (isUnchanged) return;

    const updatedDiagram: Diagram = {
      kind: "mermaid",
      code: codeToPersist,
      status: newStatus,
      error: errorMsg,
    };

    // Update store state immediately
    updateSectionInStore(id, { diagram: updatedDiagram });

    // Persist to database via PATCH
    const result = await saveSection(id, rev, {
      diagram: updatedDiagram,
    });

    if (result.success && result.rev !== undefined) {
      setBaseRev(result.rev);
    }
  };

  const handleRetry = (e: any) => {
    e.stopPropagation();
    startGeneration([id]);
  };

  const canEdit = status !== "pending" && status !== "writing";

  return (
    <div
      onClick={() => selectNode(id)}
      className={cn(
        "relative rounded-2xl border bg-white shadow-sm w-[380px] select-none transition-all duration-200 flex flex-col",
        selected
          ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50 border-indigo-500 shadow-xl"
          : "hover:shadow-md border-slate-200/90",
        isRevisionOrigin &&
          "!border-purple-500 !ring-2 !ring-purple-400 !ring-offset-2 shadow-purple-100 shadow-xl",
        isRevisionImpacted &&
          "!border-amber-500 !ring-2 !ring-amber-400 !ring-offset-2 shadow-amber-100 shadow-xl",
        status === "writing" &&
          "border-indigo-400 shadow-indigo-100/50 shadow-lg",
        status === "failed" && "border-rose-300 bg-rose-50/20",
        isEditing && "ring-2 ring-indigo-400 border-indigo-400 shadow-md"
      )}
    >
      <div className="w-full rounded-2xl overflow-hidden flex flex-col flex-1">
        {/* Incoming Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 !bg-indigo-500 border-2 border-white rounded-full hover:!bg-indigo-600 transition-colors shadow-xs"
      />

      {/* Chapter Accent Stripe (FR-CNV-10) */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />

      {/* Header */}
      <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Dynamic Section Number */}
            <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md shrink-0">
              {sectionNumber}
            </span>

            {/* Type Badge */}
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wide",
                typeMeta.color
              )}
            >
              {typeMeta.label}
            </span>

            {/* Revision Role Badge (PRD 8.2) */}
            {isRevisionOrigin && (
              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Origin</span>
              </span>
            )}
            {isRevisionImpacted && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full shrink-0">
                ⟳ Terdampak
              </span>
            )}
          </div>

          {/* Status / Save Indicator (FR-EDT-02) */}
          <div className="flex items-center gap-1 shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                {saveState === "saving" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                    <span>Menyimpan…</span>
                  </span>
                )}
                {saveState === "saved" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Tersimpan</span>
                  </span>
                )}
                {saveState === "error" && (
                  <button
                    type="button"
                    onClick={() =>
                      performSave(editTitle, editContent, editDiagramCode, baseRev)
                    }
                    className="nodrag nowheel inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full hover:bg-rose-100 transition-colors"
                    title={saveErrorMessage || "Klik untuk mencoba lagi"}
                  >
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>Gagal, coba lagi</span>
                  </button>
                )}
                {saveState === "conflict" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    <span>Konflik</span>
                  </span>
                )}
                {saveState === "idle" && (
                  <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    Mode Edit
                  </span>
                )}
              </div>
            ) : (
              <>
                {status === "pending" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Pending</span>
                  </span>
                )}
                {status === "writing" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
                    <span>Menulis...</span>
                  </span>
                )}
                {status === "ready" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Ready</span>
                  </span>
                )}
                {status === "failed" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                    <span>Gagal</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section Title: Static or Editable (FR-EDT-01) */}
        {isEditing ? (
          <div className="mt-1">
            <input
              type="text"
              value={editTitle}
              onChange={handleTitleChange}
              placeholder="Judul section..."
              className="nodrag nowheel w-full px-2.5 py-1 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        ) : (
          <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
            {title}
          </h3>
        )}

        {/* Chapter Context Label */}
        {storeChapter && (
          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
            Bab: {storeChapter.title}
          </p>
        )}
      </div>

      {/* 409 Conflict Dialog Banner (FR-EDT-03) */}
      {isEditing && saveState === "conflict" && (
        <div className="nodrag nowheel p-3 bg-amber-50 border-b border-amber-200 space-y-2 text-xs text-amber-900 animate-in fade-in duration-150">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <p className="font-bold">Terjadi Konflik Revisi!</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Bagian ini telah dimodifikasi di tempat lain (rev saat ini:{" "}
                <span className="font-mono font-bold">{conflictRev ?? "baru"}</span>
                ). Pilih aksi:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleConflictReload}
              className="nodrag nowheel flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-slate-500" />
              <span>Muat ulang</span>
            </button>

            <button
              type="button"
              onClick={handleConflictOverwrite}
              className="nodrag nowheel flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs transition-colors"
            >
              <Layers className="w-3 h-3" />
              <span>Timpa</span>
            </button>
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className="p-4 flex-1">
        {/* EDITING MODE (FR-EDT-01) */}
        {isEditing ? (
          <div className="space-y-3">
            {/* Tab selector if diagram exists */}
            {(diagram?.code || editDiagramCode) && (
              <div className="flex items-center gap-1 border-b border-slate-200 pb-1.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setEditActiveTab("content")}
                  className={cn(
                    "nodrag nowheel px-2.5 py-1 rounded-md transition-colors",
                    editActiveTab === "content"
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Konten Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setEditActiveTab("diagram")}
                  className={cn(
                    "nodrag nowheel px-2.5 py-1 rounded-md transition-colors flex items-center gap-1",
                    editActiveTab === "diagram"
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Code2 className="w-3 h-3" />
                  <span>Diagram Mermaid</span>
                </button>
              </div>
            )}

            {/* Markdown Editor */}
            {editActiveTab === "content" ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">
                  Markdown Textarea
                </label>
                <textarea
                  value={editContent}
                  onChange={handleContentChange}
                  rows={6}
                  placeholder="Ketik konten spesifikasi markdown di sini..."
                  className="nodrag nowheel w-full text-xs font-mono text-slate-800 p-2.5 bg-white border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
                />
              </div>
            ) : (
              /* Diagram Code Editor (FR-EDT-09) */
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>Kode Diagram Mermaid</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    flowchart, sequenceDiagram, erDiagram, dsb.
                  </span>
                </label>
                <textarea
                  value={editDiagramCode}
                  onChange={handleDiagramCodeChange}
                  rows={5}
                  placeholder="flowchart TD&#10;  A[Mulai] --> B[Selesai]"
                  className="nodrag nowheel w-full text-xs font-mono text-slate-800 p-2.5 bg-slate-900 text-slate-100 border border-slate-800 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
                />

                {/* Live Preview of Diagram */}
                {editDiagramCode.trim().length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Pratinjau Diagram
                    </p>
                    <MermaidView
                      code={editDiagramCode}
                      sectionId={id}
                      prdId={prdId || undefined}
                      status="unchecked"
                      onStatusChange={handleDiagramStatusChange}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* READ / DISPLAY MODE */
          <>
            {/* Status: Pending Skeleton */}
            {status === "pending" && (
              <div className="space-y-2.5 py-1">
                {brief ? (
                  <p className="text-xs text-slate-500 italic mb-3 leading-relaxed">
                    {brief}
                  </p>
                ) : null}
                <div className="h-3 bg-slate-100 rounded-md animate-pulse w-5/6" />
                <div className="h-3 bg-slate-100 rounded-md animate-pulse w-full" />
                <div className="h-3 bg-slate-100 rounded-md animate-pulse w-3/4" />
              </div>
            )}

            {/* Status: Writing Skeleton */}
            {status === "writing" && (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                  <span>AI sedang menyusun spesifikasi untuk bagian ini...</span>
                </div>
                <div className="h-2.5 bg-indigo-100/50 rounded animate-pulse w-full" />
                <div className="h-2.5 bg-indigo-100/50 rounded animate-pulse w-4/5" />
              </div>
            )}

            {/* Status: Ready State */}
            {status === "ready" && (
              <div className="space-y-3.5">
                {renderedContent ? (
                  <div
                    className="nodrag nowheel text-xs text-slate-700 leading-relaxed max-h-52 overflow-y-auto prose prose-xs prose-slate max-w-none scrollbar-thin scrollbar-thumb-slate-200 select-text"
                    dangerouslySetInnerHTML={{ __html: renderedContent }}
                  />
                ) : (
                  <p className="text-xs text-slate-400 italic">Konten kosong</p>
                )}

                {/* Mermaid Diagram View (FR-EDT-05, FR-EDT-06, FR-EDT-07) */}
                {diagram?.code && (
                  <div className="pt-1">
                    <MermaidView
                      code={diagram.code}
                      sectionId={id}
                      prdId={prdId || undefined}
                      status={diagram.status}
                      onStatusChange={handleDiagramStatusChange}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Status: Failed State */}
            {status === "failed" && (
              <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl space-y-2">
                <div className="flex items-start gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Gagal memproses bagian ini</p>
                    <p className="text-[11px] text-rose-600 mt-0.5">
                      {error?.message ||
                        "Terjadi kesalahan saat memanggil model AI."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
        {isEditing ? (
          <div className="flex items-center gap-2 w-full justify-between">
            <span className="text-[10px] text-slate-400 font-mono">
              rev {baseRev}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditTitle(title);
                  setEditContent(content);
                  setEditDiagramCode(diagram?.code || "");
                  setSaveState("idle");
                }}
                className="nodrag nowheel px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleFinishEditing}
                className="nodrag nowheel px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Selesai</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {status === "failed" ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="nodrag nowheel px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Coba lagi</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    selectNode(id);
                  }}
                  className="nodrag nowheel px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="Buka bilah instruksi AI untuk bagian ini"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Ubah dengan AI</span>
                </button>
              )}

              {/* Edit Button (disabled if pending or writing - FR-EDT-04) */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={(e: any) => {
                  e.stopPropagation();
                  if (canEdit) {
                    setIsEditing(true);
                  }
                }}
                className={cn(
                  "nodrag nowheel px-2 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1",
                  canEdit
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
                    : "text-slate-300 cursor-not-allowed opacity-60"
                )}
                title={
                  canEdit
                    ? "Edit manual judul dan konten"
                    : "Tidak dapat mengedit saat sedang diproses"
                }
              >
                <Pencil className="w-3 h-3 text-slate-400" />
                <span>Edit</span>
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono">
              rev {rev}
            </span>
          </>
        )}
      </div>

      </div>

      {/* Floating Node Instruction Bar (FR-AI-01, Section 8.2) */}
      {selected && status === "ready" && !isEditing && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50">
          <NodeInstructionBar
            sectionId={id}
            sectionTitle={title}
            sectionType={type}
            hasDiagram={Boolean(diagram?.code)}
          />
        </div>
      )}

      {/* Outgoing Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 !bg-indigo-500 border-2 border-white rounded-full hover:!bg-indigo-600 transition-colors shadow-xs"
      />
    </div>
  );
}

export default memo(SectionNode);
