"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Sparkles, Lightbulb, AlertCircle } from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import { cn } from "@/lib/utils";

const SAMPLE_IDEAS = [
  "Web marketplace jasa cuci sepatu berbasis lokasi dengan payment gateway dan pelacakan status pesanan real-time",
  "Aplikasi POS kasir kafe offline-first untuk tablet dengan sinkronisasi cloud dan cetak struk bluetooth",
  "SaaS manajemen kos & kontrakan dengan invoice otomatis via WhatsApp dan laporan laba-rugi",
];

export default function IdeaInput() {
  const router = useRouter();
  const { createPrd } = usePrdStore();
  const [idea, setIdea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = idea.trim().length;
  const isValidLength = charCount >= 10 && charCount <= 2000;
  const canSubmit = isValidLength && !isSubmitting;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const id = await createPrd(idea.trim(), "id");
      if (id) {
        router.push(`/prd/${id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat PRD. Silakan coba lagi.";
      setError(msg);
      setIsSubmitting(false);
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
    <div className="w-full flex flex-col gap-4">
      {/* Input container */}
      <div
        className={cn(
          "relative rounded-2xl bg-white border shadow-md transition-all p-4",
          error
            ? "border-rose-300 ring-2 ring-rose-100"
            : "border-slate-200/80 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/60"
        )}
      >
        <textarea
          ref={textareaRef}
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
          rows={4}
          placeholder="Ceritakan ide proyek atau produkmu secara detail... (minimal 10 karakter)"
          className="w-full resize-none border-0 bg-transparent p-0 text-slate-800 placeholder-slate-400 text-sm md:text-base focus:outline-none focus:ring-0 leading-relaxed"
        />

        {/* Action bar below textarea */}
        <div className="mt-3 pt-3 flex items-center justify-between border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="hidden sm:inline">
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-600">Enter</kbd> untuk kirim, <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-600">Shift+Enter</kbd> baris baru
            </span>
            <span className="sm:hidden">Min. 10 karakter</span>
          </div>

          <div className="flex items-center gap-3">
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
                "p-2.5 rounded-xl flex items-center justify-center transition-all shadow-sm",
                canSubmit
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
              title={
                charCount < 10
                  ? "Masukkan minimal 10 karakter"
                  : charCount > 2000
                  ? "Maksimal 2000 karakter"
                  : "Kirim ide dan buat PRD"
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
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

      {/* Sample Ideas (FR-DASH-08) */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Atau coba salah satu ide contoh ini:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {SAMPLE_IDEAS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectSample(sample)}
              className="text-left p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-xs text-slate-700 hover:text-indigo-900 group shadow-xs disabled:opacity-50"
            >
              <div className="flex items-start gap-2">
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
