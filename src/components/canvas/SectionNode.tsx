"use client";

import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Pencil,
  RotateCcw,
  Check,
  RefreshCw,
  Layers,
  Code2,
  MessageSquare,
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
  overview: { label: "Ringkasan", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  problem: { label: "Masalah", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  goals: { label: "Tujuan", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  users: { label: "Pengguna", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  features: { label: "Fitur", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  flow: { label: "Alur", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  architecture: { label: "Arsitektur", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  data_model: { label: "Data Model", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  tech_stack: { label: "Tech Stack", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  api: { label: "API", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  security: { label: "Keamanan", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  nfr: { label: "NFR", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  risks: { label: "Risiko", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  roadmap: { label: "Roadmap", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
  custom: { label: "Kustom", color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]" },
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
  const isGenerating = useWorkspaceStore((state) => state.isGenerating);
  const selectNode = useWorkspaceStore((state) => state.selectNode);
  const saveSection = useWorkspaceStore((state) => state.saveSection);
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

  // Inline editing state
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

  // Prevent editing on pending or writing sections
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
    color: "bg-[#101A16] text-[#8FA396] border-[#1F3028]",
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
      // 409 Concurrency Conflict
      setSaveState("conflict");
      setConflictRev(result.currentRev ?? null);
    } else {
      setSaveState("error");
      setSaveErrorMessage(result.error || "Gagal menyimpan perubahan");
    }
  };

  // Schedule autosave with ~800ms debounce
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

  const handleDiagramCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditDiagramCode(val);
    scheduleAutosave(editTitle, editContent, val);
  };

  const handleFinishEditing = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await performSave(editTitle, editContent, editDiagramCode, baseRev);
    setIsEditing(false);
  };

  const handleConflictReload = async () => {
    if (prdId) {
      await useWorkspaceStore.getState().loadPrd(prdId);
      setIsEditing(false);
      setSaveState("idle");
    }
  };

  const handleConflictOverwrite = async () => {
    if (conflictRev !== null) {
      await performSave(editTitle, editContent, editDiagramCode, conflictRev);
    }
  };

  const handleDiagramStatusChange = useCallback(
    async (newStatus: "ok" | "invalid", repairedCode?: string) => {
      if (repairedCode && repairedCode !== diagram?.code) {
        await saveSection(id, baseRev, {
          diagram: {
            kind: "mermaid",
            code: repairedCode,
            status: newStatus,
          },
        });
      }
    },
    [diagram?.code, id, baseRev, saveSection]
  );

  const handleRetry = () => {
    if (isGenerating) return;
    startGeneration([id]);
  };

  const canEdit = status !== "pending" && status !== "writing";

  return (
    <div
      onClick={() => selectNode(id)}
      className={cn(
        "relative rounded-2xl border bg-[#121E19] text-[#EAF0EB] shadow-xl w-[400px] select-none transition-all duration-200 flex flex-col",
        selected
          ? "ring-1 ring-[#8EA690] border-[#8EA690] shadow-2xl"
          : "hover:border-[#355243] border-[#22352B]",
        isRevisionOrigin &&
          "!border-[#8EA690] !ring-1 !ring-[#8EA690] shadow-2xl",
        isRevisionImpacted &&
          "!border-[#D4B36A] !ring-1 !ring-[#D4B36A] shadow-2xl",
        status === "writing" &&
          "border-[#243B4D] shadow-lg",
        status === "failed" && "border-[#442420] bg-[#1a1212]",
        isEditing && "ring-1 ring-[#8EA690] border-[#8EA690] shadow-2xl"
      )}
    >
      <div className="w-full rounded-2xl overflow-hidden flex flex-col flex-1">
        {/* Incoming Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3.5 h-3.5 !bg-[#8EA690] border-2 border-[#121E19] rounded-full hover:!bg-[#A0B8A2] transition-colors shadow-xs"
        />

        {/* Header */}
        <div className="p-4 pb-3 border-b border-[#1F3028] bg-[#15231D]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Dynamic Section Number */}
              <span className="font-mono font-bold text-xs bg-[#162720] text-[#8EA690] border border-[#243D31] px-2 py-0.5 rounded-md shrink-0">
                {sectionNumber}
              </span>

              {/* Type Badge */}
              <span
                className={cn(
                  "text-[10px] font-mono font-medium px-2 py-0.5 rounded border shrink-0 uppercase tracking-wider",
                  typeMeta.color
                )}
              >
                {typeMeta.label}
              </span>

              {/* Revision Role Badge */}
              {isRevisionOrigin && (
                <span className="text-[10px] font-mono font-semibold text-[#8EA690] bg-[#162720] border border-[#243D31] px-2 py-0.5 rounded shrink-0">
                  Origin
                </span>
              )}
              {isRevisionImpacted && (
                <span className="text-[10px] font-mono font-semibold text-[#D4B36A] bg-[#262215] border border-[#3D3520] px-2 py-0.5 rounded shrink-0">
                  Revisi
                </span>
              )}
            </div>

            {/* Status / Save Indicator */}
            <div className="flex items-center gap-1 shrink-0">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  {saveState === "saving" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#D4B36A] bg-[#262215] border border-[#3D3520] px-2 py-0.5 rounded-full animate-pulse">
                      <Loader2 className="w-3 h-3 text-[#D4B36A] animate-spin" />
                      <span>Menyimpan…</span>
                    </span>
                  )}
                  {saveState === "saved" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8EA690] bg-[#162720] border border-[#243D31] px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-[#8EA690]" />
                      <span>Tersimpan</span>
                    </span>
                  )}
                  {saveState === "error" && (
                    <button
                      type="button"
                      onClick={() =>
                        performSave(editTitle, editContent, editDiagramCode, baseRev)
                      }
                      className="nodrag nowheel inline-flex items-center gap-1 text-[11px] font-semibold text-[#D48B80] bg-[#281816] border border-[#442420] px-2 py-0.5 rounded-full hover:bg-[#38201E] transition-colors"
                      title={saveErrorMessage || "Klik untuk mencoba lagi"}
                    >
                      <AlertCircle className="w-3 h-3 text-[#D48B80]" />
                      <span>Gagal, coba lagi</span>
                    </button>
                  )}
                  {saveState === "conflict" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#D4B36A] bg-[#262215] border border-[#3D3520] px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3 text-[#D4B36A]" />
                      <span>Konflik</span>
                    </span>
                  )}
                  {saveState === "idle" && (
                    <span className="text-[10px] font-mono font-medium text-[#8EA690] bg-[#162720] border border-[#243D31] px-2 py-0.5 rounded-full">
                      Mode Edit
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {status === "pending" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#586C61] bg-[#101A16] border border-[#1F3028] px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3 text-[#586C61]" />
                      <span>Pending</span>
                    </span>
                  )}
                  {status === "writing" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#8CB4D9] bg-[#18262F] border border-[#243B4D] px-2 py-0.5 rounded-full animate-pulse">
                      <Loader2 className="w-3 h-3 text-[#8CB4D9] animate-spin" />
                      <span>Menulis...</span>
                    </span>
                  )}
                  {status === "ready" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#8EA690] bg-[#152720] border border-[#243D31] px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-[#8EA690]" />
                      <span>Ready</span>
                    </span>
                  )}
                  {status === "failed" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#D48B80] bg-[#281816] border border-[#442420] px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3 text-[#D48B80]" />
                      <span>Gagal</span>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Section Title: Static or Editable */}
          {isEditing ? (
            <div className="mt-1">
              <input
                type="text"
                value={editTitle}
                onChange={handleTitleChange}
                placeholder="Judul section..."
                className="nodrag nowheel w-full px-2.5 py-1 text-sm font-serif font-bold text-[#EAF0EB] bg-[#0C1310] border border-[#243C30] rounded-lg shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#8EA690] transition-all"
              />
            </div>
          ) : (
            <h3 className="text-sm font-serif font-bold text-[#EAF0EB] leading-snug truncate">
              {title}
            </h3>
          )}

          {/* Chapter Context Label */}
          {storeChapter && (
            <p className="text-[11px] text-[#586C61] font-mono truncate mt-0.5">
              Bab: {storeChapter.title}
            </p>
          )}
        </div>

        {/* 409 Conflict Dialog Banner */}
        {isEditing && saveState === "conflict" && (
          <div className="nodrag nowheel p-3 bg-[#262215] border-b border-[#3D3520] space-y-2 text-xs text-[#D4B36A] animate-in fade-in duration-150">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D4B36A] shrink-0 mt-0.5" />
              <div className="leading-snug">
                <p className="font-bold">Terjadi Konflik Revisi!</p>
                <p className="text-[11px] text-[#8FA396] mt-0.5">
                  Bagian ini telah dimodifikasi di tempat lain (rev saat ini:{" "}
                  <span className="font-mono font-bold text-[#EAF0EB]">{conflictRev ?? "baru"}</span>
                  ). Pilih aksi:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConflictReload}
                className="nodrag nowheel flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#8FA396] bg-[#162620] border border-[#243C30] hover:bg-[#1D3028] hover:text-[#EAF0EB] rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Muat ulang</span>
              </button>

              <button
                type="button"
                onClick={handleConflictOverwrite}
                className="nodrag nowheel flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0C1310] bg-[#D4B36A] hover:bg-[#C0A05A] rounded-lg transition-colors"
              >
                <Layers className="w-3 h-3" />
                <span>Timpa</span>
              </button>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 flex-1 text-[#EAF0EB]">
          {/* EDITING MODE */}
          {isEditing ? (
            <div className="space-y-3">
              {/* Tab selector if diagram exists */}
              {(diagram?.code || editDiagramCode) && (
                <div className="flex items-center gap-1 border-b border-[#1F3028] pb-1.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setEditActiveTab("content")}
                    className={cn(
                      "nodrag nowheel px-2.5 py-1 rounded-md transition-colors",
                      editActiveTab === "content"
                        ? "bg-[#162720] text-[#8EA690] font-semibold border border-[#243D31]"
                        : "text-[#8FA396] hover:text-[#EAF0EB]"
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
                        ? "bg-[#162720] text-[#8EA690] font-semibold border border-[#243D31]"
                        : "text-[#8FA396] hover:text-[#EAF0EB]"
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
                  <label className="text-[11px] font-mono font-medium text-[#8FA396]">
                    Markdown Textarea
                  </label>
                  <textarea
                    value={editContent}
                    onChange={handleContentChange}
                    rows={6}
                    placeholder="Ketik konten spesifikasi markdown di sini..."
                    className="nodrag nowheel w-full text-xs font-mono text-[#EAF0EB] placeholder-[#586C61] p-2.5 bg-[#0C1310] border border-[#243C30] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8EA690] resize-y leading-relaxed"
                  />
                </div>
              ) : (
                /* Diagram Code Editor */
                <div className="space-y-2">
                  <label className="text-[11px] font-mono font-medium text-[#8FA396] flex items-center justify-between">
                    <span>Kode Diagram Mermaid</span>
                    <span className="text-[10px] text-[#586C61] font-mono">
                      flowchart, sequenceDiagram, erDiagram, dsb.
                    </span>
                  </label>
                  <textarea
                    value={editDiagramCode}
                    onChange={handleDiagramCodeChange}
                    rows={5}
                    placeholder="flowchart TD&#10;  A[Mulai] --> B[Selesai]"
                    className="nodrag nowheel w-full text-xs font-mono text-[#EAF0EB] placeholder-[#586C61] p-2.5 bg-[#0C1310] border border-[#243C30] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8EA690] resize-y leading-relaxed"
                  />

                  {/* Live Preview of Diagram */}
                  {editDiagramCode.trim().length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] font-mono font-semibold text-[#586C61] uppercase tracking-wider mb-1">
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
                    <p className="text-xs text-[#8FA396] italic mb-3 leading-relaxed">
                      {brief}
                    </p>
                  ) : null}
                  <div className="h-3 bg-[#162720] border border-[#1F3028] rounded animate-pulse w-5/6" />
                  <div className="h-3 bg-[#162720] border border-[#1F3028] rounded animate-pulse w-full" />
                  <div className="h-3 bg-[#162720] border border-[#1F3028] rounded animate-pulse w-3/4" />
                </div>
              )}

              {/* Status: Writing Skeleton */}
              {status === "writing" && (
                <div className="space-y-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#8CB4D9] bg-[#18262F] border border-[#243B4D] p-2.5 rounded-xl">
                    <Loader2 className="w-4 h-4 text-[#8CB4D9] animate-spin shrink-0" />
                    <span>AI sedang menyusun spesifikasi untuk bagian ini...</span>
                  </div>
                  <div className="h-2.5 bg-[#162720] rounded animate-pulse w-full" />
                  <div className="h-2.5 bg-[#162720] rounded animate-pulse w-4/5" />
                </div>
              )}

              {/* Status: Ready State */}
              {status === "ready" && (
                <div className="space-y-3.5">
                  {renderedContent ? (
                    <div
                      className="nodrag nowheel text-xs text-[#C5D8C7] leading-relaxed max-h-56 overflow-y-auto prose prose-invert prose-xs max-w-none select-text"
                      dangerouslySetInnerHTML={{ __html: renderedContent }}
                    />
                  ) : (
                    <p className="text-xs text-[#586C61] italic">Konten kosong</p>
                  )}

                  {/* Mermaid Diagram View */}
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
                <div className="p-3 bg-[#281816] border border-[#442420] rounded-xl space-y-2">
                  <div className="flex items-start gap-2 text-[#D48B80] text-xs">
                    <AlertCircle className="w-4 h-4 text-[#D48B80] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Gagal memproses bagian ini</p>
                      <p className="text-[11px] text-[#D48B80] mt-0.5 opacity-90">
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
        <div className="px-4 py-2.5 bg-[#101A16] border-t border-[#1F3028] flex items-center justify-between text-xs">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-[10px] text-[#586C61] font-mono">
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
                  className="nodrag nowheel px-2.5 py-1 text-xs font-medium text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] border border-[#22352B] rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleFinishEditing}
                  className="nodrag nowheel px-3 py-1 text-xs font-semibold text-[#0C1310] bg-[#8EA690] hover:bg-[#7D967F] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                    disabled={isGenerating}
                    className={cn(
                      "nodrag nowheel px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs",
                      isGenerating
                        ? "bg-[#192A22] text-[#586C61] cursor-not-allowed opacity-60"
                        : "text-[#D48B80] bg-[#281816] hover:bg-[#38201E] border border-[#442420] cursor-pointer"
                    )}
                    title={isGenerating ? "Proses generate sedang berjalan..." : "Coba generate ulang bagian ini"}
                  >
                    <RotateCcw className={cn("w-3 h-3", isGenerating && "animate-spin")} />
                    <span>{isGenerating ? "Sedang generate..." : "Coba lagi"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e: any) => {
                      e.stopPropagation();
                      selectNode(id);
                    }}
                    className="nodrag nowheel px-2.5 py-1 text-xs font-semibold text-[#8EA690] bg-[#162720] hover:bg-[#1D332A] border border-[#243D31] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Buka bilah instruksi AI untuk bagian ini"
                  >
                    <MessageSquare className="w-3 h-3 text-[#8EA690]" />
                    <span>Ubah dengan AI</span>
                  </button>
                )}

                {/* Edit Button */}
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
                      ? "text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#162620] cursor-pointer"
                      : "text-[#586C61] cursor-not-allowed opacity-50"
                  )}
                  title={
                    canEdit
                      ? "Edit manual judul dan konten"
                      : "Tidak dapat mengedit saat sedang diproses"
                  }
                >
                  <Pencil className="w-3 h-3 text-[#586C61]" />
                  <span>Edit</span>
                </button>
              </div>

              <span className="text-[10px] text-[#586C61] font-mono">
                rev {rev}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Floating Node Instruction Bar */}
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
        className="w-3.5 h-3.5 !bg-[#8EA690] border-2 border-[#121E19] rounded-full hover:!bg-[#A0B8A2] transition-colors shadow-xs"
      />
    </div>
  );
}

export default memo(SectionNode);
