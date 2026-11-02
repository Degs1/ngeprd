"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowUp,
  Loader2,
  Sparkles,
  Lightbulb,
  AlertCircle,
  Shield,
  LogIn,
} from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

const SAMPLE_IDEAS = [
  "Web marketplace jasa cuci sepatu berbasis lokasi dengan payment gateway dan pelacakan status pesanan real-time",
  "Aplikasi POS kasir kafe offline-first untuk tablet dengan sinkronisasi cloud dan cetak struk bluetooth",
  "SaaS manajemen kos & kontrakan dengan invoice otomatis via WhatsApp dan laporan laba-rugi",
];

export default function IdeaInput() {
  const router = useRouter();
  const { status } = useSession();
  const { quota, fetchUserQuota } = useUserStore();
  const { createPrd } = usePrdStore();

  const [idea, setIdea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAuthenticated = status === "authenticated";
  const isQuotaExhausted = !quota?.isAdmin && (quota?.remaining ?? 3) <= 0;

  const charCount = idea.trim().length;
  const isValidLength = charCount >= 10 && charCount <= 2000;
  const canSubmit = isValidLength && !isSubmitting && (!isAuthenticated || !isQuotaExhausted);

  // Focus and restore draft on mount
  useEffect(() => {
    textareaRef.current?.focus();
    fetchUserQuota();

    try {
      const draft = localStorage.getItem("ngeprd_draft_idea");
      if (draft && draft.trim().length > 0) {
        setIdea(draft.trim());
        localStorage.removeItem("ngeprd_draft_idea");
      }
    } catch {
      // localStorage may fail in edge private modes
    }
  }, [fetchUserQuota]);

  const handleSubmit = async () => {
    if (!isValidLength || isSubmitting) return;

    // If not authenticated, save draft and redirect to login
    if (!isAuthenticated) {
      try {
        localStorage.setItem("ngeprd_draft_idea", idea.trim());
      } catch {}
      router.push("/login?callbackUrl=/");
      return;
    }

    if (isQuotaExhausted) {
      setError("Batas harian 3 PRD untuk pengguna gratis telah tercapai hari ini. Kuota akan direset besok.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const id = await createPrd(idea.trim(), "id");
      if (id) {
        await fetchUserQuota();
        router.push(`/prd/${id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat PRD. Silakan coba lagi.";
      setError(msg);
      setIsSubmitting(false);
      fetchUserQuota();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectSample = (sample: string) => {
    setIdea(sample);
    setError(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full flex flex-col gap-4 text-left">
      {/* Input container */}
      <div
        className={cn(
          "relative rounded-2xl bg-white border shadow-md transition-all p-3.5 sm:p-4.5",
          error
            ? "border-rose-300 ring-2 ring-rose-100"
            : isQuotaExhausted
            ? "border-amber-300 bg-amber-50/20"
            : "border-slate-200/80 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/60"
        )}
      >
        {/* Top subtle quota / login pill: stacks gracefully on narrow mobile */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 pb-2.5 mb-2.5 border-b border-slate-100 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-medium truncate">AI Product Requirement Document</span>
          </div>

          <div className="shrink-0">
            {!isAuthenticated ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                <LogIn className="w-3 h-3" />
                <span>Login diperlukan</span>
              </span>
            ) : quota?.isAdmin ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                <Shield className="w-3 h-3 text-amber-600" />
                <span>Admin • Unlimited PRD</span>
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium",
                  isQuotaExhausted
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                )}
              >
                <span>Sisa kuota: {quota?.remaining ?? 3} / {quota?.limit ?? 3} PRD hari ini</span>
              </span>
            )}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting || isQuotaExhausted}
          rows={3}
          placeholder={
            isQuotaExhausted
              ? "Batas harian 3 PRD telah tercapai untuk hari ini. Silakan kembali lagi besok."
              : "Ceritakan ide proyek atau produkmu secara detail... (minimal 10 karakter)"
          }
          className="w-full resize-none border-0 bg-transparent p-0 text-slate-800 placeholder-slate-400 text-sm sm:text-base focus:outline-none focus:ring-0 leading-relaxed disabled:opacity-60 min-h-[90px] sm:min-h-[110px]"
        />

        {/* Action bar below textarea */}
        <div className="mt-3 pt-3 flex items-center justify-between gap-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-400 min-w-0">
            <span className="hidden sm:inline text-[11px]">
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Enter</kbd> untuk kirim, <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Shift+Enter</kbd> baris baru
            </span>
            <span className="sm:hidden text-[11px] text-slate-400">Min. 10 karakter</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              className={cn(
                "text-xs transition-colors font-mono",
                charCount === 0
                  ? "text-slate-300"
                  : charCount < 10 || charCount > 2000
                  ? "text-amber-600 font-medium"
                  : "text-slate-400"
              )}
            >
              {charCount} / 2000
            </span>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={cn(
                "min-h-[38px] py-2 px-3.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all shadow-xs",
                !isAuthenticated
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                  : isQuotaExhausted
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : canSubmit
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
              title={
                !isAuthenticated
                  ? "Masuk untuk membuat PRD"
                  : isQuotaExhausted
                  ? "Batas harian 3 PRD tercapai hari ini"
                  : charCount < 10
                  ? "Masukkan minimal 10 karakter"
                  : charCount > 2000
                  ? "Maksimal 2000 karakter"
                  : "Kirim ide dan buat PRD"
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : !isAuthenticated ? (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk & Bikin</span>
                </>
              ) : (
                <>
                  <span>Bikin PRD</span>
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quota Exhausted warning banner */}
      {isQuotaExhausted && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">Batas Kuota Harian Tercapai (3 / 3 PRD)</span>
            <span className="text-amber-800 leading-relaxed">
              Pengguna gratis dibatasi 3 PRD per hari. Kuota Anda akan diperbarui kembali besok pukul 00:00, atau Anda dapat menghubungi admin.
            </span>
          </div>
        </div>
      )}

      {/* Sample Ideas */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Atau coba salah satu ide contoh ini:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SAMPLE_IDEAS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting || isQuotaExhausted}
              onClick={() => handleSelectSample(sample)}
              className="text-left p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-indigo-50/50 hover:border-indigo-200 active:bg-indigo-50 transition-all text-xs text-slate-700 hover:text-indigo-900 group shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="line-clamp-3 leading-relaxed">{sample}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
