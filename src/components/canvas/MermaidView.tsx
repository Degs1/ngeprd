"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
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

// Module-level global caches to prevent duplicate rendering and layout thrashing
const svgCache = new Map<string, string>();
const inFlightRenders = new Map<string, Promise<string>>();

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
        theme: "base",
        themeVariables: {
          darkMode: true,
          background: "#0E1713",
          primaryColor: "#15231D",
          primaryTextColor: "#EAF0EB",
          primaryBorderColor: "#284234",
          lineColor: "#6A7E73",
          secondaryColor: "#121E19",
          tertiaryColor: "#16251F",
          noteBkgColor: "#162720",
          noteTextColor: "#8EA690",
          noteBorderColor: "#243D31",
          actorBkg: "#15231D",
          actorBorder: "#284234",
          actorTextColor: "#EAF0EB",
          actorLineColor: "#6A7E73",
          signalColor: "#8EA690",
          signalTextColor: "#EAF0EB",
          labelBoxBkgColor: "#121E19",
          labelBoxBorderColor: "#284234",
          labelTextColor: "#EAF0EB",
          loopTextColor: "#8EA690",
          activationBorderColor: "#8EA690",
          activationBkgColor: "#162720",
          sequenceNumberColor: "#0C1310",
        },
        fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace, sans-serif",
        suppressErrorRendering: true,
      });
    })();
  }

  await mermaidInitPromise;
  return mermaid;
}

export function getCleanMermaidCode(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^```mermaid\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();
}

function MermaidViewComponent({
  code,
  sectionId,
  prdId,
  status = "unchecked",
  onStatusChange,
  className,
}: MermaidViewProps) {
  const cleanCode = useMemo(() => getCleanMermaidCode(code), [code]);

  // Synchronous cache lookup on mount - prevents ANY layout shift if already rendered
  const initialSvg = useMemo(() => {
    return cleanCode ? svgCache.get(cleanCode) || null : null;
  }, [cleanCode]);

  const [svgHtml, setSvgHtml] = useState<string | null>(initialSvg);
  const [renderStatus, setRenderStatus] = useState<
    "idle" | "rendering" | "repairing" | "rendered" | "error"
  >(initialSvg ? "rendered" : "idle");

  const [repairAttempts, setRepairAttempts] = useState(0);
  const [currentCode, setCurrentCode] = useState(code);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const lastRenderedCodeRef = useRef<string | null>(initialSvg ? cleanCode : null);

  // Store onStatusChange in a ref so changes in parent callbacks never re-trigger rendering
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync internal code when prop changes
  useEffect(() => {
    setCurrentCode(code);
    setRepairAttempts(0);
    setErrorMessage(null);
  }, [code]);

  // Core diagram render executor
  const executeRender = useCallback(
    async (codeToRender: string, attemptCount: number) => {
      const clean = getCleanMermaidCode(codeToRender);

      if (!clean) {
        setSvgHtml(null);
        setRenderStatus("idle");
        lastRenderedCodeRef.current = "";
        return;
      }

      // 1. Instant Cache Hit: Return immediately without touching DOM or running mermaid
      if (svgCache.has(clean)) {
        const cached = svgCache.get(clean)!;
        setSvgHtml(cached);
        setRenderStatus("rendered");
        setErrorMessage(null);
        lastRenderedCodeRef.current = clean;
        onStatusChangeRef.current?.("ok", clean);
        return;
      }

      // Avoid re-rendering if this exact code is already successfully showing
      if (lastRenderedCodeRef.current === clean && svgHtml) {
        return;
      }

      // Only show skeleton loader if we don't have ANY svg yet (prevents glitch on small updates)
      if (!svgHtml) {
        setRenderStatus(attemptCount > 0 ? "repairing" : "rendering");
      }

      try {
        // Reuse in-flight promise if another component requested the same diagram
        let renderPromise = inFlightRenders.get(clean);
        if (!renderPromise) {
          renderPromise = (async () => {
            const mermaid = await getInitializedMermaid();
            const uniqueId = `mermaid_${sectionId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const { svg } = await mermaid.render(uniqueId, clean);
            svgCache.set(clean, svg);
            return svg;
          })();
          inFlightRenders.set(clean, renderPromise);
        }

        const svg = await renderPromise;
        inFlightRenders.delete(clean);

        if (!isMountedRef.current) return;

        setSvgHtml(svg);
        setRenderStatus("rendered");
        setErrorMessage(null);
        lastRenderedCodeRef.current = clean;

        onStatusChangeRef.current?.("ok", clean);
      } catch (err: unknown) {
        inFlightRenders.delete(clean);
        if (!isMountedRef.current) return;

        const errString = err instanceof Error ? err.message : String(err);
        console.warn(`Mermaid render failed for section ${sectionId}:`, errString);

        // Remove any error elements injected into DOM by mermaid
        const errorElement = document.getElementById(`d${sectionId}`);
        if (errorElement) errorElement.remove();

        // Auto-repair retry (max 2 attempts)
        if (attemptCount < 2 && prdId) {
          setRepairAttempts(attemptCount + 1);
          setRenderStatus("repairing");

          try {
            const repairRes = await fetch(
              `/api/prds/${prdId}/sections/${sectionId}/repair-diagram`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  brokenCode: codeToRender,
                  error: errString,
                }),
              }
            );

            if (repairRes.ok) {
              const repairData = await repairRes.json();
              if (repairData?.repairedCode) {
                const repairedClean = getCleanMermaidCode(repairData.repairedCode);
                setCurrentCode(repairData.repairedCode);
                await executeRender(repairedClean, attemptCount + 1);
                return;
              }
            }
          } catch (repairErr) {
            console.error("Auto-repair API call failed:", repairErr);
          }
        }

        // Exhausted repair attempts or repair endpoint failed
        setRenderStatus("error");
        setErrorMessage(errString);
        onStatusChangeRef.current?.("invalid", codeToRender, errString);
      }
    },
    [sectionId, prdId, svgHtml]
  );

  // Trigger render ONLY when currentCode or prdId changes
  useEffect(() => {
    executeRender(currentCode, 0);
  }, [currentCode, executeRender]);

  const handleManualRetry = () => {
    setRepairAttempts(0);
    // Invalidate cache for this code so it retries fresh
    const clean = getCleanMermaidCode(currentCode);
    svgCache.delete(clean);
    lastRenderedCodeRef.current = null;
    executeRender(currentCode, 0);
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
    <div className={cn("relative w-full text-left select-none", className)} ref={containerRef}>
      {/* 1. Rendering / Repairing Loading State - ONLY shown when no SVG is available yet */}
      {(renderStatus === "rendering" || renderStatus === "repairing") && !svgHtml && (
        <div className="flex flex-col items-center justify-center p-6 bg-[#0E1713] border border-[#1C2E24] rounded-xl space-y-2 animate-pulse text-[#8FA396] min-h-[140px]">
          <Loader2 className="w-5 h-5 text-[#8EA690] animate-spin" />
          <span className="text-xs font-mono font-medium">
            {renderStatus === "repairing"
              ? `Memperbaiki sintaks diagram (${repairAttempts}/2)...`
              : "Merender diagram..."}
          </span>
        </div>
      )}

      {/* 2. Successfully Rendered SVG (or preserving existing SVG during background revalidation) */}
      {svgHtml && renderStatus !== "error" && (
        <div className="group relative rounded-xl border border-[#1C2E24] bg-[#0E1713] p-2.5 transition-all hover:border-[#284234]">
          {/* Zoom Overlay Button */}
          <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setIsZoomed(true);
              }}
              className="nodrag nowheel flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#8FA396] hover:text-[#EAF0EB] bg-[#121E19] hover:bg-[#162620] rounded-lg shadow-sm border border-[#22352B] transition-all cursor-pointer"
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

      {/* 3. Error / Malformed Diagram State */}
      {renderStatus === "error" && (
        <div className="nodrag nowheel rounded-xl border border-[#3D3520] bg-[#262215] p-3.5 space-y-3 text-[#D4B36A]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#D4B36A] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#D4B36A]">
                  Sintaks Diagram Tidak Valid
                </p>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-[#3D3520] text-[#D4B36A] rounded-full shrink-0">
                  Auto-repair gagal (2/2)
                </span>
              </div>
              <p className="text-[11px] text-[#8FA396] mt-0.5 leading-relaxed">
                {errorMessage ||
                  "Diagram tidak dapat dirender karena kesalahan sintaks Mermaid."}
              </p>
            </div>
          </div>

          {/* Raw Code Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#8FA396]">
              <span className="font-semibold text-[#EAF0EB] flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-[#8EA690]" />
                Kode Mentah
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="hover:text-[#EAF0EB] flex items-center gap-1 font-medium text-[10px] bg-[#121E19] border border-[#22352B] px-1.5 py-0.5 rounded shadow-2xs text-[#8FA396] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#8EA690]" />
                    <span className="text-[#8EA690]">Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <pre className="nodrag nowheel text-[11px] font-mono bg-[#0C1310] text-[#EAF0EB] p-2.5 rounded-lg overflow-x-auto max-h-36 leading-relaxed select-text border border-[#1F3028]">
              <code>{currentCode}</code>
            </pre>
          </div>

          {/* Action: Manual Retry */}
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={handleManualRetry}
              className="nodrag nowheel inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0C1310] bg-[#D4B36A] hover:bg-[#C0A05A] rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba perbaiki lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Fullscreen Zoom Modal */}
      {isZoomed && svgHtml && (
        <div
          className="nodrag nowheel fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setIsZoomed(false);
          }}
        >
          <div
            className="nodrag nowheel relative w-full max-w-5xl max-h-[90vh] bg-[#121E19] rounded-2xl shadow-2xl border border-[#22352B] overflow-hidden flex flex-col text-[#EAF0EB]"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#1F3028] bg-[#101A16] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#8EA690]" />
                <h3 className="text-sm font-serif font-bold text-[#EAF0EB]">
                  Pratinjau Diagram Mermaid
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawCode(!showRawCode)}
                  className="px-2.5 py-1 text-xs font-medium text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] rounded-lg border border-[#22352B] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showRawCode ? "Lihat Diagram" : "Lihat Kode"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 text-xs font-medium text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] rounded-lg border border-[#22352B] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#8EA690]" />
                      <span className="text-[#8EA690]">Disalin</span>
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
                  className="p-1 text-[#586C61] hover:text-[#EAF0EB] hover:bg-[#162620] rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 bg-[#0E1713] flex items-center justify-center min-h-[300px]">
              {showRawCode ? (
                <pre className="w-full h-full max-h-[60vh] text-xs font-mono bg-[#0C1310] text-[#EAF0EB] p-4 rounded-xl overflow-auto leading-relaxed select-text border border-[#1F3028]">
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

// Memoize so parent node movements never trigger re-renders unless diagram code or sectionId changes
export const MermaidView = memo(MermaidViewComponent, (prev, next) => {
  return (
    prev.code === next.code &&
    prev.sectionId === next.sectionId &&
    prev.prdId === next.prdId &&
    prev.status === next.status &&
    prev.className === next.className
  );
});

export default MermaidView;
