"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-[#0C1310] text-[#EAF0EB]">
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
            "fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-300 ease-in-out",
            isSidebarOpenMobile ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setSidebarOpenMobile(false)}
          aria-hidden={!isSidebarOpenMobile}
        />

        {/* Drawer Panel */}
        <div
          className={cn(
            "relative w-80 max-w-[85vw] h-full bg-[#101A16] border-r border-[#1F3028] shadow-2xl z-10 flex flex-col transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)",
            isSidebarOpenMobile ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar isMobile onCloseMobile={() => setSidebarOpenMobile(false)} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#0C1310]">
        {/* Mobile Header (< 768px): shown only on non-workspace pages */}
        {!isPrdWorkspace && (
          <header className="md:hidden h-14 border-b border-[#1F3028] bg-[#101A16] px-3 sm:px-4 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpenMobile(true)}
                className="w-10 h-10 -ml-1 rounded-md text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#14221C] flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link href="/" className="flex items-center gap-2 group cursor-pointer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand-logo-cropped.png"
                  alt="ngePRD"
                  className="h-6 w-auto object-contain"
                />
              </Link>
            </div>
          </header>
        )}

        {/* Dynamic page outlet */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-[#0C1310]">{children}</div>
      </div>
    </div>
  );
}
