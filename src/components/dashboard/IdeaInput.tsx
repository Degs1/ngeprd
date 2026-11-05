"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowUp,
  Loader2,
  Lightbulb,
  AlertCircle,
  Shield,
  LogIn,
} from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

const SAMPLE_IDEAS = [
  {
    tag: "MARKETPLACE",
    text: "Web marketplace jasa cuci sepatu berbasis lokasi dengan payment gateway dan pelacakan status pesanan real-time",
  },
  {
    tag: "POINT OF SALE",
    text: "Aplikasi POS kasir kafe offline-first untuk tablet dengan sinkronisasi cloud dan cetak struk bluetooth",
  },
  {
    tag: "MANAGEMENT SAAS",
    text: "SaaS manajemen kos & kontrakan dengan invoice otomatis via WhatsApp dan laporan laba-rugi",
  },
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

  const handleSelectSample = (sampleText: string) => {
    setIdea(sampleText);
    setError(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full flex flex-col gap-5 text-left">
      {/* Input container */}
      <div
        className={cn(
          "relative rounded-2xl bg-[#121E19] border transition-all p-4 sm:p-5 shadow-xl",
          error
            ? "border-[#442420] ring-1 ring-[#D48B80]"
            : isQuotaExhausted
            ? "border-[#3D3520] bg-[#161c16]"
            : "border-[#22352B] focus-within:border-[#355243]"
        )}
      >
        {/* Top subtle quota / login pill */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1F3028] text-[11px]">
          <div className="flex items-center gap-1.5 text-[#8FA396]">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-[#8EA690] uppercase">
              Spesifikasi PRD
            </span>
          </div>

          <div className="shrink-0">
            {!isAuthenticated ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#162720] border border-[#22352B] text-[#8FA396] font-mono text-[10px]">
                <LogIn className="w-3 h-3 text-[#8EA690]" />
                <span>Login diperlukan</span>
              </span>
            ) : quota?.isAdmin ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#262215] text-[#D4B36A] border border-[#3D3520] font-mono text-[10px] font-medium">
                <Shield className="w-3 h-3 text-[#D4B36A]" />
                <span>Admin • Unlimited PRD</span>
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px]",
                  isQuotaExhausted
                    ? "bg-[#281816] text-[#D48B80] border border-[#442420]"
                    : "bg-[#162720] text-[#8EA690] border border-[#243D31]"
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
          className="w-full resize-none border-0 bg-transparent p-0 text-[#EAF0EB] placeholder-[#586C61] text-sm sm:text-base focus:outline-none focus:ring-0 leading-relaxed disabled:opacity-60 min-h-[90px] sm:min-h-[110px]"
        />

        {/* Action bar below textarea */}
        <div className="mt-3 pt-3 flex items-center justify-between gap-2 border-t border-[#1F3028] text-xs">
          <div className="flex items-center gap-2 text-[#586C61] min-w-0">
            <span className="hidden sm:inline text-[11px]">
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-[#162720] border border-[#243D31] font-mono text-[10px] text-[#8FA396]">Enter</kbd> untuk kirim, <kbd className="px-1.5 py-0.5 rounded bg-[#162720] border border-[#243D31] font-mono text-[10px] text-[#8FA396]">Shift+Enter</kbd> baris baru
            </span>
            <span className="sm:hidden text-[11px] text-[#586C61]">Min. 10 karakter</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              className={cn(
                "text-xs transition-colors font-mono",
                charCount === 0
                  ? "text-[#586C61]"
                  : charCount < 10 || charCount > 2000
                  ? "text-[#D4B36A] font-medium"
                  : "text-[#8FA396]"
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
                  ? "bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] cursor-pointer active:scale-95"
                  : isQuotaExhausted
                  ? "bg-[#192A22] text-[#586C61] cursor-not-allowed"
                  : canSubmit
                  ? "bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] cursor-pointer active:scale-95"
                  : "bg-[#192A22] text-[#586C61] cursor-not-allowed"
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
                <Loader2 className="w-4 h-4 animate-spin text-[#0C1310]" />
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
        <div className="flex items-center gap-2 p-3 text-xs text-[#D48B80] bg-[#281816] border border-[#442420] rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quota Exhausted warning banner */}
      {isQuotaExhausted && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#262215] border border-[#3D3520] text-[#D4B36A] text-xs">
          <AlertCircle className="w-4 h-4 text-[#D4B36A] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">Batas Kuota Harian Tercapai (3 / 3 PRD)</span>
            <span className="text-[#8FA396] leading-relaxed">
              Pengguna gratis dibatasi 3 PRD per hari. Kuota Anda akan diperbarui kembali besok pukul 00:00, atau Anda dapat menghubungi admin.
            </span>
          </div>
        </div>
      )}

      {/* Sample Ideas */}
      <div className="flex flex-col gap-2.5 pt-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#8FA396]">
          <Lightbulb className="w-3.5 h-3.5 text-[#8EA690]" />
          <span>Contoh ide spesifikasi:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SAMPLE_IDEAS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting || isQuotaExhausted}
              onClick={() => handleSelectSample(sample.text)}
              className="text-left p-3.5 rounded-xl border border-[#22352B] bg-[#121E19] hover:bg-[#162620] hover:border-[#355243] active:bg-[#1A2C24] transition-all text-xs text-[#8FA396] hover:text-[#EAF0EB] group shadow-2xs disabled:opacity-50 cursor-pointer flex flex-col gap-2"
            >
              <span className="font-mono text-[10px] font-semibold text-[#8EA690] bg-[#162720] border border-[#243D31] px-2 py-0.5 rounded w-fit tracking-wider uppercase">
                {sample.tag}
              </span>
              <span className="line-clamp-3 leading-relaxed text-[#8FA396] group-hover:text-[#EAF0EB] transition-colors">
                {sample.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
