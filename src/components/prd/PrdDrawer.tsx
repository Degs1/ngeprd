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
  AlertTriangle,
  Eye,
  Code2,
} from "lucide-react";
import { marked } from "marked";
import { generateSlug } from "@/lib/converter/docToMarkdown";
import { cn } from "@/lib/utils";

export interface PrdDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  docId?: string;
  docTitle?: string;
  docStatus?: string;
  markdown?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRegenerate?: () => void;
  pendingOrFailedCount?: number;
}

export default function PrdDrawer({
  isOpen = false,
  onClose,
  docId,
  docTitle,
  docStatus = "ready",
  markdown = null,
  isLoading = false,
  error = null,
  onRegenerate,
  pendingOrFailedCount = 0,
}: PrdDrawerProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview");
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const slug = useMemo(() => generateSlug(docTitle || "prd"), [docTitle]);
  const filename = `${slug}.md`;
  const isReady = docStatus === "ready";

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

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
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = markdown;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      setShowToast(true);

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        setShowToast(false);
      }, 2500);
    } catch (err) {
      console.error("Gagal menyalin markdown:", err);
    }
  };

  // Download markdown file (.md)
  const handleDownload = () => {
    if (!markdown || !isReady) return;

    try {
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mendownload markdown:", err);
      const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      {/* Drawer Overlay Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
        aria-hidden={!isOpen}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl bg-[#121E19] text-[#EAF0EB] shadow-2xl flex flex-col border-l border-[#22352B] transition-transform duration-300",
          isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="PRD Preview"
      >
        {/* Drawer Header */}
        <div className="flex flex-col border-b border-[#1F3028] bg-[#101A16] px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#162720] border border-[#243D31] flex items-center justify-center text-[#8EA690] shadow-xs shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-serif font-bold text-[#EAF0EB] leading-tight truncate">
                    PRD Preview
                  </h2>
                  <span className="hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#162720] text-[#8EA690] border border-[#243D31] truncate max-w-[200px]">
                    {filename}
                  </span>
                </div>
                <p className="text-xs text-[#8FA396] truncate" title={docTitle}>
                  {docTitle || "Spesifikasi Dokumen PRD"}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-xl text-[#586C61] hover:text-[#EAF0EB] hover:bg-[#162620] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Tutup Preview (Esc)"
              aria-label="Tutup preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#1F3028]">
            {/* View Tab Toggle */}
            <div className="flex items-center bg-[#0C1310] border border-[#1F3028] p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md transition-all cursor-pointer",
                  activeTab === "preview"
                    ? "bg-[#162620] text-[#EAF0EB] shadow-xs font-semibold"
                    : "text-[#8FA396] hover:text-[#EAF0EB]"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md transition-all cursor-pointer",
                  activeTab === "raw"
                    ? "bg-[#162620] text-[#EAF0EB] shadow-xs font-semibold"
                    : "text-[#8FA396] hover:text-[#EAF0EB]"
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Raw</span>
              </button>
            </div>

            {/* Export & Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Optional Regenerate Button */}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#162620] text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#1D3028] text-xs font-medium rounded-lg border border-[#22352B] transition-all cursor-pointer disabled:opacity-50"
                  title="Generate ulang PRD dari kanvas"
                >
                  <RotateCw
                    className={cn("w-3.5 h-3.5 text-[#8EA690]", isLoading && "animate-spin")}
                  />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              )}

              {/* Copy Markdown Button */}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!markdown || isLoading}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer disabled:opacity-50",
                  copied
                    ? "bg-[#162720] text-[#8EA690] border-[#243D31] font-semibold"
                    : "bg-[#162620] text-[#8FA396] hover:text-[#EAF0EB] border-[#22352B] hover:bg-[#1D3028]"
                )}
                title="Salin Markdown ke clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#8EA690]" />
                    <span>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8FA396]" />
                    <span className="hidden xs:inline">Salin Markdown</span>
                    <span className="xs:hidden">Salin</span>
                  </>
                )}
              </button>

              {/* Download .md Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!markdown || isLoading || !isReady}
                title={
                  !isReady
                    ? "PRD harus berstatus ready untuk didownload"
                    : `Download file ${filename}`
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer",
                  isReady && markdown && !isLoading
                    ? "bg-[#8EA690] hover:bg-[#7D967F] active:scale-95 text-[#0C1310]"
                    : "bg-[#192A22] text-[#586C61] border border-[#22352B] cursor-not-allowed opacity-60"
                )}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Unduh .md</span>
                <span className="xs:hidden">Unduh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#0C1310] relative text-[#EAF0EB]">
          {/* Status Warning Banner if not ready */}
          {!isReady && (
            <div className="flex items-center gap-2.5 p-3.5 bg-[#262215] border border-[#3D3520] text-[#D4B36A] rounded-xl text-xs mb-4">
              <AlertCircle className="w-4 h-4 text-[#D4B36A] shrink-0" />
              <span>
                Dokumen PRD saat ini berstatus <strong>{docStatus}</strong>. PRD harus berstatus <strong>ready</strong> untuk dapat diekspor.
              </span>
            </div>
          )}

          {/* Warning Banner if pending/failed sections exist */}
          {pendingOrFailedCount > 0 && (
            <div className="flex items-center gap-2.5 p-3.5 bg-[#262215]/80 border border-[#3D3520] text-[#D4B36A] rounded-xl text-xs mb-4">
              <AlertTriangle className="w-4 h-4 text-[#D4B36A] shrink-0" />
              <span>
                Perhatian: Terdapat <strong>{pendingOrFailedCount}</strong> section yang belum selesai atau gagal. Section tersebut dihilangkan dari file ekspor.
              </span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-2xl bg-[#162720] border border-[#243D31] flex items-center justify-center mb-4 text-[#8EA690] shadow-xs">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-base font-serif font-bold text-[#EAF0EB] mb-1">
                Menyusun Dokumen PRD...
              </h3>
              <p className="text-xs text-[#8FA396] max-w-md mb-6 leading-relaxed">
                AI sedang mengompilasi pilihan arsitektur, user flow, kriteria MVP, dan daftar task implementasi yang siap dieksekusi.
              </p>

              {/* Skeleton loading preview */}
              <div className="w-full max-w-lg space-y-3 opacity-60">
                <div className="h-6 bg-[#162720] rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-[#162720] rounded w-full animate-pulse" />
                <div className="h-4 bg-[#162720] rounded w-5/6 animate-pulse" />
                <div className="h-24 bg-[#121E19] rounded-xl border border-[#22352B] p-3 animate-pulse mt-4" />
                <div className="h-4 bg-[#162720] rounded w-4/5 animate-pulse" />
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="rounded-xl border border-[#442420] bg-[#281816] p-4 sm:p-5 text-[#D48B80] mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#D48B80] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-[#EAF0EB] mb-1">
                    Gagal Menyusun PRD
                  </h4>
                  <p className="text-xs text-[#D48B80] mb-3">{error}</p>
                  {onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D48B80] hover:bg-[#C0776D] text-[#0C1310] text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                      <span>{isLoading ? "Memproses..." : "Coba Lagi"}</span>
                    </button>
                  )}
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
                    "prose prose-invert max-w-none text-[#C5D8C7] leading-relaxed break-words overflow-x-auto",
                    "prose-headings:font-serif prose-headings:font-bold prose-headings:text-[#EAF0EB]",
                    "prose-h1:text-xl sm:prose-h1:text-2xl prose-h1:border-b prose-h1:border-[#1F3028] prose-h1:pb-3 prose-h1:mb-4",
                    "prose-h2:text-lg sm:prose-h2:text-xl prose-h2:border-b prose-h2:border-[#1F3028] prose-h2:pb-2 prose-h2:mt-6 prose-h2:mb-3",
                    "prose-h3:text-sm sm:prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-[#8EA690]",
                    "prose-p:text-xs sm:prose-p:text-sm prose-p:my-2 prose-p:leading-relaxed",
                    "prose-ul:text-xs sm:prose-ul:text-sm prose-ul:my-2 prose-li:my-0.5",
                    "prose-ol:text-xs sm:prose-ol:text-sm prose-ol:my-2 prose-li:my-0.5",
                    "prose-blockquote:border-l-4 prose-blockquote:border-[#8EA690] prose-blockquote:bg-[#162720]/40 prose-blockquote:px-3 sm:prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:text-[#EAF0EB] prose-blockquote:not-italic prose-blockquote:text-xs sm:prose-blockquote:text-sm",
                    "prose-code:text-xs prose-code:bg-[#162720] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[#8EA690] prose-code:font-mono prose-code:border prose-code:border-[#243D31]",
                    "prose-pre:bg-[#0C1310] prose-pre:text-[#EAF0EB] prose-pre:rounded-xl prose-pre:p-3 sm:prose-pre:p-4 prose-pre:text-xs prose-pre:overflow-x-auto prose-pre:border prose-pre:border-[#1F3028]",
                    "prose-table:w-full prose-table:text-xs prose-table:my-4 prose-table:border-collapse",
                    "prose-th:bg-[#15231D] prose-th:p-2 sm:prose-th:p-2.5 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-[#1F3028] prose-th:text-[#EAF0EB]",
                    "prose-td:p-2 sm:prose-td:p-2.5 prose-td:border prose-td:border-[#1F3028] prose-td:text-[#8FA396]",
                    "prose-hr:border-[#1F3028] prose-hr:my-4 sm:prose-hr:my-6"
                  )}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <div className="relative">
                  <pre className="p-3 sm:p-4 bg-[#0C1310] text-[#EAF0EB] text-xs font-mono rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed select-text border border-[#1F3028]">
                    {markdown}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* Empty fallback if no markdown and not loading */}
          {!isLoading && !markdown && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[#8FA396]">
              <FileText className="w-8 h-8 text-[#586C61] mb-2 opacity-60" />
              <p className="text-sm font-medium text-[#EAF0EB]">
                Belum ada konten PRD untuk ditampilkan
              </p>
              <p className="text-xs text-[#586C61] mt-1 mb-4">
                Pastikan dokumen telah selesai digenerate pada workspace kanvas.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Floating Toast Notification on Copy */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 bg-[#121E19] text-[#EAF0EB] text-xs font-semibold rounded-full shadow-2xl border border-[#22352B] transition-all animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="w-4 h-4 rounded-full bg-[#162720] border border-[#243D31] flex items-center justify-center text-[#8EA690]">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
          <span>Disalin ke clipboard!</span>
        </div>
      )}
    </>
  );
}
