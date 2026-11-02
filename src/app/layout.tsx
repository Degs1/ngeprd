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
  title: "ngePRD - Visual PRD Planner",
  description: "Ubah ide mentah menjadi rencana arsitektur dan dokumen prd.md siap eksekusi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased m-0 p-0 min-h-screen min-h-[100dvh] w-full overflow-x-clip bg-white text-[#20242C]`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
