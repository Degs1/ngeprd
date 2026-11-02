"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import { usePrdStore } from "@/store/usePrdStore";
import Sidebar from "./Sidebar";
import { cn } from "@/lib/utils";

interface ShellLayoutProps {
  children: React.ReactNode;
}

export default function ShellLayout({ children }: ShellLayoutProps) {
  const pathname = usePathname();
  const { isSidebarOpenMobile, setSidebarOpenMobile } = usePrdStore();
  const isPrdWorkspace = Boolean(pathname?.startsWith("/prd/"));

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

  // Auto-close mobile drawer when route changes
  useEffect(() => {
    setSidebarOpenMobile(false);
  }, [pathname, setSidebarOpenMobile]);

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-white text-slate-900">
      {/* Desktop Persistent Sidebar (hidden on < 768px) */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer (visible on < 768px with smooth slide and backdrop fade animation) */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50 flex transition-all duration-300 ease-in-out",
          isSidebarOpenMobile ? "pointer-events-auto visible" : "pointer-events-none invisible"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu Navigasi"
      >
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out",
            isSidebarOpenMobile ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setSidebarOpenMobile(false)}
          aria-hidden={!isSidebarOpenMobile}
        />

        {/* Drawer Panel */}
        <div
          className={cn(
            "relative w-80 max-w-[85vw] h-full bg-white shadow-2xl z-10 flex flex-col transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)",
            isSidebarOpenMobile ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar isMobile onCloseMobile={() => setSidebarOpenMobile(false)} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Mobile Header (< 768px): shown only on non-workspace pages so PRD workspace doesn't have duplicate stacked headers */}
        {!isPrdWorkspace && (
          <header className="md:hidden h-14 border-b border-slate-200 bg-white px-3 sm:px-4 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpenMobile(true)}
                className="w-10 h-10 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link href="/" className="flex items-center gap-2 group cursor-pointer">
                <div className="w-7 h-7 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-icon.png"
                    alt="ngePRD"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center">
                  <span className="text-sky-500">nge</span>
                  <span className="text-blue-700">PRD</span>
                </span>
              </Link>
            </div>

            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Baru</span>
            </Link>
          </header>
        )}

        {/* Content View */}
        <main className="flex-1 overflow-y-auto h-full min-h-0">{children}</main>
      </div>
    </div>
  );
}
