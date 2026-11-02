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
} from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import PrdList from "./PrdList";
import UserMenu from "./UserMenu";
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
    router.push("/dashboard");
  };

  const isCollapsed = !isMobile && isSidebarCollapsedDesktop;

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-slate-50 border-r border-slate-200 shrink-0 select-none transition-[width] duration-300 ease-in-out overflow-hidden",
        isMobile ? "w-full" : isCollapsed ? "w-16" : "w-72"
      )}
    >
      {isCollapsed ? (
        /* Collapsed Desktop State */
        <div className="h-full flex flex-col items-center py-3.5 justify-between animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            {/* Logo Icon */}
            <Link
              href="/"
              className="p-1 rounded-xl hover:bg-slate-200/60 transition-colors group cursor-pointer"
              title="ngePRD"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon.png"
                alt="ngePRD"
                className="w-8 h-8 object-contain group-hover:scale-105 transition-transform duration-200"
              />
            </Link>

            {/* Expand Sidebar Button */}
            <button
              type="button"
              onClick={toggleSidebarCollapsedDesktop}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-all duration-200 active:scale-90 cursor-pointer"
              title="Buka sidebar"
              aria-label="Buka sidebar"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            <div className="w-8 h-[1px] bg-slate-200" />

            {/* New PRD Button */}
            <button
              type="button"
              onClick={handleNewPrd}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-200 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
              title="PRD baru"
              aria-label="Buat PRD baru"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-auto pt-3 flex flex-col items-center">
            <UserMenu collapsed />
          </div>
        </div>
      ) : (
        /* Expanded State (Desktop or Mobile Drawer) */
        <div className="h-full flex flex-col min-w-[288px] animate-fade-in">
          {/* Header */}
          <div className="p-4 pb-3 flex items-center justify-between border-b border-slate-200/70 shrink-0">
            <Link
              href="/"
              onClick={() => {
                if (isMobile && onCloseMobile) onCloseMobile();
              }}
              className="flex items-center gap-2.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-icon.png"
                  alt="ngePRD Icon"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center">
                <span className="text-sky-500">nge</span>
                <span className="text-blue-700">PRD</span>
              </span>
            </Link>

            <div className="flex items-center gap-1">
              {isMobile ? (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 active:bg-slate-200 flex items-center justify-center transition-all duration-200 hover:rotate-90 cursor-pointer"
                  title="Tutup Menu"
                  aria-label="Tutup menu"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleSidebarCollapsedDesktop}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all duration-200 active:scale-90 cursor-pointer"
                  title="Sembunyikan sidebar"
                  aria-label="Sembunyikan sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Action: New PRD */}
          <div className="p-3 pb-2 shrink-0">
            <button
              type="button"
              onClick={handleNewPrd}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>PRD baru</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="px-3 py-1.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Cari PRD..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition-colors"
                  title="Bersihkan pencarian"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* PRD List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <PrdList />
          </div>

          {/* User Menu & Daily Quota Footer */}
          <div className="shrink-0 mt-auto">
            <UserMenu />
          </div>
        </div>
      )}
    </aside>
  );
}
