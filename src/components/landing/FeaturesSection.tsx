"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, GitCompare, Code, Cpu, Workflow, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FeaturesSection() {
  const [highlightPulse, setHighlightPulse] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      if (custom.detail?.id === "fitur") {
        setHighlightPulse(true);
        const t = setTimeout(() => setHighlightPulse(false), 1400);
        return () => clearTimeout(t);
      }
    };
    window.addEventListener("section-highlight", handleHighlight);
    return () => window.removeEventListener("section-highlight", handleHighlight);
  }, []);

  return (
    <section id="fitur" className="w-full py-16 sm:py-24 bg-white border-b border-[#E1E5EC] scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 mb-3",
              highlightPulse
                ? "bg-[#EEF2FD] border border-[#2854EB] text-[#2854EB] ring-4 ring-[#2854EB]/20 scale-105 shadow-xs"
                : "bg-[#F5F7FA] border border-[#E1E5EC] text-[#596273]"
            )}
          >
            <Sparkles className={cn("w-3.5 h-3.5", highlightPulse ? "text-[#2854EB] animate-pulse" : "text-[#596273]")} />
            <span>FITUR TEKNIS NYATA</span>
            {highlightPulse && <span className="w-1.5 h-1.5 rounded-full bg-[#2854EB] animate-ping" />}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#20242C] tracking-tight">
            Fondasi Rekayasa untuk Perencanaan Perangkat Lunak yang Presisi
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#596273] leading-relaxed">
            ngePRD dibangun bukan sebagai chatbot mainan, melainkan sebagai pipeline deterministic yang menjamin
            kelengkapan arsitektur sebelum Anda menulis baris kode pertama.
          </p>
        </div>

        {/* Feature Grid with Varied Hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Feature 1: Wide Card (8 Cols) - Agent Runtime */}
          <div className="md:col-span-8 p-6 sm:p-8 rounded-xl bg-[#F5F7FA] border border-[#E1E5EC] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E1E5EC] flex items-center justify-center text-[#2854EB] mb-4 shadow-2xs">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#20242C] mb-2">
                Deterministic Agent Runtime via Server-Sent Events
              </h3>
              <p className="text-xs sm:text-sm text-[#596273] leading-relaxed max-w-xl mb-4">
                Tidak ada panggilan AI tunggal berdurasi 30 detik yang rentan gagal timeout. Arsitektur runtime ngePRD
                membagi proses menjadi fase Planner independen, dilanjutkan section writer paralel dan diagram generator
                yang langsung tersimpan ke MongoDB Atlas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#E1E5EC]">
              <div className="text-xs">
                <span className="font-semibold text-[#20242C] block">3–5 Bab Terstruktur</span>
                <span className="text-[#596273] text-[11px]">Disesuaikan kebutuhan ide</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-[#20242C] block">Paralel Writer</span>
                <span className="text-[#596273] text-[11px]">Menulis section simultan</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-[#20242C] block">Auto Reconnect</span>
                <span className="text-[#596273] text-[11px]">Tahan terhadap interupsi</span>
              </div>
            </div>
          </div>

          {/* Feature 2: Compact Card (4 Cols) - Validasi Zod */}
          <div className="md:col-span-4 p-6 sm:p-8 rounded-xl bg-white border border-[#E1E5EC] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-2xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#20242C] mb-2">
                Validasi Zod Ketat (Zero Silent Fallback)
              </h3>
              <p className="text-xs sm:text-sm text-[#596273] leading-relaxed">
                Setiap output JSON dari AI diverifikasi secara ketat terhadap skema Zod. Jika terjadi ketidaksesuaian, sistem
                menampilkan status gagal pada section bersangkutan dengan tombol coba lagi, tanpa menyembunyikan template
                palsu.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E1E5EC] text-[11px] text-[#2854EB] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Transparansi status penuh</span>
            </div>
          </div>

          {/* Feature 3: Split Card (6 Cols) - Revisi Berantai */}
          <div className="md:col-span-6 p-6 sm:p-8 rounded-xl bg-white border border-[#E1E5EC] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-4 shadow-2xs">
                <GitCompare className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#20242C] mb-2">
                Propagasi Dampak Revisi Berantai (Change Set)
              </h3>
              <p className="text-xs sm:text-sm text-[#596273] leading-relaxed">
                Ketika Anda merevisi sebuah node di canvas, AI menganalisis node lain yang saling terkait. Misalnya,
                perubahan dari REST API ke GraphQL otomatis memperbarui arsitektur, skema data, dan roadmap dalam satu
                kesatuan Change Set yang bisa diterima atau diurungkan.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E1E5EC] text-[11px] text-[#596273]">
              Dilengkapi word-level & line-level diff visual
            </div>
          </div>

          {/* Feature 4: Split Card (6 Cols) - Coding Agent Optimized */}
          <div className="md:col-span-6 p-6 sm:p-8 rounded-xl bg-[#F5F7FA] border border-[#E1E5EC] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4 shadow-2xs">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#20242C] mb-2">
                Dioptimalkan untuk Cursor, Claude Code, & Antigravity
              </h3>
              <p className="text-xs sm:text-sm text-[#596273] leading-relaxed">
                Format ekspor Markdown terbagi dalam bab bernomor yang teratur dan bebas halusinasi. Sangat mudah
                di-copy ke file <code>prd.md</code> atau <code>.cursorrules</code> di root proyek Anda untuk panduan coding
                agent.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E1E5EC] text-[11px] text-[#596273]">
              Salin satu klik atau unduh sebagai dokumen .md
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
