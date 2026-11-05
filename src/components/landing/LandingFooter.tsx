"use client";

import React from "react";
import Link from "next/link";

export default function LandingFooter() {
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      const navOffset = 74;
      const elementPosition = targetEl.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - navOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });

      window.history.pushState(null, "", `#${targetId}`);
    }
  };

  return (
    <footer className="w-full bg-[#080D0B] py-12 px-4 sm:px-6 border-t border-[#1F3028]">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-[#1F3028]">
        {/* Brand */}
        <div className="flex flex-col">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-logo-cropped.png"
              alt="ngePRD"
              className="h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690]">
              v2.2
            </span>
          </Link>
          <p className="text-xs text-[#8FA396] max-w-sm leading-relaxed font-sans">
            Platform perencanaan spesifikasi perangkat lunak dengan multi-agent runtime, canvas node berarah, diagram Mermaid otomatis, dan ekspor <code className="font-mono text-[#C2D1C7]">prd.md</code> standar.
          </p>
        </div>

        {/* Navigation Anchors */}
        <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-[#8FA396]">
          <a
            href="#showcase"
            onClick={(e) => handleAnchorClick(e, "showcase")}
            className="hover:text-[#EAF0EB] transition-colors cursor-pointer"
          >
            Live Canvas
          </a>
          <a
            href="#pipeline"
            onClick={(e) => handleAnchorClick(e, "pipeline")}
            className="hover:text-[#EAF0EB] transition-colors cursor-pointer"
          >
            Alur Pipeline
          </a>
          <a
            href="#fitur"
            onClick={(e) => handleAnchorClick(e, "fitur")}
            className="hover:text-[#EAF0EB] transition-colors cursor-pointer"
          >
            Spesifikasi Teknis
          </a>
          <a
            href="#specimen"
            onClick={(e) => handleAnchorClick(e, "specimen")}
            className="hover:text-[#EAF0EB] transition-colors cursor-pointer"
          >
            Spesimen prd.md
          </a>
          <Link
            href="/dashboard"
            className="text-[#8EA690] hover:text-[#EAF0EB] font-semibold transition-colors cursor-pointer"
          >
            Buka Workspace
          </Link>
        </div>
      </div>

      {/* Taste-Skill Single Line Meta */}
      <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[#5C7064]">
        <div>
          © {new Date().getFullYear()} ngePRD. Forest Editorial Specification Engine.
        </div>
        <div>
          Built with Next.js 14, @xyflow/react &amp; MongoDB Atlas.
        </div>
      </div>
    </footer>
  );
}
