"use client";

import React from "react";
import Link from "next/link";

export default function LandingFooter() {
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      const navOffset = 70;
      const elementPosition = targetEl.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - navOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });

      window.history.pushState(null, "", `#${targetId}`);

      window.dispatchEvent(
        new CustomEvent("section-highlight", { detail: { id: targetId } })
      );
    }
  };

  return (
    <footer className="w-full bg-white py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-[#E1E5EC] pb-8">
        {/* Brand */}
        <div className="flex flex-col">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon.png"
                alt="ngePRD"
                className="w-7 h-7 object-contain"
              />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-[#20242C] flex items-center">
              <span className="text-sky-500">nge</span>
              <span className="text-blue-700">PRD</span>
            </span>
          </Link>
          <p className="text-xs text-[#596273] max-w-sm leading-relaxed">
            AI Visual PRD Planner. Mengubah ide produk digital menjadi bab bernomor, canvas node & outline dua arah,
            serta dokumen <code>prd.md</code> siap eksekusi.
          </p>
        </div>

        {/* Real Navigation Links */}
        <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#596273]">
          <a
            href="#alur-kerja"
            onClick={(e) => handleAnchorClick(e, "alur-kerja")}
            className="hover:text-[#20242C] transition-colors cursor-pointer"
          >
            Alur Kerja
          </a>
          <a
            href="#preview"
            onClick={(e) => handleAnchorClick(e, "preview")}
            className="hover:text-[#20242C] transition-colors cursor-pointer"
          >
            Preview PRD
          </a>
          <a
            href="#fitur"
            onClick={(e) => handleAnchorClick(e, "fitur")}
            className="hover:text-[#20242C] transition-colors cursor-pointer"
          >
            Fitur Teknis
          </a>
          <a
            href="#arsitektur"
            onClick={(e) => handleAnchorClick(e, "arsitektur")}
            className="hover:text-[#20242C] transition-colors cursor-pointer"
          >
            Arsitektur
          </a>
          <Link href="/dashboard" className="text-[#2854EB] font-semibold hover:underline cursor-pointer">
            Buka Workspace
          </Link>
          <Link href="/login" className="hover:text-[#20242C] transition-colors cursor-pointer">
            Masuk
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#596273]">
        <p>© 2026 ngePRD. Dibuat untuk solo builder, vibe coder, & tim engineering.</p>
        <p>Didukung oleh Next.js 14, Zustand, @xyflow/react, & MongoDB.</p>
      </div>
    </footer>
  );
}
