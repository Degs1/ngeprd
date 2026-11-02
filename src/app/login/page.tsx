"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Loader2,
  User,
  Zap,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { status } = useSession();

  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isSubmittingDev, setIsSubmittingDev] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoadingGoogle(true);
      setErrorMsg(null);
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setErrorMsg("Gagal menghubungi Google OAuth. Periksa konfigurasi AUTH_GOOGLE_ID.");
      setIsLoadingGoogle(false);
    }
  };

  const handleDevSignIn = async (email: string, role = "user") => {
    try {
      setIsSubmittingDev(true);
      setErrorMsg(null);
      const res = await signIn("dev-login", {
        email,
        name: role === "admin" ? "Admin Tester" : "Free User Tester",
        callbackUrl,
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg("Gagal login dev: " + res.error);
        setIsSubmittingDev(false);
      } else {
        router.replace(callbackUrl);
      }
    } catch (err) {
      console.error("Dev sign-in error:", err);
      setErrorMsg("Gagal melakukan login pengembang.");
      setIsSubmittingDev(false);
    }
  };

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-5 sm:p-8 flex flex-col gap-5 sm:gap-6">
      {/* Brand header */}
      <div className="flex flex-col items-center text-center">
        <Link
          href="/"
          className="group mb-2 hover:scale-105 transition-transform duration-200 cursor-pointer block"
          title="Kembali ke Beranda"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="ngePRD"
            className="h-16 w-auto object-contain drop-shadow-xs"
          />
        </Link>
        <span className="sr-only">ngePRD</span>
        <p className="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
          Masuk dengan Google untuk mulai merancang PRD visual & diagram arsitektur.
        </p>
      </div>

      {/* Feature benefits */}
      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>3 PRD gratis</strong> setiap hari untuk semua akun
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Visual Flowchart & Mermaid Diagram otomatis</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Simpan riwayat & ekspor langsung ke Markdown</span>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Primary Action: Google OAuth Button */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={isLoadingGoogle || isSubmittingDev}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 text-slate-700 text-sm font-semibold shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {isLoadingGoogle ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Lanjutkan dengan Google</span>
        </button>
      </div>

      {/* Development fast tester options */}
      {isDev && (
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Mode Uji Lokal (Dev Shortcuts)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isSubmittingDev}
              onClick={() => handleDevSignIn("free-user@example.com", "user")}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
              title="Login sebagai Pengguna Gratis (kuota 3 PRD/hari)"
            >
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span>User (3/hari)</span>
            </button>

            <button
              type="button"
              disabled={isSubmittingDev}
              onClick={() => handleDevSignIn("admin@example.com", "admin")}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 min-h-[40px] rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 active:bg-amber-100 text-[11px] font-medium text-amber-900 transition-colors cursor-pointer"
              title="Login sebagai Admin (Unlimited PRD)"
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Admin (Bypass)</span>
            </button>
          </div>
        </div>
      )}

      {/* Footnote */}
      <p className="text-center text-[11px] text-slate-400">
        Dengan masuk, Anda menyetujui ketentuan layanan dan kebijakan kuota harian ngePRD.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-3.5 sm:px-4 py-6 sm:py-8 relative overflow-y-auto">
      {/* Decorative top blur glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] max-w-full h-[300px] sm:h-[350px] bg-gradient-to-b from-indigo-100/70 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top back link */}
      <div className="w-full max-w-md mb-3 sm:mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
