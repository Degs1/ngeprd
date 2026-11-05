"use client";

import React, { useState } from "react";
import Link from "next/link";
import MermaidView from "@/components/canvas/MermaidView";
import {
  Layers,
  FileText,
  Copy,
  Check,
  GitBranch,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Cpu,
  Sparkles,
  ArrowRight,
  Database,
  Terminal,
  Activity,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE_MERMAID_DIAGRAM = `sequenceDiagram
    autonumber
    actor Customer as Pelanggan
    participant API as Order Service
    participant Workshop as Workshop Cuci
    participant Driver as Kurir
    Customer->>API: 1. Buat Pesanan (lat, lng, items)
    API->>Workshop: 2. Cek Kuota Harian & Slot
    Workshop-->>API: 3. Konfirmasi Kuota Tersedia
    API->>Driver: 4. Broadcast Pickup Terdekat
    Driver-->>Customer: 5. Notifikasi Tiba di Lokasi`;

const SAMPLE_SECTIONS = [
  { id: "sec-1", num: "1.1", title: "Ringkasan Eksekutif & Value Proposition", status: "completed", type: "text" },
  { id: "sec-2", num: "1.2", title: "Masalah Utama & Solusi Berbasis Geo-Location", status: "completed", type: "text" },
  { id: "sec-3", num: "2.1", title: "Arsitektur Sistem & Tech Stack", status: "completed", type: "text" },
  { id: "sec-4", num: "2.2", title: "Diagram Alur Pemesanan & Pickup", status: "completed", type: "diagram" },
  { id: "sec-5", num: "3.1", title: "Skema Data MongoDB & Entitas", status: "completed", type: "text" },
  { id: "sec-6", num: "4.1", title: "API Endpoint & Acceptance Criteria", status: "completed", type: "text" },
];

const RAW_PRD_MD = `# Product Requirement Document (PRD)
# Dokumen Arsitektur: WashTrack Engine v1.0

## 1. Ringkasan Eksekutif
Platform marketplace cuci sepatu on-demand berbasis radius lokasi. Menghubungkan pelanggan dengan workshop cuci terverifikasi, dilengkapi estimasi waktu jemput otomatis dan pelacakan status bertahap via WhatsApp Webhook.

## 2. Arsitektur & Teknologi
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **Visual Canvas**: @xyflow/react + Dagre Layout Engine
- **Database**: MongoDB Atlas dengan Indexing GeoJSON (2dsphere)
- **AI Runtime**: Multi-Agent Planner + Parallel Section Writers via SSE

## 3. Diagram Alur Transaksi (Mermaid)
\`\`\`mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant API as Order Service
    participant W as Workshop
    participant R as Driver
    C->>API: Buat Pesanan (titik jemput & jenis cuci)
    API->>W: Notifikasi pesanan masuk
    W-->>API: Konfirmasi slot pengerjaan
    API->>R: Dispatch jemput sepatu
    R-->>C: Sepatu dijemput (Status: In-Progress)
\`\`\`

## 4. Skema Data Kunci
- **Order**: { id, customerId, workshopId, items: [], status, pickupGeo, totalAmount }
- **TrackingLog**: { id, orderId, step, proofPhotoUrl, createdAt }
- **Workshop**: { id, name, location: Point, rating, maxCapacity }`;

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<"canvas" | "diagram" | "markdown">("canvas");
  const [activeSectionId, setActiveSectionId] = useState("sec-4");
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(RAW_PRD_MD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="showcase" className="w-full py-16 sm:py-24 bg-[#0C1310] border-b border-[#1F3028]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690] text-xs font-mono tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8EA690]" />
              <span>LIVE WORKSPACE SIMULATION</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#EAF0EB]">
              Satu kebenaran data, tiga cara melihatnya.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#8FA396] max-w-xl font-sans">
              Dokumen PRD bukan file statis yang mati. Semua bab bernomor terhubung langsung dengan canvas visual berarah dan kode sumber markdown.
            </p>
          </div>

          {/* Interactive Mode Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-[#121D18] border border-[#1F3028] shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className={cn(
                "px-3.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer",
                activeTab === "canvas"
                  ? "bg-[#1E2E25] text-[#EAF0EB] shadow-xs"
                  : "text-[#8FA396] hover:text-[#EAF0EB]"
              )}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Visual Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diagram")}
              className={cn(
                "px-3.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer",
                activeTab === "diagram"
                  ? "bg-[#1E2E25] text-[#EAF0EB] shadow-xs"
                  : "text-[#8FA396] hover:text-[#EAF0EB]"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Diagram Mermaid</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              className={cn(
                "px-3.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer",
                activeTab === "markdown"
                  ? "bg-[#1E2E25] text-[#EAF0EB] shadow-xs"
                  : "text-[#8FA396] hover:text-[#EAF0EB]"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>prd.md Raw</span>
            </button>
          </div>
        </div>

        {/* The Realistic Editorial App Frame (Taste-Skill core requirement) */}
        <div className="rounded-xl border border-[#1F3028] bg-[#101A15] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* App Frame Titlebar */}
          <div className="px-4 py-3 bg-[#0E1713] border-b border-[#1F3028] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1F3028]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#1F3028]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#1F3028]" />
              <div className="h-3 w-[1px] bg-[#1F3028] mx-2" />
              <span className="text-xs font-mono text-[#8FA396] flex items-center gap-2">
                <span className="text-[#5C7064]">prd /</span>
                <span className="text-[#C2D1C7]">marketplace-cuci-sepatu.prd</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#8EA690] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028] hidden sm:inline-block">
                ● SYNCED MONGODB (REV 4)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-mono text-[#8FA396] hover:text-[#EAF0EB] flex items-center gap-1.5 px-2 py-1 rounded bg-[#14221C] border border-[#1F3028] hover:border-[#2D4539] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#8EA690]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Tersalin" : "Salin prd.md"}</span>
              </button>
            </div>
          </div>

          {/* App Content Body: Left Outline + Right Active View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Left Synchronized Outline */}
            <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#1F3028] bg-[#0E1713]/80 p-4 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#5C7064] mb-3 px-2 flex items-center justify-between">
                  <span>DAFTAR BAB & BAGIAN</span>
                  <span className="text-[#8EA690]">6 Bagian</span>
                </div>
                <div className="space-y-1">
                  {SAMPLE_SECTIONS.map((sec) => {
                    const isSelected = activeSectionId === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setActiveSectionId(sec.id);
                          if (sec.type === "diagram") setActiveTab("diagram");
                        }}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded text-xs transition-all flex items-center justify-between group cursor-pointer",
                          isSelected
                            ? "bg-[#14221C] text-[#EAF0EB] border border-[#1F3028]"
                            : "text-[#8FA396] hover:text-[#C2D1C7] hover:bg-[#121D18]"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[11px] text-[#5C7064] group-hover:text-[#8EA690] shrink-0">
                            {sec.num}
                          </span>
                          <span className="truncate font-sans">{sec.title}</span>
                        </div>
                        {sec.type === "diagram" ? (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#1A2C22] text-[#8EA690] border border-[#2D4539] shrink-0">
                            MERMAID
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1F3028] group-hover:bg-[#8EA690] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outline Footer Helper */}
              <div className="mt-4 pt-3 border-t border-[#1F3028] text-[11px] text-[#5C7064] font-mono flex items-center justify-between">
                <span>Auto-Layout Dagre L-to-R</span>
                <span className="text-[#8EA690]">Status: Siap</span>
              </div>
            </div>

            {/* Right Display Area depending on activeTab */}
            <div className="lg:col-span-8 bg-[#0C1310] p-4 sm:p-6 flex flex-col justify-between overflow-x-auto">
              {activeTab === "canvas" && (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-[11px] font-mono text-[#5C7064] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8EA690]" />
                    <span>CANVAS SPASIAL (DAGRE ENGINE)</span>
                  </div>

                  {/* Simulated Spatial Node Graph */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto">
                    {/* Node 1: Root Idea */}
                    <div className="p-3.5 rounded-lg bg-[#121D18] border border-[#1F3028] hover:border-[#8EA690]/40 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-[#8EA690] px-1.5 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                          ROOT IDEA
                        </span>
                        <span className="text-[10px] font-mono text-[#5C7064]">#root</span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#EAF0EB] mb-1">
                        Marketplace Cuci Sepatu Geo-Radius
                      </h4>
                      <p className="text-[11px] text-[#8FA396] line-clamp-2 leading-relaxed">
                        Layanan antar jemput sepatu dengan auto-assign workshop terdekat & live tracking.
                      </p>
                    </div>

                    {/* Node 2: Tech Architecture */}
                    <div className="p-3.5 rounded-lg bg-[#121D18] border border-[#1F3028] hover:border-[#8EA690]/40 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-[#8EA690] px-1.5 py-0.5 rounded bg-[#14221C] border border-[#1F3028]">
                          SEC 2.1 • STACK
                        </span>
                        <span className="text-[10px] font-mono text-[#5C7064]">Rev 2</span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#EAF0EB] mb-1">
                        Next.js 14 + MongoDB GeoJSON
                      </h4>
                      <p className="text-[11px] text-[#8FA396] line-clamp-2 leading-relaxed">
                        Indexing 2dsphere untuk query radius, serverless route handlers, dan SSE worker.
                      </p>
                    </div>

                    {/* Node 3: Mermaid Node (Featured) */}
                    <div
                      onClick={() => setActiveTab("diagram")}
                      className="sm:col-span-2 p-3.5 rounded-lg bg-[#14221C] border border-[#2D4539] hover:border-[#8EA690] transition-colors relative overflow-hidden cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#8EA690] px-1.5 py-0.5 rounded bg-[#1E2E25] border border-[#2D4539]">
                            SEC 2.2 • DIAGRAM
                          </span>
                          <span className="text-xs font-medium text-[#EAF0EB]">
                            Sequence Alur Jemput & Konfirmasi
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8EA690] group-hover:underline">
                          Buka Diagram Penuh →
                        </span>
                      </div>

                      {/* Visual Mermaid Preview inside Canvas */}
                      <div className="py-2 px-3 rounded bg-[#0E1713] border border-[#1F3028] pointer-events-none overflow-hidden max-h-[160px] flex items-center justify-center">
                        <MermaidView
                          code={SAMPLE_MERMAID_DIAGRAM}
                          sectionId="landing-canvas-preview"
                          status="ok"
                          className="w-full scale-90"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "diagram" && (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-[11px] font-mono text-[#5C7064] mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8EA690] animate-pulse" />
                      <span>MERMAID SPECIFICATION ENGINE</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCode(!showCode)}
                        className="text-[11px] font-mono text-[#8EA690] hover:text-[#EAF0EB] px-2 py-0.5 rounded bg-[#14221C] border border-[#1F3028] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Code2 className="w-3 h-3" />
                        <span>{showCode ? "Tampilkan Diagram Visual" : "Lihat Sintaks Kode"}</span>
                      </button>
                      <span className="text-[#8EA690] text-[10px] font-mono hidden sm:inline">
                        Auto-Repaired via LLM
                      </span>
                    </div>
                  </div>

                  {showCode ? (
                    <div className="p-4 rounded-lg bg-[#0E1713] border border-[#1F3028] font-mono text-xs text-[#C2D1C7] leading-relaxed overflow-x-auto max-h-[360px]">
                      <div className="text-[#5C7064] mb-2">{"// Sequence Diagram Alur Jemput Sepatu"}</div>
                      <pre className="text-xs text-[#A6BAAE] font-mono whitespace-pre">
                        {SAMPLE_MERMAID_DIAGRAM}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-2 sm:p-4 rounded-lg bg-[#0E1713] border border-[#1F3028] min-h-[320px] flex items-center justify-center overflow-auto">
                      <MermaidView
                        code={SAMPLE_MERMAID_DIAGRAM}
                        sectionId="landing-main-diagram"
                        status="ok"
                        className="w-full max-w-xl mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === "markdown" && (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-[11px] font-mono text-[#5C7064] mb-3 flex items-center justify-between">
                    <span>RAW EXPORT: prd.md (CURSOR & CLAUDE READY)</span>
                    <span className="text-[#8EA690]">Markdown GFM</span>
                  </div>
                  <pre className="p-4 rounded-lg bg-[#0E1713] border border-[#1F3028] font-mono text-xs text-[#C2D1C7] leading-relaxed max-h-[300px] overflow-y-auto">
                    {RAW_PRD_MD}
                  </pre>
                </div>
              )}

              {/* Bottom Quick-Bar inside App Frame */}
              <div className="mt-4 pt-3 border-t border-[#1F3028] flex items-center justify-between text-xs">
                <span className="text-[#5C7064] font-mono text-[11px]">
                  Terkoneksi ke: <span className="text-[#8EA690]">Cursor, Claude Code, Windsurf</span>
                </span>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-[#8EA690] hover:text-[#EAF0EB] font-mono text-xs font-semibold group cursor-pointer"
                >
                  <span>Coba langsung di Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
