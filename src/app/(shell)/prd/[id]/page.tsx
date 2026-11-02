"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
  Pencil,
  Check,
  X,
} from "lucide-react";
import StatusChip from "@/components/dashboard/StatusChip";
import { usePrdStore, type PrdStatus } from "@/store/usePrdStore";
import { cn } from "@/lib/utils";

interface PrdDetail {
  _id: string;
  title: string;
  idea: string;
  lang: "id" | "en";
  status: PrdStatus;
  brainstorm?: {
    questions?: Array<{ id: string; text: string; options: string[] }>;
    answers?: Array<{ questionId: string; value: string; isCustom: boolean }>;
  };
  keyDecisions?: string[];
  chapters?: Array<{ id: string; title: string; order: number }>;
  sections?: Array<{ id: string; title: string; type: string; status: string }>;
  lastError?: { code: string; message: string; stage: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function PrdWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { renamePrd } = usePrdStore();

  const [prd, setPrd] = useState<PrdDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline title editing in TopBar
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const fetchPrd = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prds/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("PRD tidak ditemukan atau telah dihapus");
        }
        throw new Error(`Gagal memuat dokumen PRD (${res.statusText})`);
      }
      const data = await res.json();
      setPrd(data);
      setEditedTitle(data.title);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat PRD";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrd();
  }, [fetchPrd]);

  const handleSaveTitle = async () => {
    if (!prd || !editedTitle.trim() || isSavingTitle) return;
    setIsSavingTitle(true);
    try {
      const ok = await renamePrd(prd._id, editedTitle.trim());
      if (ok) {
        setPrd((prev) => (prev ? { ...prev, title: editedTitle.trim() } : prev));
        setIsEditingTitle(false);
      }
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Loading view
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-700">Memuat dokumen PRD...</p>
        <p className="text-xs text-slate-400 mt-1">Mengambil data arsitektur & status...</p>
      </div>
    );
  }

  // Error / Not Found view
  if (error || !prd) {
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
            onClick={() => fetchPrd()}
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

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* TopBar (Section 8.2) */}
      <header className="h-14 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

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
                    setEditedTitle(prd.title);
                  }
                }}
                autoFocus
                disabled={isSavingTitle}
                className="px-2.5 py-1 text-sm font-semibold border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-64 md:w-80"
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
                  setEditedTitle(prd.title);
                }}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 group">
              <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">
                {prd.title}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setEditedTitle(prd.title);
                  setIsEditingTitle(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded transition-opacity"
                title="Ganti judul"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <StatusChip status={prd.status} size="md" />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPrd}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Muat ulang status"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Placeholder views by status */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Status 1: Brainstorming */}
          {prd.status === "brainstorming" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Fase Brainstorming
                  </h2>
                  <p className="text-xs text-slate-500">
                    AI merumuskan pertanyaan arsitektur dan klarifikasi kebutuhan
                  </p>
                </div>
              </div>

              {/* Idea card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 mb-6">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ide Proyek
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{prd.idea}</p>
              </div>

              {/* Status details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl border border-slate-200/70 bg-white flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      Pertanyaan AI
                    </div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">
                      {prd.brainstorm?.questions?.length || 0} Pertanyaan
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {prd.brainstorm?.answers?.length || 0} telah dijawab
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 bg-white flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      Status Alur
                    </div>
                    <div className="text-base font-bold text-slate-800 mt-0.5">
                      Menunggu Brainstorm
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Siap masuk ke wizard pertanyaan
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Workspace siap untuk wizard brainstorming (FR-BRN). Jawaban Anda akan membantu AI menghasilkan PRD yang akurat.
                </span>
              </div>
            </div>
          )}

          {/* Status 2: Generating */}
          {prd.status === "generating" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Sedang Menyusun PRD...
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pipeline Planner & Section Writer sedang memproses dokumen
                  </p>
                </div>
              </div>

              {/* Progress skeleton bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>Proses generate dokumen</span>
                  <span className="font-semibold text-indigo-600 animate-pulse">
                    Memproses section...
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full animate-pulse w-2/3 transition-all" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 mb-6">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ide Proyek
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{prd.idea}</p>
              </div>

              <p className="text-xs text-slate-500">
                Dokumen disimpan secara inkremental ke MongoDB. Refresh tidak akan menghilangkan kemajuan yang sudah selesai.
              </p>
            </div>
          )}

          {/* Status 3: Ready */}
          {prd.status === "ready" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    PRD Siap Ditinjau
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dokumen spesifikasi lengkap telah dibuat dan tersimpan
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs font-semibold text-slate-500">Bab Dokumen</div>
                  <div className="text-xl font-bold text-slate-800 mt-1">
                    {prd.chapters?.length || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs font-semibold text-slate-500">Total Section</div>
                  <div className="text-xl font-bold text-slate-800 mt-1">
                    {prd.sections?.length || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs font-semibold text-slate-500">Keputusan Kunci</div>
                  <div className="text-xl font-bold text-slate-800 mt-1">
                    {prd.keyDecisions?.length || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 mb-6">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ide Proyek
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{prd.idea}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                >
                  Tinjau di Canvas
                </button>
              </div>
            </div>
          )}

          {/* Status 4: Failed */}
          {prd.status === "failed" && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-xs p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-rose-900">
                    Proses Gagal
                  </h2>
                  <p className="text-xs text-rose-600">
                    Terjadi kendala saat memproses dokumen PRD ini
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/70 mb-6">
                <div className="text-xs font-semibold text-rose-800 mb-1">
                  Pesan Kesalahan:
                </div>
                <p className="text-sm text-rose-700">
                  {prd.lastError?.message ||
                    "Dokumen mengalami kegagalan proses. Silakan coba kembali."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchPrd()}
                  className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
