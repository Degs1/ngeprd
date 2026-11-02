"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, Sparkles } from "lucide-react";

export default function CtaSection() {
  return (
    <section className="w-full py-16 sm:py-24 bg-white border-b border-[#E1E5EC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="p-8 sm:p-12 rounded-2xl bg-[#F5F7FA] border border-[#E1E5EC] text-center flex flex-col items-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-white border border-[#E1E5EC] flex items-center justify-center text-[#2854EB] mb-6 shadow-2xs">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#20242C] tracking-tight max-w-xl leading-tight">
            Siap Mengubah Ide Anda Menjadi Rencana Nyata?
          </h2>

          <p className="mt-3.5 text-sm sm:text-base text-[#596273] max-w-lg leading-relaxed">
            Mulai eksplorasi ide produk hari ini. Jawab 4–6 pertanyaan arsitektur terarah dan biarkan AI merumuskan
            spesifikasi lengkap dalam hitungan detik.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-[#2854EB] hover:bg-[#1D44D8] text-white font-semibold text-sm sm:text-base tracking-tight shadow-sm transition-all duration-200 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Buka Workspace Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#preview"
              className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-white hover:bg-slate-50 text-[#20242C] font-semibold text-sm sm:text-base border border-[#E1E5EC] transition-all duration-200 active:scale-98 flex items-center justify-center cursor-pointer"
            >
              Lihat Contoh PRD
            </a>
          </div>

          <p className="mt-4 text-[11px] text-[#596273]">
            Tersimpan aman di MongoDB • Gratis untuk 3 PRD per hari
          </p>
        </div>
      </div>
    </section>
  );
}
