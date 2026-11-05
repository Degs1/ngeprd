"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, X, ArrowRight, LayoutDashboard, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "showcase", label: "Live Canvas" },
  { id: "pipeline", label: "Alur Pipeline" },
  { id: "fitur", label: "Spesifikasi Teknis" },
  { id: "specimen", label: "Spesimen prd.md" },
];

export default function LandingNavbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const scrollPosition = window.scrollY + 140;
      let current = "";

      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            current = item.id;
            break;
          }
        }
      }

      if (window.scrollY < 250) {
        current = "";
      }
      setActiveSection(current);
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
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
          isScrolled
            ? "bg-[#0C1310]/95 backdrop-blur-md border-b border-[#1F3028] shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            : "bg-[#0C1310]/80 backdrop-blur-xs border-b border-[#1F3028]/60"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo with User's Uploaded Photo */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer select-none">
            <div className="relative flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand-logo-cropped.png"
                alt="ngePRD"
                className="h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
              />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-[#1F3028] bg-[#121D18] text-[#8EA690] hidden sm:inline-block">
              v2.2
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-mono tracking-tight">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                  className={cn(
                    "px-3 py-1.5 rounded transition-all duration-150 cursor-pointer relative",
                    isActive
                      ? "text-[#EAF0EB] bg-[#14221C] border border-[#1F3028]"
                      : "text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#121D18]"
                  )}
                >
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Desktop Auth / CTA Actions */}
          <div className="hidden sm:flex items-center gap-2.5">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 rounded-md bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] font-sans font-semibold text-xs tracking-tight transition-all duration-150 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-md text-xs font-sans text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#121D18] border border-transparent hover:border-[#1F3028] transition-all duration-150 cursor-pointer"
                >
                  Masuk
                </Link>
                <Link
                  href="/dashboard"
                  className="px-3.5 py-1.5 rounded-md bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310] font-sans font-semibold text-xs tracking-tight transition-all duration-150 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Mulai PRD</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/dashboard"
              className="px-2.5 py-1 rounded bg-[#8EA690] text-[#0C1310] font-semibold text-xs tracking-tight"
            >
              Mulai
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-[#8FA396] hover:text-[#EAF0EB] hover:bg-[#121D18] border border-[#1F3028] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-[#0C1310] border-b border-[#1F3028] px-4 py-4 space-y-2 animate-fade-in shadow-xl">
            <nav className="flex flex-col space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                  className="px-3 py-2 rounded text-xs font-mono text-[#C2D1C7] hover:text-[#EAF0EB] hover:bg-[#121D18] transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="pt-3 border-t border-[#1F3028] flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="w-full py-2.5 rounded bg-[#8EA690] text-[#0C1310] text-center font-semibold text-xs"
                >
                  Buka Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="w-full py-2 rounded border border-[#1F3028] text-center text-xs text-[#C2D1C7] bg-[#121D18]"
                  >
                    Masuk Akun
                  </Link>
                  <Link
                    href="/dashboard"
                    className="w-full py-2 rounded bg-[#8EA690] text-[#0C1310] text-center font-semibold text-xs"
                  >
                    Mulai PRD Baru
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
