"use client";

import React from "react";
import { Cpu, Activity, ShieldCheck, Layers, GitCompare, Code2, Database } from "lucide-react";

export default function FeaturesSection() {
  return (
    <section id="fitur" className="w-full py-16 sm:py-24 bg-[#0C1310] border-b border-[#1F3028]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690] text-xs font-mono tracking-wider mb-3">
            <span>SPESIFIKASI ARSITEKTUR</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#EAF0EB]">
            Dibangun untuk stabilitas rekayasa, bukan ilusi AI.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#8FA396] font-sans leading-relaxed">
            Setiap fitur di bawah ini dirancang untuk mengatasi kelemahan LLM konvensional: timeout request, syntax diagram rusak, dan dokumen yang kehilangan konteks teknis.
          </p>
        </div>

        {/* Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Wide (8 Cols) - SSE Runtime */}
          <div className="md:col-span-8 p-6 sm:p-8 rounded-xl bg-[#101A15] border border-[#1F3028] hover:border-[#2D4539] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#14221C] border border-[#1F3028] flex items-center justify-center text-[#8EA690]">
                  <Cpu className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-[#8EA690] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                  RUNTIME ARCHITECTURE
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-[#EAF0EB] mb-2 font-sans">
                Deterministic Agent Runtime via Server-Sent Events (SSE)
              </h3>
              <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed max-w-xl mb-6 font-sans">
                LLM biasa gagal saat diminta menulis dokumen 15 halaman sekaligus karena batasan token output dan gateway timeout 30 detik. ngePRD memecah dokumen menjadi Section Planner dan memanggil Section Writer secara paralel bertahap, mengalirkan byte secara live ke browser Anda.
              </p>
            </div>

            {/* Architecture Spec Snippet */}
            <div className="p-3.5 rounded-lg bg-[#0E1713] border border-[#1F3028] font-mono text-xs text-[#C2D1C7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#8EA690]" />
                <span>Round-Robin Rate Limit Queue + Exp Backoff</span>
              </div>
              <span className="text-[11px] text-[#5C7064]">RFC 8895 Stream Parser</span>
            </div>
          </div>

          {/* Card 2: 4 Cols - Self-Healing Mermaid */}
          <div className="md:col-span-4 p-6 sm:p-8 rounded-xl bg-[#101A15] border border-[#1F3028] hover:border-[#2D4539] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#14221C] border border-[#1F3028] flex items-center justify-center text-[#8EA690]">
                  <Code2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-[#8EA690] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                  LIVE PREVIEW
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#EAF0EB] mb-2 font-sans">
                Editor Mermaid dengan Preview
              </h3>
              <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed mb-4 font-sans">
                Tinjau diagram Mermaid langsung di canvas. Jika sumbernya tidak valid, pesan kesalahan tampil agar Anda dapat memperbaikinya secara manual.
              </p>
            </div>

            <div className="text-[11px] font-mono text-[#5C7064] pt-3 border-t border-[#1F3028]">
              Dukungan: sequenceDiagram, flowchart, erDiagram
            </div>
          </div>

          {/* Card 3: 4 Cols - MongoDB SSOT */}
          <div className="md:col-span-4 p-6 sm:p-8 rounded-xl bg-[#101A15] border border-[#1F3028] hover:border-[#2D4539] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#14221C] border border-[#1F3028] flex items-center justify-center text-[#8EA690]">
                  <Database className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-[#8EA690] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                  PERSISTENCE
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#EAF0EB] mb-2 font-sans">
                MongoDB Atlas Single Source of Truth
              </h3>
              <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed mb-4 font-sans">
                Bukan sekadar LocalStorage browser yang mudah hilang. Seluruh struktur bab, metadata token revisi, dan riwayat dokumen tersimpan aman di database cloud berstandar enterprise.
              </p>
            </div>

            <div className="text-[11px] font-mono text-[#5C7064] pt-3 border-t border-[#1F3028]">
              Status dokumen atomik &amp; autosave background
            </div>
          </div>

          {/* Card 4: 4 Cols - Atomic Concurrency Control */}
          <div className="md:col-span-4 p-6 sm:p-8 rounded-xl bg-[#101A15] border border-[#1F3028] hover:border-[#2D4539] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#14221C] border border-[#1F3028] flex items-center justify-center text-[#8EA690]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-[#8EA690] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                  CONCURRENCY
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#EAF0EB] mb-2 font-sans">
                Atomic Lock &amp; HTTP 409 Conflict Guard
              </h3>
              <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed mb-4 font-sans">
                Pemeriksaan versi pada setiap edit mencegah perubahan manual menimpa versi yang lebih baru dan menampilkan konflik saat perlu ditinjau.
              </p>
            </div>

            <div className="text-[11px] font-mono text-[#5C7064] pt-3 border-t border-[#1F3028]">
              Heartbeat lock &amp; stale takeover recovery
            </div>
          </div>

          {/* Card 5: 4 Cols - Coding Agent Ready */}
          <div className="md:col-span-4 p-6 sm:p-8 rounded-xl bg-[#101A15] border border-[#1F3028] hover:border-[#2D4539] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#14221C] border border-[#1F3028] flex items-center justify-center text-[#8EA690]">
                  <GitCompare className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-[#8EA690] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                  INTEROPERABILITY
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#EAF0EB] mb-2 font-sans">
                Langsung Diterima Coding Agent
              </h3>
              <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed mb-4 font-sans">
                Ekspor satu klik menghasilkan dokumen <code>prd.md</code> standar industri yang dapat langsung Anda letakkan di root repo proyek untuk dibaca Claude Code, Cursor, Aider, atau Windsurf.
              </p>
            </div>

            <div className="text-[11px] font-mono text-[#5C7064] pt-3 border-t border-[#1F3028]">
              Format GFM dengan Diagram &amp; Data Contract
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
