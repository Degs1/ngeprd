"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  GitBranch,
  FileText,
  Copy,
  Check,
  ZoomIn,
  MousePointer,
  Sparkles,
  ArrowRight,
  Database,
  Terminal,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE_MARKDOWN = `# Product Requirement Document (PRD)
## 1. Ringkasan & Nilai Unik
Web marketplace cuci sepatu berbasis lokasi menghubungkan pemilik sepatu dengan workshop cuci terdekat. Dilengkapi estimasi durasi penjemputan, live tracking tahapan cuci, dan pembayaran otomatis.

## 2. Arsitektur & Tech Stack
- Frontend: Next.js 14 App Router (TypeScript, Tailwind CSS)
- State & Visual: Zustand, @xyflow/react (Node Architecture)
- Backend & DB: Next.js Route Handlers + MongoDB Atlas
- AI Engine: 9router AI proxy dengan Planner & Parallel Section Writers via SSE

## 3. Skema Data Utama
- Order: id, customerId, workshopId, serviceType, pickupAddress, status
- TrackingLog: id, orderId, step (pickup|cleaning|qc|delivery), timestamp
- Workshop: id, name, location (GeoJSON), rating, quotaDaily`;

export default function ProductPreview() {
  const [activeTab, setActiveTab] = useState<"canvas" | "diagram" | "markdown">("canvas");
  const [copied, setCopied] = useState(false);
  const [activeOutlineIndex, setActiveOutlineIndex] = useState(2);
  const [highlightPulse, setHighlightPulse] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      if (custom.detail?.id === "preview") {
        setHighlightPulse(true);
        const t = setTimeout(() => setHighlightPulse(false), 1400);
        return () => clearTimeout(t);
      }
    };
    window.addEventListener("section-highlight", handleHighlight);
    return () => window.removeEventListener("section-highlight", handleHighlight);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_MARKDOWN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="preview" className="w-full py-16 sm:py-24 bg-[#F5F7FA] border-y border-[#E1E5EC] scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 mb-3 shadow-2xs",
              highlightPulse
                ? "bg-[#EEF2FD] border border-[#2854EB] text-[#2854EB] ring-4 ring-[#2854EB]/20 scale-105"
                : "bg-white border border-[#E1E5EC] text-[#596273]"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", highlightPulse ? "bg-[#2854EB] animate-ping" : "bg-[#2854EB]")} />
            <span>CONTOH NYATA WORKSPACE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#20242C] tracking-tight">
            Dari Satu Kalimat ke Canvas Terstruktur & prd.md
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#596273] leading-relaxed">
            Bukan sekadar mockup statis. Inilah representasi visual yang Anda dapatkan di dalam workspace ngePRD saat
            dokumen selesai dirumuskan oleh AI runtime.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1 bg-white border border-[#E1E5EC] rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className={cn(
                "px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === "canvas"
                  ? "bg-[#2854EB] text-white shadow-xs"
                  : "text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA]"
              )}
            >
              <Layers className="w-4 h-4" />
              <span>Canvas & Outline</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("diagram")}
              className={cn(
                "px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === "diagram"
                  ? "bg-[#2854EB] text-white shadow-xs"
                  : "text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA]"
              )}
            >
              <GitBranch className="w-4 h-4" />
              <span>Diagram Mermaid</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              className={cn(
                "px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === "markdown"
                  ? "bg-[#2854EB] text-white shadow-xs"
                  : "text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA]"
              )}
            >
              <FileText className="w-4 h-4" />
              <span>Export prd.md</span>
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="w-full bg-white border border-[#E1E5EC] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[460px]">
          {/* Top Window Bar */}
          <div className="h-11 px-4 bg-white border-b border-[#E1E5EC] flex items-center justify-between text-xs text-[#596273] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
              <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
              <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
              <span className="ml-2 font-mono text-[11px] text-[#20242C] font-medium hidden sm:inline-block">
                prd/marketplace-cuci-sepatu • status: ready (8 sections)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Semua Section Valid (Zod)
              </span>
            </div>
          </div>

          {/* TAB 1: CANVAS & OUTLINE VIEW */}
          {activeTab === "canvas" && (
            <div className="flex-1 flex flex-col md:flex-row h-full min-h-[420px]">
              {/* Left Outline Panel */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#E1E5EC] bg-[#F5F7FA] p-3 flex flex-col shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#596273] px-2 py-1 mb-1">
                  Outline Bernomor
                </div>
                <div className="space-y-1">
                  {[
                    { id: "1.1", title: "Ringkasan & Nilai Unik", type: "summary" },
                    { id: "2.1", title: "Target Pengguna & Masalah", type: "problem" },
                    { id: "3.1", title: "Arsitektur & Tech Stack", type: "tech_stack" },
                    { id: "4.1", title: "Skema Model Data", type: "data_model" },
                    { id: "5.1", title: "User Flow & Mermaid", type: "flowchart" },
                    { id: "6.1", title: "Roadmap Eksekusi Agent", type: "roadmap" },
                  ].map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveOutlineIndex(idx)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer",
                        activeOutlineIndex === idx
                          ? "bg-white text-[#2854EB] shadow-2xs border border-[#E1E5EC] font-semibold"
                          : "text-[#596273] hover:text-[#20242C] hover:bg-white/60"
                      )}
                    >
                      <span className="truncate">
                        <span className="font-mono text-[#2854EB] mr-1.5">{item.id}</span>
                        {item.title}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-auto pt-3 border-t border-[#E1E5EC] text-[10px] text-[#596273] px-2">
                  <span>Klik outline langsung memusatkan canvas ke node tersebut.</span>
                </div>
              </div>

              {/* Right Canvas Mockup Area */}
              <div className="flex-1 p-4 sm:p-6 bg-white relative overflow-hidden flex flex-col justify-between">
                {/* Simulated Nodes on Canvas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto">
                  {/* Node 1 */}
                  <div
                    className={cn(
                      "p-4 rounded-xl border transition-all shadow-2xs relative",
                      activeOutlineIndex === 2
                        ? "border-[#2854EB] bg-[#EEF2FD]/30 ring-2 ring-[#2854EB]/20"
                        : "border-[#E1E5EC] bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-[#2854EB]">3.1 TECH STACK</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                        Node
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#20242C] mb-1">Arsitektur & Tech Stack</h4>
                    <p className="text-xs text-[#596273] leading-relaxed">
                      Next.js 14 App Router, TypeScript, Tailwind, MongoDB Atlas, dan 9router SSE AI Client.
                    </p>
                  </div>

                  {/* Node 2 */}
                  <div
                    className={cn(
                      "p-4 rounded-xl border transition-all shadow-2xs relative",
                      activeOutlineIndex === 3
                        ? "border-[#2854EB] bg-[#EEF2FD]/30 ring-2 ring-[#2854EB]/20"
                        : "border-[#E1E5EC] bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-[#2854EB]">4.1 DATA MODEL</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                        Node
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#20242C] mb-1">Skema Model Data</h4>
                    <p className="text-xs text-[#596273] leading-relaxed">
                      Entitas Order, TrackingLog, dan Workshop dengan relasi GeoJSON untuk radius pencarian terdekat.
                    </p>
                  </div>
                </div>

                {/* Floating Instruction Bar (Revisi Berantai) */}
                <div className="mt-4 p-3 rounded-xl bg-[#20242C] text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <p className="text-xs truncate">
                      <span className="font-semibold text-slate-200">Revisi Terpadu: </span>
                      <span className="text-slate-300 font-mono">
                        &quot;Ganti database ke PostgreSQL & tambah tracking log&quot;
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                      3 Section Terdampak
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MERMAID DIAGRAM VIEW */}
          {activeTab === "diagram" && (
            <div className="flex-1 p-6 bg-white flex flex-col justify-center items-center text-center">
              <div className="w-full max-w-2xl bg-[#F5F7FA] border border-[#E1E5EC] rounded-xl p-5 shadow-2xs mb-4">
                <div className="flex items-center justify-between mb-3 text-xs text-[#596273] pb-2 border-b border-[#E1E5EC]">
                  <span className="font-semibold text-[#20242C]">Visualisasi Mermaid Otomatis</span>
                  <span className="font-mono text-[10px]">Flowchart TD • Rendered via Mermaid.js</span>
                </div>

                {/* Simulated Flowchart Nodes */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 py-4">
                  <div className="px-3.5 py-2.5 rounded-lg bg-white border border-[#E1E5EC] text-xs font-semibold text-[#20242C] shadow-2xs">
                    Customer App (Order)
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#2854EB] rotate-90 sm:rotate-0" />
                  <div className="px-3.5 py-2.5 rounded-lg bg-[#2854EB] text-white text-xs font-semibold shadow-xs">
                    Next.js API Handler
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#2854EB] rotate-90 sm:rotate-0" />
                  <div className="px-3.5 py-2.5 rounded-lg bg-white border border-[#E1E5EC] text-xs font-semibold text-[#20242C] shadow-2xs">
                    MongoDB Atlas & Queue
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#596273] max-w-md">
                Diagram alur sistem, sequence, dan ERD dihasilkan langsung dari skema PRD dan divalidasi tanpa error
                syntax backtick.
              </p>
            </div>
          )}

          {/* TAB 3: MARKDOWN EXPORT VIEW */}
          {activeTab === "markdown" && (
            <div className="flex-1 p-4 sm:p-6 bg-[#20242C] text-slate-100 flex flex-col justify-between overflow-x-auto font-mono text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/80">
                <span className="text-[11px] text-slate-400">prd.md (Formatted Markdown)</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Disalin!" : "Salin prd.md"}</span>
                </button>
              </div>

              <pre className="text-slate-300 leading-relaxed overflow-x-auto py-2 select-text">
                {SAMPLE_MARKDOWN}
              </pre>

              <div className="pt-3 mt-4 border-t border-slate-700/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Siap diumpankan ke Cursor, Claude Code, atau Antigravity</span>
                <span className="text-[#2854EB] font-bold">100% Valid Format</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
