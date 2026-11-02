"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, Sparkles, Layers, MoveRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CursorDef {
  id: "research" | "product" | "ux" | "review";
  name: string;
  color: string;
  targetSlot: number;
}

const CURSORS: CursorDef[] = [
  {
    id: "research",
    name: "Research",
    color: "#6366F1", // Indigo
    targetSlot: 1, // Kicker badge
  },
  {
    id: "product",
    name: "Product",
    color: "#2854EB", // Electric Blue
    targetSlot: 2, // Headline
  },
  {
    id: "ux",
    name: "UX",
    color: "#0D9488", // Teal
    targetSlot: 3, // Description
  },
  {
    id: "review",
    name: "Review",
    color: "#D97706", // Amber
    targetSlot: 4, // CTA Actions
  },
];

interface CursorLiveState {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  isClicking: boolean;
  visible: boolean;
}

interface SlotLiveState {
  revealed: boolean;
  revealProgress: number; // 0 to 1
  outlineVisible: boolean;
  outlineColor: string;
  outlineLabel: string;
}

const SAMPLE_IDEAS = [
  "Web marketplace jasa cuci sepatu berbasis lokasi dengan payment gateway dan pelacakan status pesanan real-time",
  "Aplikasi POS kasir kafe offline-first untuk tablet dengan sinkronisasi cloud dan cetak struk bluetooth",
  "SaaS manajemen kos & kontrakan dengan invoice otomatis via WhatsApp dan laporan laba-rugi",
];

export default function HeroCursorAnimation() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);

  // Slot element refs
  const slot1Ref = useRef<HTMLDivElement>(null); // Kicker badge
  const slot2Ref = useRef<HTMLDivElement>(null); // Headline
  const slot3Ref = useRef<HTMLDivElement>(null); // Description
  const slot4Ref = useRef<HTMLDivElement>(null); // CTA Actions

  // Interactive quick idea state
  const [quickIdea, setQuickIdea] = useState("");

  // Animation status: "idle" | "running" | "completed"
  const [animStatus, setAnimStatus] = useState<"idle" | "running" | "completed">("idle");
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Live cursor positions
  const [cursorStates, setCursorStates] = useState<Record<string, CursorLiveState>>({
    research: { x: -60, y: -60, opacity: 0, scale: 0.8, isClicking: false, visible: false },
    product: { x: -60, y: -60, opacity: 0, scale: 0.8, isClicking: false, visible: false },
    ux: { x: -60, y: -60, opacity: 0, scale: 0.8, isClicking: false, visible: false },
    review: { x: -60, y: -60, opacity: 0, scale: 0.8, isClicking: false, visible: false },
  });

  // Slot states
  const [slots, setSlots] = useState<SlotLiveState[]>([
    { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#6366F1", outlineLabel: "Research" },
    { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#2854EB", outlineLabel: "Product" },
    { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#0D9488", outlineLabel: "UX" },
    { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#D97706", outlineLabel: "Review" },
  ]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mediaQuery.matches) {
        setIsReducedMotion(true);
        setAnimStatus("completed");
      }
    }
  }, []);

  // Compute bounding boxes of slots relative to heroRef
  const getSlotTargets = useCallback(() => {
    if (!heroRef.current) return null;
    const heroRect = heroRef.current.getBoundingClientRect();

    const getCenter = (el: HTMLElement | null, offsetXRatio = 0.5, offsetYRatio = 0.5) => {
      if (!el) {
        return {
          x: heroRect.width / 2,
          y: heroRect.height / 2,
          width: 200,
          height: 40,
          left: 0,
          top: 0,
        };
      }
      const r = el.getBoundingClientRect();
      return {
        x: r.left - heroRect.left + r.width * offsetXRatio,
        y: r.top - heroRect.top + r.height * offsetYRatio,
        width: r.width,
        height: r.height,
        left: r.left - heroRect.left,
        top: r.top - heroRect.top,
      };
    };

    return {
      heroWidth: heroRect.width || 800,
      heroHeight: heroRect.height || 600,
      slot1: getCenter(slot1Ref.current, 0.4, 0.5),
      slot2: getCenter(slot2Ref.current, 0.2, 0.5),
      slot2End: getCenter(slot2Ref.current, 0.85, 0.5),
      slot3: getCenter(slot3Ref.current, 0.25, 0.4),
      slot3End: getCenter(slot3Ref.current, 0.85, 0.6),
      slot4: getCenter(slot4Ref.current, 0.35, 0.5),
    };
  }, []);

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Run the 4-cursor collaborative assembly animation
  const startAnimation = useCallback(() => {
    if (isReducedMotion) {
      setAnimStatus("completed");
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setAnimStatus("running");
    const animStartTime = Date.now();
    startTimeRef.current = animStartTime;

    // Reset initial slot states to 0 progress during assembly
    setSlots([
      { revealed: false, revealProgress: 0, outlineVisible: false, outlineColor: "#6366F1", outlineLabel: "Research" },
      { revealed: false, revealProgress: 0, outlineVisible: false, outlineColor: "#2854EB", outlineLabel: "Product" },
      { revealed: false, revealProgress: 0, outlineVisible: false, outlineColor: "#0D9488", outlineLabel: "UX" },
      { revealed: false, revealProgress: 0, outlineVisible: false, outlineColor: "#D97706", outlineLabel: "Review" },
    ]);

    const TOTAL_DURATION = 3800; // 3.8s total duration

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - animStartTime;
      const progress = Math.min(elapsed / TOTAL_DURATION, 1);

      const targets = getSlotTargets();
      const w = targets?.heroWidth || 800;
      const h = targets?.heroHeight || 600;

      const t1 = targets?.slot1 || { x: w * 0.5, y: 30 };
      const t2Start = targets?.slot2 || { x: w * 0.2, y: 120 };
      const t2End = targets?.slot2End || { x: w * 0.8, y: 120 };
      const t3Start = targets?.slot3 || { x: w * 0.25, y: 220 };
      const t3End = targets?.slot3End || { x: w * 0.8, y: 220 };
      const t4 = targets?.slot4 || { x: w * 0.4, y: 320 };

      // Spawn starting points
      const pSpawnResearch = { x: Math.max(10, w * 0.08), y: -20 };
      const pSpawnProduct = { x: w * 0.92, y: Math.max(10, h * 0.1) };
      const pSpawnUX = { x: Math.max(5, w * 0.05), y: h * 0.75 };
      const pSpawnReview = { x: w * 0.88, y: h * 0.85 };

      // --- Cursor 1: Research (Slot 1: Kicker) ---
      let c1X = pSpawnResearch.x;
      let c1Y = pSpawnResearch.y;
      let c1Opacity = 0;
      let c1Clicking = false;
      let slot1Progress = 0;
      let slot1Outline = false;

      if (elapsed >= 50 && elapsed < 3500) {
        c1Opacity = Math.min((elapsed - 50) / 200, 1);
        if (elapsed < 550) {
          const moveP = easeOutCubic((elapsed - 50) / 500);
          c1X = pSpawnResearch.x + (t1.x - pSpawnResearch.x) * moveP;
          c1Y = pSpawnResearch.y + (t1.y - pSpawnResearch.y) * moveP;
          c1Clicking = elapsed >= 450 && elapsed <= 550;
        } else if (elapsed < 1100) {
          c1X = t1.x + Math.sin((elapsed - 550) / 100) * 8;
          c1Y = t1.y;
          slot1Progress = Math.min((elapsed - 550) / 450, 1);
          slot1Outline = elapsed < 1000;
        } else {
          c1X = t1.x + 30;
          c1Y = t1.y - 12;
          slot1Progress = 1;
          slot1Outline = false;
        }
      } else if (elapsed >= 3500) {
        c1Opacity = Math.max(0, 1 - (elapsed - 3500) / 300);
        c1X = t1.x + 35;
        c1Y = t1.y - 15;
        slot1Progress = 1;
      }

      // --- Cursor 2: Product (Slot 2: Headline) ---
      let c2X = pSpawnProduct.x;
      let c2Y = pSpawnProduct.y;
      let c2Opacity = 0;
      let c2Clicking = false;
      let slot2Progress = 0;
      let slot2Outline = false;

      if (elapsed >= 250 && elapsed < 3500) {
        c2Opacity = Math.min((elapsed - 250) / 200, 1);
        if (elapsed < 900) {
          const moveP = easeOutCubic((elapsed - 250) / 650);
          c2X = pSpawnProduct.x + (t2Start.x - pSpawnProduct.x) * moveP;
          c2Y = pSpawnProduct.y + (t2Start.y - pSpawnProduct.y) * moveP;
          c2Clicking = elapsed >= 850 && elapsed <= 950;
        } else if (elapsed < 2000) {
          const sweepP = easeInOutQuad((elapsed - 900) / 1100);
          c2X = t2Start.x + (t2End.x - t2Start.x) * sweepP;
          c2Y = t2Start.y + (t2End.y - t2Start.y) * sweepP;
          slot2Progress = Math.min((elapsed - 900) / 1000, 1);
          slot2Outline = elapsed < 1950;
        } else {
          c2X = t2End.x + 10;
          c2Y = t2End.y;
          slot2Progress = 1;
          slot2Outline = false;
        }
      } else if (elapsed >= 3500) {
        c2Opacity = Math.max(0, 1 - (elapsed - 3500) / 300);
        c2X = t2End.x + 25;
        c2Y = t2End.y;
        slot2Progress = 1;
      }

      // --- Cursor 3: UX (Slot 3: Description) ---
      let c3X = pSpawnUX.x;
      let c3Y = pSpawnUX.y;
      let c3Opacity = 0;
      let c3Clicking = false;
      let slot3Progress = 0;
      let slot3Outline = false;

      if (elapsed >= 1200 && elapsed < 3500) {
        c3Opacity = Math.min((elapsed - 1200) / 200, 1);
        if (elapsed < 1800) {
          const moveP = easeOutCubic((elapsed - 1200) / 600);
          c3X = pSpawnUX.x + (t3Start.x - pSpawnUX.x) * moveP;
          c3Y = pSpawnUX.y + (t3Start.y - pSpawnUX.y) * moveP;
          c3Clicking = elapsed >= 1750 && elapsed <= 1850;
        } else if (elapsed < 2700) {
          const sweepP = easeInOutQuad((elapsed - 1800) / 900);
          c3X = t3Start.x + (t3End.x - t3Start.x) * sweepP;
          c3Y = t3Start.y + (t3End.y - t3Start.y) * sweepP;
          slot3Progress = Math.min((elapsed - 1800) / 800, 1);
          slot3Outline = elapsed < 2650;
        } else {
          c3X = t3End.x + 8;
          c3Y = t3End.y;
          slot3Progress = 1;
          slot3Outline = false;
        }
      } else if (elapsed >= 3500) {
        c3Opacity = Math.max(0, 1 - (elapsed - 3500) / 300);
        c3X = t3End.x + 20;
        c3Y = t3End.y;
        slot3Progress = 1;
      }

      // --- Cursor 4: Review (Slot 4: CTA Actions) ---
      let c4X = pSpawnReview.x;
      let c4Y = pSpawnReview.y;
      let c4Opacity = 0;
      let c4Clicking = false;
      let slot4Progress = 0;
      let slot4Outline = false;

      if (elapsed >= 2000 && elapsed < 3500) {
        c4Opacity = Math.min((elapsed - 2000) / 200, 1);
        if (elapsed < 2600) {
          const moveP = easeOutCubic((elapsed - 2000) / 600);
          c4X = pSpawnReview.x + (t4.x - pSpawnReview.x) * moveP;
          c4Y = pSpawnReview.y + (t4.y - pSpawnReview.y) * moveP;
          c4Clicking = elapsed >= 2550 && elapsed <= 2650;
        } else if (elapsed < 3300) {
          c4X = t4.x + Math.cos((elapsed - 2600) / 120) * 8;
          c4Y = t4.y;
          slot4Progress = Math.min((elapsed - 2600) / 650, 1);
          slot4Outline = elapsed < 3250;
        } else {
          c4X = t4.x + 15;
          c4Y = t4.y;
          slot4Progress = 1;
          slot4Outline = false;
        }
      } else if (elapsed >= 3500) {
        c4Opacity = Math.max(0, 1 - (elapsed - 3500) / 300);
        c4X = t4.x + 25;
        c4Y = t4.y;
        slot4Progress = 1;
      }

      // Commit cursor states
      setCursorStates({
        research: {
          x: c1X,
          y: c1Y,
          opacity: c1Opacity,
          scale: c1Clicking ? 0.85 : 1,
          isClicking: c1Clicking,
          visible: c1Opacity > 0.01,
        },
        product: {
          x: c2X,
          y: c2Y,
          opacity: c2Opacity,
          scale: c2Clicking ? 0.85 : 1,
          isClicking: c2Clicking,
          visible: c2Opacity > 0.01,
        },
        ux: {
          x: c3X,
          y: c3Y,
          opacity: c3Opacity,
          scale: c3Clicking ? 0.85 : 1,
          isClicking: c3Clicking,
          visible: c3Opacity > 0.01,
        },
        review: {
          x: c4X,
          y: c4Y,
          opacity: c4Opacity,
          scale: c4Clicking ? 0.85 : 1,
          isClicking: c4Clicking,
          visible: c4Opacity > 0.01,
        },
      });

      // Commit slot states
      setSlots([
        {
          revealed: slot1Progress > 0,
          revealProgress: slot1Progress,
          outlineVisible: slot1Outline,
          outlineColor: "#6366F1",
          outlineLabel: "Research",
        },
        {
          revealed: slot2Progress > 0,
          revealProgress: slot2Progress,
          outlineVisible: slot2Outline,
          outlineColor: "#2854EB",
          outlineLabel: "Product",
        },
        {
          revealed: slot3Progress > 0,
          revealProgress: slot3Progress,
          outlineVisible: slot3Outline,
          outlineColor: "#0D9488",
          outlineLabel: "UX",
        },
        {
          revealed: slot4Progress > 0,
          revealProgress: slot4Progress,
          outlineVisible: slot4Outline,
          outlineColor: "#D97706",
          outlineLabel: "Review",
        },
      ]);

      if (progress >= 1) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setAnimStatus("completed");
        setSlots([
          { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#6366F1", outlineLabel: "Research" },
          { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#2854EB", outlineLabel: "Product" },
          { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#0D9488", outlineLabel: "UX" },
          { revealed: true, revealProgress: 1, outlineVisible: false, outlineColor: "#D97706", outlineLabel: "Review" },
        ]);
        setCursorStates({
          research: { x: 0, y: 0, opacity: 0, scale: 1, isClicking: false, visible: false },
          product: { x: 0, y: 0, opacity: 0, scale: 1, isClicking: false, visible: false },
          ux: { x: 0, y: 0, opacity: 0, scale: 1, isClicking: false, visible: false },
          review: { x: 0, y: 0, opacity: 0, scale: 1, isClicking: false, visible: false },
        });
      }
    }, 20);
  }, [getSlotTargets, isReducedMotion]);

  // Trigger animation automatically once mounted
  useEffect(() => {
    const timer = setTimeout(() => {
      startAnimation();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAnimation]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickIdea.trim()) return;

    try {
      localStorage.setItem("ngeprd_draft_idea", quickIdea.trim());
    } catch {}
    router.push("/dashboard");
  };

  const handlePickSample = (text: string) => {
    setQuickIdea(text);
    try {
      localStorage.setItem("ngeprd_draft_idea", text);
    } catch {}
    router.push("/dashboard");
  };

  // Helper for computing slot reveal styles
  const getSlotStyle = (slotIdx: number): React.CSSProperties => {
    if (animStatus === "completed" || isReducedMotion || animStatus === "idle") {
      return {
        clipPath: "none",
        filter: "none",
        opacity: 1,
      };
    }

    const slot = slots[slotIdx];
    const p = slot.revealProgress;

    if (p <= 0) {
      return {
        clipPath: "inset(0 100% 0 0)",
        filter: "blur(5px)",
        opacity: 0.1,
        transition: "none",
      };
    }

    const remaining = (1 - p) * 100;
    const blurAmount = (1 - p) * 3;

    return {
      clipPath: `inset(0 ${remaining.toFixed(1)}% 0 0)`,
      filter: blurAmount > 0.1 ? `blur(${blurAmount.toFixed(1)}px)` : "none",
      opacity: Math.min(0.2 + p * 0.8, 1),
      transition: "none",
    };
  };

  return (
    <div
      ref={heroRef}
      className="relative w-full max-w-5xl mx-auto pt-8 sm:pt-14 pb-12 sm:pb-16 px-4 sm:px-6 flex flex-col items-center text-center select-none"
    >
      {/* 4 Interactive Assembly Cursors Layer */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden" aria-hidden="true">
        {CURSORS.map((cursor) => {
          const state = cursorStates[cursor.id];
          if (!state || !state.visible) return null;

          return (
            <div
              key={cursor.id}
              className="absolute transition-transform duration-75 will-change-transform flex items-start gap-1"
              style={{
                transform: `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`,
                opacity: state.opacity,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow-md">
                <path
                  d="M4 3L11.5 21L14.5 13.5L22 10.5L4 3Z"
                  fill={cursor.color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>

              <span
                className="text-[10px] font-bold tracking-wider uppercase text-white px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 select-none whitespace-nowrap"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* --- SLOT 1: Kicker / Tagline Badge --- */}
      <div className="relative inline-block mb-4 sm:mb-6" ref={slot1Ref}>
        {slots[0].outlineVisible && (
          <div
            className="absolute -inset-1.5 rounded-full pointer-events-none border border-indigo-500 z-20 animate-fade-in"
            style={{ borderColor: slots[0].outlineColor }}
          >
            <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-indigo-600 rounded-2xs" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-indigo-600 rounded-2xs" />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-indigo-600 rounded-2xs" />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-indigo-600 rounded-2xs" />
            <span className="absolute -top-5 left-1 text-[9px] font-semibold tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded">
              Research
            </span>
          </div>
        )}

        <div
          style={getSlotStyle(0)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-semibold shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>VISUAL PRD PLANNER UNTUK SOLO BUILDER & ENGINEERING TEAM</span>
        </div>
      </div>

      {/* --- SLOT 2: Headline H1 --- */}
      <div className="relative w-full max-w-4xl mx-auto mb-4 sm:mb-6" ref={slot2Ref}>
        {slots[1].outlineVisible && (
          <div
            className="absolute -inset-2 rounded-xl pointer-events-none border-2 border-[#2854EB] z-20 animate-fade-in"
            style={{ borderColor: slots[1].outlineColor }}
          >
            <span className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2854EB] rounded-2xs" />
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2854EB] rounded-2xs" />
            <span className="absolute -bottom-1.5 -left-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2854EB] rounded-2xs" />
            <span className="absolute -bottom-1.5 -right-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2854EB] rounded-2xs" />
            <span className="absolute -top-6 left-2 text-[10px] font-bold tracking-wide text-white bg-[#2854EB] px-1.5 py-0.5 rounded shadow-2xs">
              Product: H1
            </span>
          </div>
        )}

        <h1
          style={getSlotStyle(1)}
          className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#20242C] tracking-tight leading-[1.12]"
        >
          Ubah 1 Kalimat Ide Menjadi PRD Terstruktur, Diagram Mermaid, dan Canvas Siap Eksekusi.
        </h1>
      </div>

      {/* --- SLOT 3: Product Description --- */}
      <div className="relative w-full max-w-2xl mx-auto mb-8 sm:mb-10" ref={slot3Ref}>
        {slots[2].outlineVisible && (
          <div
            className="absolute -inset-2 rounded-xl pointer-events-none border border-teal-600 z-20 animate-fade-in"
            style={{ borderColor: slots[2].outlineColor }}
          >
            <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-teal-600 rounded-2xs" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-teal-600 rounded-2xs" />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-teal-600 rounded-2xs" />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-teal-600 rounded-2xs" />
            <span className="absolute -top-5 left-2 text-[9px] font-semibold tracking-wide text-teal-800 bg-teal-50 border border-teal-200 px-1 rounded">
              UX: Copy
            </span>
          </div>
        )}

        <p
          style={getSlotStyle(2)}
          className="text-sm sm:text-lg text-[#596273] leading-relaxed font-normal"
        >
          ngePRD memandu ide Anda lewat 4–6 pertanyaan arsitektur interaktif, lalu merumuskan spesifikasi lengkap:
          bab bernomor, canvas node & outline dua arah, diagram alur/ERD otomatis, dan revisi change set terisolasi sebelum
          diserahkan ke Cursor, Antigravity, atau Claude Code.
        </p>
      </div>

      {/* --- SLOT 4: CTA Buttons & Supporting Actions --- */}
      <div className="relative w-full max-w-xl mx-auto mb-6" ref={slot4Ref}>
        {slots[3].outlineVisible && (
          <div
            className="absolute -inset-2 rounded-2xl pointer-events-none border border-amber-500 z-20 animate-fade-in"
            style={{ borderColor: slots[3].outlineColor }}
          >
            <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-amber-600 rounded-2xs" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-amber-600 rounded-2xs" />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-amber-600 rounded-2xs" />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-amber-600 rounded-2xs" />
            <span className="absolute -top-5 left-2 text-[9px] font-semibold tracking-wide text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded">
              Review: CTAs
            </span>
          </div>
        )}

        <div
          style={getSlotStyle(3)}
          className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full"
        >
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-[#2854EB] hover:bg-[#1D44D8] text-white font-semibold text-sm sm:text-base tracking-tight shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Mulai Buat PRD Sekarang</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <a
            href="#preview"
            className="w-full sm:w-auto px-5 py-3.5 rounded-lg bg-white hover:bg-[#F5F7FA] text-[#20242C] font-semibold text-sm sm:text-base border border-[#E1E5EC] transition-all duration-200 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-[#596273]" />
            <span>Lihat Contoh PRD & Canvas</span>
          </a>
        </div>
      </div>

      {/* Small Replay Animation Control Button */}
      <div className="flex items-center justify-center gap-2 mt-1 mb-8">
        <button
          type="button"
          onClick={startAnimation}
          disabled={animStatus === "running"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA] border border-[#E1E5EC] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Putar ulang animasi perakitan kursor hero"
          aria-label="Putar ulang animasi kursor"
        >
          <RotateCcw className={cn("w-3.5 h-3.5", animStatus === "running" && "animate-spin")} />
          <span>{animStatus === "running" ? "Merakit komponen..." : "Putar Ulang Perakitan Hero"}</span>
        </button>
      </div>

      {/* Quick Interactive Idea Starter Box */}
      <div className="w-full max-w-2xl bg-white border border-[#E1E5EC] rounded-xl p-3 sm:p-4 shadow-sm text-left">
        <div className="flex items-center justify-between mb-2 px-1">
          <label htmlFor="landing-idea-input" className="text-xs font-semibold text-[#20242C] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2854EB]" />
            <span>Coba langsung dari ide produkmu:</span>
          </label>
          <span className="text-[11px] text-[#596273]">Gratis • Tanpa kartu kredit</span>
        </div>

        <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
          <input
            id="landing-idea-input"
            type="text"
            value={quickIdea}
            onChange={(e) => setQuickIdea(e.target.value)}
            placeholder="Misal: Web marketplace jasa cuci sepatu berbasis lokasi dengan payment gateway..."
            className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm text-[#20242C] placeholder-[#596273]/60 bg-[#F5F7FA] border border-[#E1E5EC] rounded-lg focus:outline-none focus:border-[#2854EB] focus:ring-1 focus:ring-[#2854EB] transition-all"
          />
          <button
            type="submit"
            disabled={!quickIdea.trim()}
            className="px-4 py-2.5 rounded-lg bg-[#2854EB] hover:bg-[#1D44D8] text-white text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span>Lanjut ke Tanya Jawab</span>
            <MoveRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* 3 Real Sample Ideas from Codebase */}
        <div className="mt-3 pt-3 border-t border-[#E1E5EC]/70">
          <p className="text-[11px] font-medium text-[#596273] mb-2 px-1">
            Atau pilih contoh ide nyata untuk mencoba:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_IDEAS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePickSample(sample)}
                className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-[#F5F7FA] hover:bg-slate-200/80 text-[#20242C] border border-[#E1E5EC] transition-colors cursor-pointer truncate max-w-full"
                title={sample}
              >
                {sample.slice(0, 52)}...
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
