"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle,
  RotateCcw,
  Maximize2,
  X,
  Copy,
  Check,
  Loader2,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MermaidViewProps {
  code: string;
  sectionId: string;
  prdId?: string;
  status?: "unchecked" | "ok" | "invalid";
  onStatusChange?: (
    status: "ok" | "invalid",
    repairedCode?: string,
    errorMsg?: string
  ) => void;
  className?: string;
}

// Global mermaid initialization promise to avoid duplicate initialization
let mermaidInitPromise: Promise<unknown> | null = null;

async function getInitializedMermaid() {
  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;

  if (!mermaidInitPromise) {
    mermaidInitPromise = (async () => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "default",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        suppressErrorRendering: true,
      });
    })();
  }

  await mermaidInitPromise;
  return mermaid;
}

export function MermaidView({
  code,
  sectionId,
  prdId,
  status = "unchecked",
  onStatusChange,
  className,
}: MermaidViewProps) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<
    "idle" | "rendering" | "repairing" | "rendered" | "error"
  >("idle");
  const [repairAttempts, setRepairAttempts] = useState(0);
  const [currentCode, setCurrentCode] = useState(code);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync internal code if prop changes
  useEffect(() => {
    setCurrentCode(code);
    setRepairAttempts(0);
    setErrorMessage(null);
  }, [code]);

  // Main render & auto-repair loop
  const renderDiagram = useCallback(
    async (codeToRender: string, attemptCount: number) => {
      if (!codeToRender || codeToRender.trim().length === 0) {
        setSvgHtml(null);
        setRenderStatus("idle");
        return;
      }

      setRenderStatus(attemptCount > 0 ? "repairing" : "rendering");

      try {
        const mermaid = await getInitializedMermaid();

        // 1. Client-side parse validation
        await mermaid.parse(codeToRender);

        // 2. Generate unique id for SVG rendering
        const cleanSectionId = sectionId.replace(/[^a-zA-Z0-9]/g, "");
        const uniqueId = `mermaid-${cleanSectionId}-${Math.random().toString(36).slice(2, 8)}`;

        // Clean any residual DOM element with this id
        const existingEl = document.getElementById(uniqueId);
        if (existingEl) existingEl.remove();

        const { svg } = await mermaid.render(uniqueId, codeToRender);

        // Clean up temporary DOM element mermaid attaches
        const tempEl = document.getElementById(uniqueId);
        if (tempEl) tempEl.remove();

        if (!isMountedRef.current) return;

        setSvgHtml(svg);
        setRenderStatus("rendered");
        setErrorMessage(null);

        // Notify parent if code was repaired or status needs update
        if (codeToRender !== code || status !== "ok") {
          onStatusChange?.("ok", codeToRender !== code ? codeToRender : undefined);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;

        const errText = err instanceof Error ? err.message : String(err);
        console.warn(
          `Mermaid render error (section: ${sectionId}, attempt: ${attemptCount}):`,
          errText
        );

        // 3. Auto-repair loop: up to 2 attempts via repair-diagram API (PRD Section 6.5 & 7.10)
        if (attemptCount < 2 && prdId && sectionId) {
          setRenderStatus("repairing");
          setRepairAttempts(attemptCount + 1);

          try {
            const res = await fetch(
              `/api/prds/${prdId}/sections/${sectionId}/repair-diagram`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code: codeToRender,
                  error: errText,
                }),
              }
            );

            if (res.ok) {
              const data = await res.json();
              if (data.code && data.code.trim().length > 0) {
                const repairedCode = data.code.trim();
                setCurrentCode(repairedCode);
                // Attempt next render round with repaired code
                await renderDiagram(repairedCode, attemptCount + 1);
                return;
              }
            }
          } catch (repairErr) {
            console.error("Auto-repair API request failed:", repairErr);
          }
        }

        // 4. If all auto-repair attempts exhausted or failed: fallback to error state
        setRenderStatus("error");
        setErrorMessage(errText);
        setRepairAttempts(attemptCount);
        onStatusChange?.("invalid", undefined, errText);
      }
    },
    [code, sectionId, prdId, status, onStatusChange]
  );

  // Trigger render whenever currentCode changes
  useEffect(() => {
    let ignore = false;

    const timer = setTimeout(() => {
      if (!ignore) {
        renderDiagram(currentCode, repairAttempts);
      }
    }, 50);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [currentCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual retry handler
  const handleManualRetry = () => {
    setRepairAttempts(0);
    renderDiagram(currentCode, 0);
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = currentCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy diagram code:", err);
    }
  };

  // Keyboard shortcut to close zoom modal on Escape
  useEffect(() => {
    if (!isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsZoomed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed]);

  return (
    <div className={cn("relative w-full text-left", className)} ref={containerRef}>
      {/* 1. Rendering / Repairing Loading State */}
      {(renderStatus === "rendering" || renderStatus === "repairing") && (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2 animate-pulse">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium text-slate-600">
            {renderStatus === "repairing"
              ? `Memperbaiki sintaks diagram (${repairAttempts}/2)...`
              : "Merender diagram..."}
          </span>
        </div>
      )}

      {/* 2. Successfully Rendered SVG */}
      {renderStatus === "rendered" && svgHtml && (
        <div className="group relative rounded-xl border border-slate-200/90 bg-slate-50/40 p-2.5 transition-all hover:bg-white hover:shadow-xs">
          {/* Zoom Overlay Button */}
          <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setIsZoomed(true);
              }}
              className="nodrag nowheel flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white/95 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg shadow-sm border border-slate-200 transition-all cursor-pointer"
              title="Perbesar diagram"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Perbesar</span>
            </button>
          </div>

          {/* SVG Diagram Canvas */}
          <div
            className="nodrag nowheel w-full overflow-x-auto flex justify-center items-center py-2 [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </div>
      )}

      {/* 3. Error / Malformed Diagram State (Auto-repair exhausted) */}
      {renderStatus === "error" && (
        <div className="nodrag nowheel rounded-xl border border-amber-300 bg-amber-50/60 p-3.5 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-amber-900">
                  Sintaks Diagram Tidak Valid
                </p>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-200/80 text-amber-800 rounded-full shrink-0">
                  Auto-repair gagal (2/2)
                </span>
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                {errorMessage ||
                  "Diagram tidak dapat dirender karena kesalahan sintaks Mermaid."}
              </p>
            </div>
          </div>

          {/* Raw Code Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-slate-500" />
                Kode Mentah
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="hover:text-indigo-600 flex items-center gap-1 font-medium text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <pre className="nodrag nowheel text-[11px] font-mono bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto max-h-36 leading-relaxed select-text border border-slate-800">
              <code>{currentCode}</code>
            </pre>
          </div>

          {/* Action: Manual Retry */}
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={handleManualRetry}
              className="nodrag nowheel inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba perbaiki lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Fullscreen Zoom Modal (FR-EDT-07) */}
      {isZoomed && svgHtml && (
        <div
          className="nodrag nowheel fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setIsZoomed(false);
          }}
        >
          <div
            className="nodrag nowheel relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Pratinjau Diagram Mermaid
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawCode(!showRawCode)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showRawCode ? "Lihat Diagram" : "Lihat Kode"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kode</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsZoomed(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors ml-1"
                  title="Tutup (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/50 flex items-center justify-center min-h-[300px]">
              {showRawCode ? (
                <pre className="w-full h-full max-h-[60vh] text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-xl overflow-auto leading-relaxed select-text">
                  <code>{currentCode}</code>
                </pre>
              ) : (
                <div
                  className="w-full flex justify-center items-center [&>svg]:max-w-full [&>svg]:max-h-[70vh] [&>svg]:h-auto [&>svg]:mx-auto select-none"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
