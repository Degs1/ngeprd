"use client";

import React from "react";
import { XCircle, CheckCircle2, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SpecimenComparison() {
  return (
    <section id="specimen" className="w-full py-16 sm:py-24 bg-[#0C1310] border-b border-[#1F3028]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690] text-xs font-mono tracking-wider mb-3">
            <span>PERBANDINGAN KUALITAS KONTRAK</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#EAF0EB]">
            Mengapa coding agent membutuhkan spesifikasi nyata, bukan sekadar rangkuman.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#8FA396] font-sans leading-relaxed">
            Coding agent seperti Claude Code atau Cursor bekerja 10x lebih cepat jika diberi kontrak skema, dependensi antar bab, dan acceptance criteria yang jelas.
          </p>
        </div>

        {/* Side-by-Side Comparison Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Generic Chatbot Output (What to avoid) */}
          <div className="p-6 sm:p-7 rounded-xl bg-[#101713] border border-[#261E1E] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#261E1E] mb-5">
                <div className="flex items-center gap-2 text-rose-400">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span className="font-mono text-xs font-semibold tracking-wide">
                    PROMPT CHATBOT BIASA
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#5C7064]">
                  Hasil Tidak Deterministic
                </span>
              </div>

              <div className="space-y-4 text-xs font-mono text-[#8FA396]">
                <div className="p-3 rounded bg-[#141212] border border-[#261E1E] leading-relaxed">
                  <p className="text-[#8B5E5E] mb-2 font-sans font-semibold">Teks Narasi Bebas:</p>
                  <p className="line-through text-[#665050] font-sans">
                    &ldquo;Tentu! Buatlah aplikasi cuci sepatu yang memiliki fitur user login, order, keranjang belanja, dan pembayaran. Gunakan teknologi terkini yang populer...&rdquo;
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-[#8A7A7A] font-sans">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">✕</span>
                    <span>Tidak ada skema entitas database (nama field &amp; relasi ditebak sendiri oleh AI).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">✕</span>
                    <span>Tidak ada diagram alur teknis (urutan event pemesanan rawan race condition).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">✕</span>
                    <span>Teks terpotong di tengah jalan saat mencapai batas 2000 token output.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">✕</span>
                    <span>Coding agent bingung karena konteks berubah-ubah setiap kali bertanya.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#261E1E] text-[11px] font-mono text-[#735A5A]">
              Dampak: 40% waktu terbuang memperbaiki halusinasi kode.
            </div>
          </div>

          {/* Column 2: ngePRD Structured Spec (Forest Editorial) */}
          <div className="p-6 sm:p-7 rounded-xl bg-[#101A15] border border-[#2D4539] relative flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-6 -translate-y-1/2 px-2.5 py-0.5 rounded bg-[#8EA690] text-[#0C1310] font-mono text-[10px] font-bold tracking-wider">
              STANDAR ngePRD
            </div>

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1F3028] mb-5">
                <div className="flex items-center gap-2 text-[#8EA690]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-mono text-xs font-semibold tracking-wide">
                    ENGINEERED SPECIFICATION
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#8EA690]">
                  Siap Eksekusi
                </span>
              </div>

              <div className="space-y-4 text-xs font-mono text-[#C2D1C7]">
                <div className="p-3 rounded bg-[#0E1713] border border-[#1F3028] leading-relaxed">
                  <p className="text-[#8EA690] mb-1 font-mono text-[11px]">Kontrak Bab 3: Skema Entitas</p>
                  <pre className="text-[11px] text-[#A6BAAE] font-mono overflow-x-auto">
{`interface Order {
  id: string; // Mongo ObjectId
  customerId: string;
  workshopId: string;
  pickupGeo: [lng: number, lat: number];
  status: "draft" | "assigned" | "cleaning" | "ready";
}`}
                  </pre>
                </div>

                <ul className="space-y-2.5 text-xs text-[#8FA396] font-sans">
                  <li className="flex items-start gap-2">
                    <span className="text-[#8EA690] font-bold shrink-0">✓</span>
                    <span>Struktur bab berurutan 1.1 sampai 4.2 yang konsisten dan saling terikat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8EA690] font-bold shrink-0">✓</span>
                    <span>Diagram alur Mermaid sequence/flowchart yang otomatis divalidasi.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8EA690] font-bold shrink-0">✓</span>
                    <span>Multi-agent parallel streaming: tidak ada bagian dokumen yang terpotong.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8EA690] font-bold shrink-0">✓</span>
                    <span>Tersimpan di MongoDB; diekspor dalam satu file <code>prd.md</code> standar.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#1F3028] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#8EA690]">Hasil: Coding agent langsung paham arsitektur.</span>
              <Link
                href="/dashboard"
                className="text-[#8EA690] hover:text-[#EAF0EB] flex items-center gap-1 font-semibold"
              >
                <span>Coba Sekarang</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

