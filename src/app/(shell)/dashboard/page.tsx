import React from "react";
import IdeaInput from "@/components/dashboard/IdeaInput";
import { Sparkles } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-3.5 sm:px-6 py-6 sm:py-10 md:py-16">
      <div className="w-full max-w-2xl flex flex-col items-center text-center">
        {/* Chatbot greeting badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-4 sm:mb-6 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>AI Visual PRD Planner</span>
        </div>

        {/* Big Greeting Heading */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">Mau bikin apa hari ini?</h1>

        <p className="mt-2.5 sm:mt-3 text-xs sm:text-base text-slate-500 max-w-xl leading-relaxed">Ceritakan ide produk atau aplikasi barumu. AI akan merumuskan spesifikasi, arsitektur, dan dokumen PRD yang siap dieksekusi.</p>

        {/* Large Idea Input Area */}
        <div className="mt-6 sm:mt-8 w-full">
          <IdeaInput />
        </div>
      </div>
    </div>
  );
}
