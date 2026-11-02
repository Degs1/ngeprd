"use client";

import React, { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Pencil,
  RotateCcw,
  Code2,
} from "lucide-react";
import { marked } from "marked";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { Section, SectionType, SectionStatus, Diagram } from "@/lib/schemas/prd";
import { cn } from "@/lib/utils";

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
    state.document?.chapters.find((c) => c.id === (storeSection?.chapterId || nodeData.chapterId))
  );
  const sectionNumber = useWorkspaceStore((state) => state.sectionNumberMap.get(id)) || nodeData.number || "1.1";
  const startGeneration = useWorkspaceStore((state) => state.startGeneration);
  const selectNode = useWorkspaceStore((state) => state.selectNode);

  const section: Partial<Section> = storeSection || nodeData;
  const status: SectionStatus = section.status || "pending";
  const title = section.title || nodeData.title || "Section";
  const type = (section.type || nodeData.type || "custom") as string;
  const content = section.content || "";
  const brief = section.brief || nodeData.brief || "";
  const diagram = section.diagram || nodeData.diagram;
  const error = section.error || nodeData.error;

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

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    startGeneration([id]);
  };

  return (
    <div
      onClick={() => selectNode(id)}
      className={cn(
        "relative rounded-2xl border bg-white shadow-sm w-[380px] select-none transition-all duration-200 overflow-hidden flex flex-col",
        selected
          ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50 border-indigo-500 shadow-xl"
          : "hover:shadow-md border-slate-200/90",
        status === "writing" && "border-indigo-400 shadow-indigo-100/50 shadow-lg",
        status === "failed" && "border-rose-300 bg-rose-50/20"
      )}
    >
      {/* Incoming Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 !bg-indigo-500 border-2 border-white rounded-full hover:!bg-indigo-600 transition-colors shadow-xs"
      />

      {/* Chapter Accent Stripe (FR-CNV-10) */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />

      {/* Header (Section 6.4 FR-CNV-05) */}
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
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1 shrink-0">
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
          </div>
        </div>

        {/* Section Title */}
        <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
          {title}
        </h3>

        {/* Chapter Context Label */}
        {storeChapter && (
          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
            Bab: {storeChapter.title}
          </p>
        )}
      </div>

      {/* Body Content based on Status */}
      <div className="p-4 flex-1">
        {/* Status: Pending / Skeleton State */}
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

        {/* Status: Writing State */}
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
          <div className="space-y-3">
            {renderedContent ? (
              <div
                className="text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto prose prose-xs prose-slate max-w-none scrollbar-thin scrollbar-thumb-slate-200"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            ) : (
              <p className="text-xs text-slate-400 italic">Konten kosong</p>
            )}

            {/* Diagram Indicator Badge */}
            {diagram?.code && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-700">Diagram Mermaid:</span>
                <span className="font-mono text-[10px] text-slate-500 truncate flex-1">
                  {diagram.kind}
                </span>
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
                  {error?.message || "Terjadi kesalahan saat memanggil model AI."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer (FR-CNV-05) */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {status === "failed" ? (
            <button
              type="button"
              onClick={handleRetry}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Coba lagi</span>
            </button>
          ) : (
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>Ubah dengan AI</span>
            </button>
          )}

          <button
            type="button"
            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1"
          >
            <Pencil className="w-3 h-3 text-slate-400" />
            <span>Edit</span>
          </button>
        </div>

        <span className="text-[10px] text-slate-400 font-mono">
          rev {section.rev || 1}
        </span>
      </div>

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
