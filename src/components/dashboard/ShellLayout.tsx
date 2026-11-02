"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Menu, Plus, Sparkles } from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import Sidebar from "./Sidebar";

interface ShellLayoutProps {
  children: React.ReactNode;
}

export default function ShellLayout({ children }: ShellLayoutProps) {
  const { isSidebarOpenMobile, setSidebarOpenMobile } = usePrdStore();

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpenMobile) {
        setSidebarOpenMobile(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpenMobile, setSidebarOpenMobile]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900">
      {/* Desktop Persistent Sidebar (hidden on < 768px) */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer (visible on < 768px when open) */}
      {isSidebarOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSidebarOpenMobile(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl z-10 animate-slide-right">
            <Sidebar isMobile onCloseMobile={() => setSidebarOpenMobile(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Mobile Header (< 768px) */}
        <header className="md:hidden h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpenMobile(true)}
              className="p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-base text-slate-900 tracking-tight">
                ngePRD
              </span>
            </Link>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Baru</span>
          </Link>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto h-full">{children}</main>
      </div>
    </div>
  );
}
