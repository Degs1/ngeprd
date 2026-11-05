import React from "react";
import IdeaInput from "@/components/dashboard/IdeaInput";

export default function DashboardPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-3.5 sm:px-6 py-6 sm:py-10 md:py-16">
      <div className="w-full max-w-2xl flex flex-col items-center text-center">
        {/* Dominant Editorial Heading */}
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#EAF0EB] tracking-tight leading-tight">
          Mau bikin apa hari ini?
        </h1>

        <p className="mt-3 text-sm sm:text-base text-[#8FA396] max-w-xl leading-relaxed font-sans">
          Ceritakan ide produk atau aplikasi barumu. AI akan merumuskan spesifikasi, arsitektur, dan dokumen PRD yang siap dieksekusi.
        </p>

        {/* Large Idea Input Area */}
        <div className="mt-8 w-full">
          <IdeaInput />
        </div>
      </div>
    </div>
  );
}
