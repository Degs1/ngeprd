"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";

export default function CtaSection() {
  return (
    <section className="w-full py-16 sm:py-24 bg-[#0C1310] border-b border-[#1F3028]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="p-8 sm:p-14 rounded-2xl bg-[#101A15] border border-[#1F3028] text-center flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-[#8EA690]/5 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F3028] bg-[#14221C] text-[#8EA690] text-xs font-mono tracking-wider mb-5">
            <Terminal className="w-3.5 h-3.5" />
            <span>MULAI SEKARANG</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-[#EAF0EB] tracking-tight max-w-xl leading-tight">
            Ubah ide di kepala Anda menjadi arsitektur yang siap di-coding.
          </h2>

          <p className="mt-4 text-sm sm:text-base text-[#8FA396] max-w-lg leading-relaxed font-sans">
            Jawab 4–6 pertanyaan arsitektur interaktif dan biarkan agentic pipeline merumuskan spesifikasi lengkap dalam hitungan detik.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-7 py-3 rounded-md bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] font-sans font-semibold text-xs sm:text-sm tracking-tight transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Buka Workspace Gratis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#showcase"
              className="w-full sm:w-auto px-6 py-3 rounded-md bg-[#14221C] hover:bg-[#1A2C24] text-[#EAF0EB] font-sans font-medium text-xs sm:text-sm border border-[#1F3028] transition-all duration-150 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              Lihat Live Preview
            </a>
          </div>

          <div className="mt-6 text-[11px] font-mono text-[#5C7064]">
            Tersimpan aman di MongoDB • Gratis 3 PRD per hari • Langsung kompatibel dengan Cursor &amp; Claude Code
          </div>
        </div>
      </div>
    </section>
  );
}
