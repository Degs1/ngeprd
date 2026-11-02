"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  LogIn,
  LogOut,
  Shield,
  User as UserIcon,
  ChevronUp,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  collapsed?: boolean;
}

export default function UserMenu({ collapsed = false }: UserMenuProps) {
  const { data: session, status } = useSession();
  const { user, quota, fetchUserQuota } = useUserStore();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchUserQuota();
  }, [fetchUserQuota, status]);

  const isAuthenticated = status === "authenticated";
  const userImage = session?.user?.image || user?.image;
  const userName = session?.user?.name || user?.name || "Pengguna";
  const userEmail = session?.user?.email || user?.email || "";
  const isAdmin = (session?.user as any)?.role === "admin" || user?.isAdmin;

  // Collapsed desktop state (icon only)
  if (collapsed) {
    if (!isAuthenticated) {
      return (
        <Link
          href="/login"
          className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 active:scale-95 flex items-center justify-center"
          title="Masuk dengan Google"
          aria-label="Masuk dengan Google"
        >
          <LogIn className="w-5 h-5" />
        </Link>
      );
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown((v) => !v)}
          className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-transform active:scale-95"
          title={`${userName} (${isAdmin ? "Admin" : "Free User"})`}
          aria-label="Menu akun pengguna"
        >
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt={userName}
              className="w-8 h-8 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          {isAdmin && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center text-white">
              <Shield className="w-2 h-2" />
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute left-12 bottom-0 z-50 w-56 rounded-xl bg-white border border-slate-200 shadow-xl p-3 text-xs animate-scale-in origin-bottom-left">
            <div className="font-semibold text-slate-900 truncate">{userName}</div>
            <div className="text-slate-500 truncate text-[11px] mb-2">{userEmail}</div>

            {isAdmin ? (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium mb-3">
                <Shield className="w-3 h-3 text-amber-600" />
                <span>Admin • Unlimited PRD</span>
              </div>
            ) : (
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>Kuota hari ini</span>
                  <span className="font-semibold text-slate-900">
                    {quota ? `${quota.used} / ${quota.limit}` : "3 / hari"}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      (quota?.remaining ?? 3) === 0 ? "bg-rose-500" : "bg-indigo-600"
                    )}
                    style={{
                      width: `${Math.min(100, (((quota?.used ?? 0) / (quota?.limit || 3)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowDropdown(false);
                signOut({ callbackUrl: "/" });
              }}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Expanded sidebar state
  if (!isAuthenticated) {
    return (
      <div className="p-3 border-t border-slate-200/80 bg-white/60">
        <div className="rounded-xl p-3 bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100/80 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon.png"
                alt="ngePRD"
                className="w-6 h-6 object-contain"
              />
            </div>
            <div className="text-xs font-semibold text-slate-800">Mulai Sekarang</div>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Masuk untuk menyimpan PRD dan menikmati kuota 3 PRD gratis setiap hari.
          </p>
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 min-h-[38px] rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Masuk dengan Google</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-slate-200/80 bg-white/60 relative">
      <div className="rounded-xl p-2.5 bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
        {/* User profile row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                className="w-8 h-8 rounded-full border border-slate-200 shrink-0 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 truncate">
                {userName}
              </span>
              <span className="text-[10px] text-slate-500 truncate">{userEmail}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            title="Keluar"
            aria-label="Keluar dari akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Quota Bar or Admin Badge */}
        {isAdmin ? (
          <div className="mt-1 flex items-center gap-1.5 py-1 px-2 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 text-[11px] font-medium">
            <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">Admin • Unlimited PRD</span>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Kuota hari ini</span>
              <span className="font-semibold text-slate-800">
                {quota ? `${quota.used} / ${quota.limit} PRD` : "3 / hari"}
              </span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  (quota?.remaining ?? 3) === 0 ? "bg-rose-500" : "bg-indigo-600"
                )}
                style={{
                  width: `${Math.min(100, (((quota?.used ?? 0) / (quota?.limit || 3)) * 100))}%`,
                }}
              />
            </div>
            {(quota?.remaining ?? 3) === 0 ? (
              <span className="text-[10px] text-rose-600 font-medium">
                Batas tercapai. Reset besok.
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">
                Sisa {quota?.remaining ?? 3} PRD hari ini
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
