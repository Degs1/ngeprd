"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  LogIn,
  LogOut,
  Shield,
  User as UserIcon,
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
  const [imageError, setImageError] = useState(false);

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
          className="p-2.5 rounded-xl text-[#8FA396] hover:text-[#8EA690] hover:bg-[#162620] transition-all duration-200 active:scale-95 flex items-center justify-center"
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
          className="relative rounded-full focus:outline-none focus:ring-1 focus:ring-[#8EA690] cursor-pointer transition-transform active:scale-95"
          title={`${userName} (${isAdmin ? "Admin" : "Free User"})`}
          aria-label="Menu akun pengguna"
        >
          {userImage && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt={userName}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-8 h-8 rounded-full border border-[#22352B] object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#162720] border border-[#243D31] text-[#8EA690] flex items-center justify-center font-bold text-xs">
              {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4 text-[#8EA690]" />}
            </div>
          )}
          {isAdmin && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#D4B36A] border-2 border-[#101A16] rounded-full flex items-center justify-center text-[#0C1310]">
              <Shield className="w-2 h-2" />
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute left-12 bottom-0 z-50 w-56 rounded-xl bg-[#121E19] border border-[#22352B] shadow-2xl p-3 text-xs animate-scale-in origin-bottom-left text-[#EAF0EB]">
            <div className="font-semibold text-[#EAF0EB] truncate">{userName}</div>
            <div className="text-[#8FA396] truncate text-[11px] mb-2">{userEmail}</div>

            {isAdmin ? (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#262215] border border-[#3D3520] text-[#D4B36A] text-[10px] font-mono font-medium mb-3">
                <Shield className="w-3 h-3 text-[#D4B36A]" />
                <span>Admin • Unlimited PRD</span>
              </div>
            ) : (
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-[#8FA396] mb-1">
                  <span>Kuota hari ini</span>
                  <span className="font-semibold text-[#EAF0EB] font-mono">
                    {quota ? `${quota.used} / ${quota.limit}` : "3 / hari"}
                  </span>
                </div>
                <div className="w-full bg-[#0C1310] border border-[#1F3028] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      (quota?.remaining ?? 3) === 0 ? "bg-[#D48B80]" : "bg-[#8EA690]"
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
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[#D48B80] hover:bg-[#281816] font-medium transition-colors cursor-pointer"
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
      <div className="p-3 border-t border-[#1F3028] bg-[#101A16]">
        <div className="rounded-xl p-3 bg-[#121E19] border border-[#22352B] flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#162720] border border-[#243D31] flex items-center justify-center shrink-0">
              <UserIcon className="w-3.5 h-3.5 text-[#8EA690]" />
            </div>
            <div className="text-xs font-semibold text-[#EAF0EB]">Mulai Sekarang</div>
          </div>
          <p className="text-[11px] text-[#8FA396] leading-snug">
            Masuk untuk menyimpan PRD dan menikmati kuota 3 PRD gratis setiap hari.
          </p>
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 min-h-[38px] rounded-lg bg-[#8EA690] hover:bg-[#7D967F] active:scale-95 text-[#0C1310] text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Masuk dengan Google</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-[#1F3028] bg-[#101A16] relative">
      <div className="rounded-xl p-2.5 bg-[#121E19] border border-[#22352B] flex flex-col gap-2">
        {/* User profile row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {userImage && !imageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-8 h-8 rounded-full border border-[#22352B] shrink-0 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#162720] border border-[#243D31] text-[#8EA690] flex items-center justify-center font-bold text-xs shrink-0">
                {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4 text-[#8EA690]" />}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#EAF0EB] truncate">
                {userName}
              </span>
              <span className="text-[10px] text-[#8FA396] truncate">{userEmail}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-8 h-8 rounded-lg text-[#586C61] hover:text-[#D48B80] hover:bg-[#281816] active:bg-[#38201E] transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            title="Keluar"
            aria-label="Keluar dari akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Quota Bar or Admin Badge */}
        {isAdmin ? (
          <div className="mt-1 flex items-center gap-1.5 py-1 px-2 rounded-lg bg-[#262215] border border-[#3D3520] text-[#D4B36A] text-[11px] font-mono font-medium">
            <Shield className="w-3.5 h-3.5 text-[#D4B36A] shrink-0" />
            <span className="truncate">Admin • Unlimited PRD</span>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8FA396]">Kuota hari ini</span>
              <span className="font-semibold text-[#EAF0EB] font-mono">
                {quota ? `${quota.used} / ${quota.limit} PRD` : "3 / hari"}
              </span>
            </div>
            <div className="w-full bg-[#0C1310] border border-[#1F3028] rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  (quota?.remaining ?? 3) === 0 ? "bg-[#D48B80]" : "bg-[#8EA690]"
                )}
                style={{
                  width: `${Math.min(100, (((quota?.used ?? 0) / (quota?.limit || 3)) * 100))}%`,
                }}
              />
            </div>
            {(quota?.remaining ?? 3) === 0 ? (
              <span className="text-[10px] text-[#D48B80] font-medium">
                Batas tercapai. Reset besok.
              </span>
            ) : (
              <span className="text-[10px] text-[#586C61] font-mono">
                Sisa {quota?.remaining ?? 3} PRD hari ini
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
