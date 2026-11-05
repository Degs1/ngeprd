"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Terminal, FileCode2, Layers, Cpu, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE_PRESETS = [
  "Aplikasi POS kasir kafe offline-first dengan sinkronisasi cloud & struk bluetooth",
  "Marketplace cuci sepatu berbasis lokasi, live tracking, dan auto-payout",
  "SaaS manajemen kontrakan & kos dengan invoice otomatis via WhatsApp",
];

export default function HeroSection() {
  const router = useRouter();
  const [ideaText, setIdeaText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;
    router.push(`/dashboard?idea=${encodeURIComponent(ideaText.trim())}`);
  };

  const handleSelectPreset = (preset: string) => {
    setIdeaText(preset);
  };

  return (
    <section className="relative w-full pt-28 pb-16 sm:pt-36 sm:pb-24 overflow-hidden border-b border-[#1F3028]">
      {/* Editorial Subtle Grid Watermark (Taste-Skill compliant, no cheesy blobs) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: "linear-gradient(#8EA690 1px, transparent 1px), linear-gradient(90deg, #8EA690 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Kicker badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690] text-xs font-mono tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8EA690] animate-pulse" />
            <span>AGENTIC SPECIFICATION ENGINE</span>
          </div>
          <span className="text-[11px] font-mono text-[#5C7064] hidden md:inline">
            {"//"} Deterministic Multi-Section Pipeline
          </span>
        </div>

        {/* Editorial Headline */}
        <div className="max-w-4xl">
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#EAF0EB] leading-[1.12]">
            Perencanaan perangkat lunak yang presisi,{" "}
            <span className="text-[#8EA690] italic font-normal">
              bukan tebakan prompt.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[#C2D1C7] leading-relaxed max-w-2xl font-sans">
            Ubah satu ide kasar menjadi spesifikasi arsitektur utuh: bab bernomor, canvas node berarah, diagram Mermaid otomatis, dan dokumen <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#14221C] text-[#8EA690] border border-[#1F3028]">prd.md</code> standar yang siap dieksekusi oleh Cursor, Claude Code, maupun Windsurf.
          </p>
        </div>

        {/* Interactive Quick-Idea Input Box (Forest Editorial Flat Well) */}
        <div className="mt-9 max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="p-2 sm:p-2.5 rounded-lg bg-[#121D18] border border-[#1F3028] shadow-[0_8px_30px_rgba(0,0,0,0.5)] focus-within:border-[#8EA690]/60 transition-colors"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-2 px-3 text-[#5C7064] shrink-0 hidden sm:flex">
                <Terminal className="w-4 h-4 text-[#8EA690]" />
              </div>
              <input
                type="text"
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                placeholder="Tulis ide aplikasimu (mis: Marketplace cuci sepatu berbasis lokasi...)"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-[#EAF0EB] placeholder-[#5C7064] focus:outline-none font-sans"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-md bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] font-sans font-semibold text-xs tracking-tight transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <span>Mulai PRD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Quick Idea Presets Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-[#5C7064]">Contoh cepat:</span>
            {SAMPLE_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-[11px] font-sans px-2.5 py-1 rounded bg-[#101A15] hover:bg-[#14221C] border border-[#1F3028] text-[#8FA396] hover:text-[#EAF0EB] transition-colors truncate max-w-[280px] sm:max-w-none text-left cursor-pointer"
                title={preset}
              >
                {preset.split(" ")[0]} {preset.split(" ")[1]} {preset.split(" ")[2]}...
              </button>
            ))}
          </div>
        </div>

        {/* Technical Ledger Numbers (Honest Specs per taste-skill) */}
        <div className="mt-12 pt-8 border-t border-[#1F3028] grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl">
          <div>
            <div className="font-mono text-2xl font-bold text-[#EAF0EB]">4–6</div>
            <div className="text-xs text-[#8FA396] mt-0.5 font-sans">Pertanyaan Arsitektur Terarah</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-bold text-[#8EA690]">SSE</div>
            <div className="text-xs text-[#8FA396] mt-0.5 font-sans">Multi-Agent Streaming Tanpa Timeout</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-bold text-[#EAF0EB]">100%</div>
            <div className="text-xs text-[#8FA396] mt-0.5 font-sans">Valid Mermaid Syntax Repair</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-bold text-[#8EA690]">0 ms</div>
            <div className="text-xs text-[#8FA396] mt-0.5 font-sans">Flicker-Free Cached Canvas Node</div>
          </div>
        </div>
      </div>
    </section>
  );
}
