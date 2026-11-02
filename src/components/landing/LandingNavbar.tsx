"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, X, ArrowRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "alur-kerja", label: "Alur Kerja" },
  { id: "preview", label: "Preview PRD & Canvas" },
  { id: "fitur", label: "Fitur Utama" },
  { id: "arsitektur", label: "Spesifikasi Engine" },
];

export default function LandingNavbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);

      const scrollPosition = window.scrollY + 130;
      let currentSection = "";

      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentSection = item.id;
            break;
          }
        }
      }

      if (window.scrollY < 200) {
        currentSection = "";
      }
      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

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

      // Broadcast highlight event for target section animation
      window.dispatchEvent(
        new CustomEvent("section-highlight", { detail: { id: targetId } })
      );
    }
  };

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
          isScrolled
            ? "bg-white/90 backdrop-blur-md border-b border-[#E1E5EC] shadow-xs"
            : "bg-white/95 backdrop-blur-xs border-b border-[#E1E5EC]"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand / Logo */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon.png"
                alt="ngePRD"
                className="w-8 h-8 object-contain"
              />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-[#20242C] flex items-center">
              <span className="text-sky-500">nge</span>
              <span className="text-blue-700">PRD</span>
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hidden sm:inline-block ml-1">
              v2.1
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer relative",
                    isActive
                      ? "text-[#2854EB] bg-[#EEF2FD] font-semibold"
                      : "text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA]"
                  )}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-[#2854EB] rounded-full" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-[#2854EB] hover:bg-[#1D44D8] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all duration-200 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Buka Workspace</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA] transition-colors cursor-pointer"
                >
                  Masuk
                </Link>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg bg-[#2854EB] hover:bg-[#1D44D8] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Buka Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 rounded-lg text-[#596273] hover:text-[#20242C] hover:bg-[#F5F7FA] flex items-center justify-center transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu navigasi"}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E1E5EC] bg-white px-4 py-4 flex flex-col gap-3 shadow-lg animate-slide-down">
            <nav className="flex flex-col gap-1 text-sm font-medium text-[#596273]">
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => handleNavClick(e, item.id)}
                    className={cn(
                      "px-3 py-2 rounded-md transition-colors cursor-pointer flex items-center justify-between",
                      isActive
                        ? "bg-[#EEF2FD] text-[#2854EB] font-semibold"
                        : "hover:bg-[#F5F7FA] hover:text-[#20242C]"
                    )}
                  >
                    <span>{item.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2854EB]" />}
                  </a>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-[#E1E5EC] flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 rounded-lg bg-[#2854EB] text-white text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Buka Workspace</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2 rounded-lg text-center text-sm font-medium text-[#596273] bg-[#F5F7FA] border border-[#E1E5EC]"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 rounded-lg bg-[#2854EB] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>Mulai Buat PRD</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      {/* Spacer to preserve document layout under fixed navbar */}
      <div className="h-16 w-full shrink-0" aria-hidden="true" />
    </>
  );
}
