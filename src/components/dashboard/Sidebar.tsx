"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import PrdList from "./PrdList";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isMobile = false, onCloseMobile }: SidebarProps) {
  const router = useRouter();
  const {
    fetchPrds,
    searchQuery,
    setSearchQuery,
    isSidebarCollapsedDesktop,
    toggleSidebarCollapsedDesktop,
    setSidebarOpenMobile,
  } = usePrdStore();

  useEffect(() => {
    fetchPrds();
  }, [fetchPrds]);

  const handleNewPrd = () => {
    setSearchQuery("");
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    } else {
      setSidebarOpenMobile(false);
    }
    router.push("/");
  };

  // If collapsed on desktop and not in mobile drawer
  if (!isMobile && isSidebarCollapsedDesktop) {
    return (
      <aside className="h-full w-14 flex flex-col items-center py-4 bg-slate-50 border-r border-slate-200 shrink-0 transition-all">
        <button
          type="button"
          onClick={toggleSidebarCollapsedDesktop}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          title="Buka sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>

        <div className="my-4 w-8 h-[1px] bg-slate-200" />

        <button
          type="button"
          onClick={handleNewPrd}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          title="PRD baru"
        >
          <Plus className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-slate-50 border-r border-slate-200 shrink-0 select-none",
        isMobile ? "w-full" : "w-72"
      )}
    >
      {/* Header */}
      <div className="p-4 pb-3 flex items-center justify-between border-b border-slate-200/70">
        <Link
          href="/"
          onClick={() => {
            if (isMobile && onCloseMobile) onCloseMobile();
          }}
          className="flex items-center gap-2 group"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
            ngePRD
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebarCollapsedDesktop}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Sembunyikan sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action: New PRD */}
      <div className="p-3 pb-2">
        <button
          type="button"
          onClick={handleNewPrd}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>PRD baru</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 py-1.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari PRD..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              title="Bersihkan pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PRD List */}
      <PrdList />
    </aside>
  );
}
