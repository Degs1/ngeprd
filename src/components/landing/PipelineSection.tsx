"use client";

import React from "react";
import { MessageSquareText, Cpu, Network, RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";

const PIPELINE_STEPS = [
  {
    step: "01",
    tag: "WIZARD PERTANYAAN",
    title: "Brainstorming 4–6 Pertanyaan Arsitektur",
    desc: "AI menganalisis ide kasar Anda dan memicu pertanyaan kunci yang spesifik: stack backend, basis data, alur otentikasi, dan model bisnis. Cukup pilih opsi atau ketik jawaban singkat.",
    meta: "4–6 Pertanyaan Interaktif",
    icon: MessageSquareText,
  },
  {
    step: "02",
    tag: "MULTI-AGENT ENGINE",
    title: "Planner & Penulis 11 Bagian",
    desc: "Planner menyusun 11 bagian PRD. Worker menulis setiap bagian sesuai dependensinya; progres tetap tersimpan ketika browser ditutup.",
    meta: "Progres Tersimpan",
    icon: Cpu,
  },
  {
    step: "03",
    tag: "DAGRE GRAPH & MERMAID",
    title: "Canvas Visual & Preview Mermaid",
    desc: "Semua bab disusun menjadi node grafik spasial dengan layout kiri-ke-kanan otomatis. Sumber Mermaid dapat diedit dan ditinjau langsung di canvas.",
    meta: "0ms Diagram Cache",
    icon: Network,
  },
  {
    step: "04",
    tag: "EDIT MANUAL",
    title: "Edit Node & Ekspor prd.md Siap Pakai",
    desc: "Ubah judul, konten, dan diagram langsung pada node, lalu ekspor PRD yang tersimpan sebagai prd.md untuk Cursor & Claude Code.",
    meta: "Atomic Concurrency Control",
    icon: RefreshCw,
  },
];

export default function PipelineSection() {
  return (
    <section id="pipeline" className="w-full py-16 sm:py-24 bg-[#0C1310] border-b border-[#1F3028]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690] text-xs font-mono tracking-wider mb-3">
            <span>PIPELINE REKAYASA SISTEM</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#EAF0EB]">
            Dari ide mentah ke dokumen rekayasa dalam empat tahap deterministik.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#8FA396] font-sans leading-relaxed">
            Tidak ada prompt acak atau output yang terpotong di tengah jalan. Setiap tahap memiliki kontrak skema ketat yang divalidasi dengan Zod.
          </p>
        </div>

        {/* 4-Step Editorial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PIPELINE_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="p-6 rounded-xl bg-[#101A15] border border-[#1F3028] hover:border-[#2D4539] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-2xl font-bold text-[#8EA690]">
                      {step.step}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028] text-[#8FA396]">
                      {step.tag}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-semibold text-[#EAF0EB] mb-2 font-sans">
                    {step.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed mb-6 font-sans">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#1F3028] flex items-center justify-between text-xs font-mono text-[#5C7064]">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#8EA690]" />
                    <span>{step.meta}</span>
                  </div>
                  <span className="text-[#8EA690]">Tahap {step.step}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

