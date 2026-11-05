import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ngePRD — Visual PRD Planner",
  description: "Ubah ide mentah menjadi rencana arsitektur dan dokumen prd.md siap eksekusi",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0C1310",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased m-0 p-0 min-h-screen min-h-[100dvh] w-full overflow-x-clip bg-[#0C1310] text-[#EAF0EB]`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
