"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Copy,
  Download,
  RotateCw,
  Check,
  FileText,
  Loader2,
  AlertCircle,
  Eye,
  Code2,
  Sparkles,
} from "lucide-react";
import { marked } from "marked";
import { useCanvasStore } from "@/store/useCanvasStore";
import { cn } from "@/lib/utils";

export interface PrdDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  markdown?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRegenerate?: () => void;
}

export default function PrdDrawer({
  isOpen: propsIsOpen,
  onClose: propsOnClose,
  markdown: propsMarkdown,
  isLoading: propsIsLoading,
  error: propsError,
  onRegenerate: propsOnRegenerate,
}: PrdDrawerProps) {
  // Zustand store fallbacks if props not explicitly provided
  const storeIsOpen = useCanvasStore((state) => state.isPrdDrawerOpen);
  const setStoreIsOpen = useCanvasStore((state) => state.setPrdDrawerOpen);
  const storeMarkdown = useCanvasStore((state) => state.prdMarkdown);
  const storeIsLoading = useCanvasStore((state) => state.isGeneratingPrd);
  const storeError = useCanvasStore((state) => state.prdError);
  const storeGeneratePrd = useCanvasStore((state) => state.generatePrd);
  const activeIdea = useCanvasStore((state) => state.getActiveIdea());

  const isOpen = propsIsOpen !== undefined ? propsIsOpen : storeIsOpen;
  const markdown = propsMarkdown !== undefined ? propsMarkdown : storeMarkdown;
  const isLoading = propsIsLoading !== undefined ? propsIsLoading : storeIsLoading;
  const error = propsError !== undefined ? propsError : storeError;

  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview");
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    if (propsOnClose) {
      propsOnClose();
    } else {
      setStoreIsOpen(false);
    }
  }, [propsOnClose, setStoreIsOpen]);

  const handleRegenerate = useCallback(() => {
    if (propsOnRegenerate) {
      propsOnRegenerate();
    } else {
      storeGeneratePrd();
    }
  }, [propsOnRegenerate, storeGeneratePrd]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Convert markdown to HTML safely with marked
  const renderedHtml = useMemo(() => {
    if (!markdown) return "";
    try {
      return marked.parse(markdown, {
        gfm: true,
        breaks: true,
      }) as string;
    } catch (err) {
      console.error("Error parsing markdown:", err);
      return `<pre>${markdown}</pre>`;
    }
  }, [markdown]);

  // Copy to clipboard with fallback and toast feedback
  const handleCopy = async () => {
    if (!markdown) return;

    try {
      let copiedViaExec = false;
      try {
        const textArea = document.createElement("textarea");
        textArea.value = markdown;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copiedViaExec = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        // ignore execCommand failure
      }

      if (!copiedViaExec && typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await Promise.race([
            navigator.clipboard.writeText(markdown),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 300)),
          ]);
        } catch {
          // ignore clipboard API error
        }
      }
    } catch (err) {
      console.error("Failed to copy markdown to clipboard:", err);
    }

    setCopied(true);
    setShowToast(true);

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      setShowToast(false);
    }, 5000);
  };

  // Download prd.md file
  const handleDownload = () => {
    if (!markdown) return;

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prd.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Drawer Overlay Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
        aria-hidden={!isOpen}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl bg-white shadow-2xl flex flex-col border-l border-slate-200 ",
          isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="PRD Preview"
      >
        {/* Drawer Header */}
        <div className="flex flex-col border-b border-slate-200 bg-slate-50/80 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    PRD Preview
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    prd.md
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate" title={activeIdea}>
                  {activeIdea || "Spesifikasi Dokumen PRD"}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Tutup Preview (Esc)"
              aria-label="Tutup preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/60">
            {/* View Tab Toggle */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer",
                  activeTab === "preview"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer",
                  activeTab === "raw"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Raw Markdown</span>
              </button>
            </div>

            {/* Export & Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Regenerate Button */}
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium rounded-lg border border-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Generate ulang PRD dari kanvas"
              >
                <RotateCw
                  className={cn("w-3.5 h-3.5 text-indigo-600", isLoading && "animate-spin")}
                />
                <span className="hidden sm:inline">Regenerate</span>
              </button>

              {/* Copy Markdown Button */}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!markdown || isLoading}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border shadow-xs transition-all cursor-pointer disabled:opacity-50",
                  copied
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                )}
                title="Salin Markdown ke clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>

              {/* Download .md Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!markdown || isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                title="Download file prd.md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white relative">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600 shadow-xs">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">
                Menyusun Dokumen PRD...
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-6">
                AI sedang mengompilasi pilihan arsitektur, user flow, kriteria MVP, dan daftar task implementasi yang siap dieksekusi.
              </p>

              {/* Skeleton loading preview */}
              <div className="w-full max-w-lg space-y-3 opacity-60">
                <div className="h-6 bg-slate-200 rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
                <div className="h-24 bg-slate-50 rounded-xl border border-slate-200/80 p-3 animate-pulse mt-4" />
                <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" />
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 text-rose-800 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-rose-900 mb-1">
                    Gagal Menyusun PRD
                  </h4>
                  <p className="text-xs text-rose-700 mb-3">{error}</p>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ready Markdown Content */}
          {!isLoading && markdown && (
            <>
              {activeTab === "preview" ? (
                <article
                  className={cn(
                    "prose prose-slate max-w-none text-slate-800 leading-relaxed",
                    "prose-headings:font-bold prose-headings:text-slate-900",
                    "prose-h1:text-2xl prose-h1:border-b prose-h1:border-slate-200 prose-h1:pb-3 prose-h1:mb-4",
                    "prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2 prose-h2:mt-6 prose-h2:mb-3",
                    "prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-indigo-950",
                    "prose-p:text-sm prose-p:my-2 prose-p:leading-normal",
                    "prose-ul:text-sm prose-ul:my-2 prose-li:my-0.5",
                    "prose-ol:text-sm prose-ol:my-2 prose-li:my-0.5",
                    "prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50/40 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:text-slate-700 prose-blockquote:not-italic prose-blockquote:text-sm",
                    "prose-code:text-xs prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-indigo-700 prose-code:font-mono",
                    "prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:text-xs",
                    "prose-table:w-full prose-table:text-xs prose-table:my-4 prose-table:border-collapse",
                    "prose-th:bg-slate-100 prose-th:p-2.5 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-slate-200",
                    "prose-td:p-2.5 prose-td:border prose-td:border-slate-200 prose-td:text-slate-700",
                    "prose-hr:border-slate-200 prose-hr:my-6"
                  )}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed select-text border border-slate-800">
                    {markdown}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* Empty fallback if no markdown and not loading */}
          {!isLoading && !markdown && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <Sparkles className="w-8 h-8 text-indigo-400 mb-2 opacity-60" />
              <p className="text-sm font-medium text-slate-700">
                Belum ada PRD yang dibuat
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Klik tombol di bawah untuk membuat dokumen PRD dari jawaban kanvasmu.
              </p>
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Generate PRD Sekarang</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Floating Toast Notification on Copy */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-full shadow-2xl border border-slate-700 transition-all animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-slate-900">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
          <span>Disalin ke clipboard!</span>
        </div>
      )}
    </>
  );
}
