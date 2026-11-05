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
        "h-full flex flex-col bg-[#101A16] border-r border-[#1F3028] shrink-0 select-none transition-[width] duration-300 ease-in-out overflow-hidden",
        isMobile ? "w-full" : isCollapsed ? "w-16" : "w-72"
      )}
    >
      {isCollapsed ? (
        /* Collapsed Desktop State */
        <div className="h-full flex flex-col items-center py-3.5 justify-between animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            {/* Logo Image */}
            <Link
              href="/"
              className="p-1 rounded-md hover:bg-[#14221C] transition-colors group cursor-pointer flex items-center justify-center"
              title="ngePRD"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand-icon.png"
                alt="ngePRD"
                className="w-7 h-7 object-contain"
              />
            </Link>

            {/* Expand Sidebar Button */}
            <button
              type="button"
              onClick={toggleSidebarCollapsedDesktop}
              className="p-2 rounded-md text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#14221C] transition-all duration-200 active:scale-95 cursor-pointer"
              title="Buka sidebar"
              aria-label="Buka sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            <div className="w-8 h-[1px] bg-[#1F3028]" />

            {/* New PRD Button */}
            <button
              type="button"
              onClick={handleNewPrd}
              className="w-10 h-10 rounded-md bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
              title="PRD baru"
              aria-label="Buat PRD baru"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
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
          <div className="p-4 pb-3 flex items-center justify-between border-b border-[#1F3028] shrink-0">
            <Link
              href="/"
              onClick={() => {
                if (isMobile && onCloseMobile) onCloseMobile();
              }}
              className="flex items-center gap-2 group cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand-logo-cropped.png"
                alt="ngePRD"
                className="h-6 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </Link>

            <div className="flex items-center gap-1">
              {isMobile ? (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="w-8 h-8 rounded-md text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#14221C] flex items-center justify-center transition-all duration-200 cursor-pointer"
                  title="Tutup Menu"
                  aria-label="Tutup menu"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleSidebarCollapsedDesktop}
                  className="p-1.5 rounded-md text-[#6E8276] hover:text-[#EAF0EB] hover:bg-[#14221C] transition-all duration-200 active:scale-95 cursor-pointer"
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
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-md bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Buat PRD Baru</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="px-3 py-1.5 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#586C61] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Cari PRD..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-[#22352B] bg-[#14221C] placeholder-[#586C61] text-[#EAF0EB] focus:outline-none focus:border-[#8EA690] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#586C61] hover:text-[#EAF0EB] rounded cursor-pointer transition-colors"
                  title="Bersihkan pencarian"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* PRD List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <PrdList />
          </div>

          {/* User Menu & Daily Quota Footer */}
          <div className="shrink-0 mt-auto border-t border-[#1F3028]">
            <UserMenu />
          </div>
        </div>
      )}
    </aside>
  );
}
