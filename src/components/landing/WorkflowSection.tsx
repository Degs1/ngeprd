"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquareText, HelpCircle, Cpu, Network, RefreshCw, Sparkles, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    num: "01",
    title: "Input Ide Santai",
    desc: "Ketik ide aplikasimu dalam satu atau dua kalimat. Tidak perlu memikirkan template dokumen atau form panjang yang melelahkan.",
    icon: MessageSquareText,
    tag: "Dashboard",
  },
  {
    num: "02",
    title: "Brainstorming 4–6 Pertanyaan",
    desc: "AI menganalisis ide dan memicu 4–6 pertanyaan arsitektur spesifik (stack, data model, alur utama). Anda tinggal memilih opsi atau mengetik sendiri.",
    icon: HelpCircle,
    tag: "Brainstorm Wizard",
  },
  {
    num: "03",
    title: "Multi-Section Agent Runtime",
    desc: "Planner membagi dokumen ke dalam bab bernomor, lalu section writer paralel dan generator diagram Mermaid bekerja via SSE tanpa risiko timeout.",
    icon: Cpu,
    tag: "SSE Streaming",
  },
  {
    num: "04",
    title: "Canvas & Outline Terhubung",
    desc: "PRD langsung divisualisasikan menjadi node di canvas tak terbatas. Klik daftar isi bernomor di panel samping untuk langsung melompat ke node terkait.",
    icon: Network,
    tag: "Visual Node",
  },
  {
    num: "05",
    title: "Revisi Berantai & Ekspor prd.md",
    desc: "Ingin ubah stack atau skema? Klik node dan beri instruksi. AI mempropagasi dampaknya ke node lain sebagai Change Set sebelum diekspor ke coding agent.",
    icon: RefreshCw,
    tag: "Change Set Engine",
  },
];

export default function WorkflowSection() {
  const [activeHighlightedStep, setActiveHighlightedStep] = useState<number | null>(null);
  const [isBadgePulsing, setIsBadgePulsing] = useState(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const triggerWorkflowAnimation = useCallback(() => {
    clearTimers();
    setIsBadgePulsing(true);
    setActiveHighlightedStep(null);

    // Kicker pulse duration
    const tBadge = setTimeout(() => {
      setIsBadgePulsing(false);
    }, 1800);
    timersRef.current.push(tBadge);

    // Cascade highlight across steps 1 -> 5
    STEPS.forEach((_, idx) => {
      const t = setTimeout(() => {
        setActiveHighlightedStep(idx + 1);
      }, 200 + idx * 260);
      timersRef.current.push(t);
    });

    // Reset back to static state cleanly
    const tDone = setTimeout(() => {
      setActiveHighlightedStep(null);
    }, 200 + STEPS.length * 260 + 500);
    timersRef.current.push(tDone);
  }, [clearTimers]);

  useEffect(() => {
    const handleSectionHighlight = (e: Event) => {
      const customEvt = e as CustomEvent<{ id: string }>;
      if (customEvt.detail?.id === "alur-kerja") {
        // Trigger after a tiny smooth-scroll landing buffer
        const t = setTimeout(() => {
          triggerWorkflowAnimation();
        }, 300);
        timersRef.current.push(t);
      }
    };

    window.addEventListener("section-highlight", handleSectionHighlight);
    return () => {
      window.removeEventListener("section-highlight", handleSectionHighlight);
      clearTimers();
    };
  }, [clearTimers, triggerWorkflowAnimation]);

  return (
    <section id="alur-kerja" className="w-full py-16 sm:py-24 bg-white border-b border-[#E1E5EC] scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300",
                isBadgePulsing
                  ? "bg-[#EEF2FD] border-[#2854EB] text-[#2854EB] ring-4 ring-[#2854EB]/20 scale-105 shadow-xs"
                  : "bg-[#F5F7FA] border border-[#E1E5EC] text-[#596273]"
              )}
            >
              <Sparkles
                className={cn(
                  "w-3.5 h-3.5 transition-colors",
                  isBadgePulsing ? "text-[#2854EB] animate-pulse" : "text-[#596273]"
                )}
              />
              <span>ALUR KERJA NGEPRD</span>
              {isBadgePulsing && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2854EB] animate-ping" />
              )}
            </div>

            {/* Manual replay button for interactive exploration */}
            <button
              type="button"
              onClick={triggerWorkflowAnimation}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#2854EB] hover:text-[#1D44D8] bg-[#EEF2FD] hover:bg-blue-100 border border-blue-200/80 px-2.5 py-1 rounded-full transition-all duration-150 active:scale-95 cursor-pointer"
              title="Putar animasi langkah alur kerja"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Putar Alur 01–05</span>
            </button>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#20242C] tracking-tight">
            Bagaimana Ide Anda Berubah Menjadi Rencana Siap Coding
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#596273] leading-relaxed">
            Dirancang khusus untuk mengeliminasi kebingungan arsitektur awal dan menghasilkan dokumen spesifikasi yang
            dapat langsung dipahami oleh AI coding agent.
          </p>
        </div>

        {/* Workflow Steps Grid with Staggered Highlight Animation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isFeatured = idx === 1 || idx === 4;
            const stepNumber = idx + 1;
            const isStepActive = activeHighlightedStep === stepNumber;

            return (
              <div
                key={step.num}
                onClick={() => setActiveHighlightedStep(stepNumber)}
                className={cn(
                  "p-6 rounded-xl border transition-all duration-300 flex flex-col justify-between cursor-pointer",
                  isStepActive
                    ? "border-[#2854EB] bg-[#EEF2FD]/50 ring-2 ring-[#2854EB]/30 shadow-md -translate-y-1.5"
                    : isFeatured
                    ? "border-[#2854EB]/40 bg-[#EEF2FD]/20 shadow-xs hover:border-[#2854EB]/70"
                    : "border-[#E1E5EC] bg-[#F5F7FA]/70 hover:bg-[#F5F7FA] hover:border-[#CBD5E1]"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={cn(
                        "font-mono text-sm font-bold transition-all duration-200 px-2 py-0.5 rounded",
                        isStepActive
                          ? "bg-[#2854EB] text-white ring-4 ring-[#2854EB]/20 scale-105"
                          : "text-[#2854EB] bg-white border border-[#E1E5EC]"
                      )}
                    >
                      {step.num}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded transition-colors",
                        isStepActive
                          ? "bg-[#2854EB]/15 text-[#2854EB] border border-[#2854EB]/30"
                          : "bg-white border border-[#E1E5EC] text-[#596273]"
                      )}
                    >
                      {step.tag}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center mb-4 shadow-2xs transition-all duration-300",
                      isStepActive
                        ? "bg-[#2854EB] text-white scale-110 shadow-sm"
                        : "bg-white border border-[#E1E5EC] text-[#2854EB]"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3
                    className={cn(
                      "text-base sm:text-lg font-bold mb-2 transition-colors duration-200",
                      isStepActive ? "text-[#2854EB]" : "text-[#20242C]"
                    )}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#596273] leading-relaxed">{step.desc}</p>
                </div>

                {isStepActive && (
                  <div className="mt-4 pt-3 border-t border-[#2854EB]/20 flex items-center justify-between text-[11px] font-medium text-[#2854EB]">
                    <span>Tahap {step.num} aktif dalam pipeline</span>
                    <span className="w-2 h-2 rounded-full bg-[#2854EB] animate-ping" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
