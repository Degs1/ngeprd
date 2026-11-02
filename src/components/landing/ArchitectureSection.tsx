"use client";

import React, { useState, useEffect } from "react";
import { Server, Database, Sparkles, Layers, Terminal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const SPECS = [
  {
    title: "Next.js 14 App Router & TypeScript",
    desc: "Arsitektur frontend modern dengan routing terisolasi, rendering cepat, dan type safety penuh pada seluruh model data PRD.",
    icon: Server,
  },
  {
    title: "MongoDB Atlas Single Source of Truth",
    desc: "Bukan sekadar LocalStorage yang mudah hilang. Dokumen JSON di database adalah kebenaran tunggal; canvas, outline, dan ekspor adalah view reaktif darinya.",
    icon: Database,
  },
  {
    title: "@xyflow/react & Dagre Layout Engine",
    desc: "Visualisasi node spasial dengan kalkulasi posisi otomatis berarah kiri-ke-kanan, koneksi edge dependensi, dan sinkronisasi outline dua arah.",
    icon: Layers,
  },
  {
    title: "AI Queue & Rate Limit Resilience",
    desc: "Antrean permintaan AI dengan penjadwalan round-robin per-dokumen, backoff eksponensial otomatis pada kode HTTP 429, dan pelindung timeout.",
    icon: Activity,
  },
];

export default function ArchitectureSection() {
  const [highlightPulse, setHighlightPulse] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      if (custom.detail?.id === "arsitektur") {
        setHighlightPulse(true);
        const t = setTimeout(() => setHighlightPulse(false), 1400);
        return () => clearTimeout(t);
      }
    };
    window.addEventListener("section-highlight", handleHighlight);
    return () => window.removeEventListener("section-highlight", handleHighlight);
  }, []);

  return (
    <section id="arsitektur" className="w-full py-16 sm:py-24 bg-[#F5F7FA] border-b border-[#E1E5EC] scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 mb-3",
              highlightPulse
                ? "bg-[#EEF2FD] border border-[#2854EB] text-[#2854EB] ring-4 ring-[#2854EB]/20 scale-105 shadow-xs"
                : "bg-white border border-[#E1E5EC] text-[#596273]"
            )}
          >
            <Sparkles className={cn("w-3.5 h-3.5", highlightPulse ? "text-[#2854EB] animate-pulse" : "text-[#596273]")} />
            <span>SPESIFIKASI ARSITEKTUR</span>
            {highlightPulse && <span className="w-1.5 h-1.5 rounded-full bg-[#2854EB] animate-ping" />}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#20242C] tracking-tight">
            Transparan, Teruji, dan Siap untuk Produksi
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#596273] leading-relaxed">
            ngePRD mengedepankan rekayasa yang kokoh daripada klaim kosong. Seluruh komponen didesain untuk keandalan
            maksimal saat merumuskan ide perangkat lunak Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SPECS.map((spec, i) => {
            const Icon = spec.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-xl bg-white border border-[#E1E5EC] shadow-2xs hover:shadow-xs transition-shadow flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F5F7FA] border border-[#E1E5EC] flex items-center justify-center text-[#2854EB] shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20242C] mb-1.5">{spec.title}</h3>
                  <p className="text-xs sm:text-sm text-[#596273] leading-relaxed">{spec.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
