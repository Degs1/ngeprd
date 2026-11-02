"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Sparkles, ArrowRight, CornerDownLeft, Loader2, RotateCcw } from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { SectionType } from "@/lib/schemas/prd";
import { cn } from "@/lib/utils";

export interface NodeInstructionBarProps {
  sectionId: string;
  sectionTitle?: string;
  sectionType?: SectionType | string;
  hasDiagram?: boolean;
  className?: string;
}

const standardChips = ["Lebih ringkas", "Lebih detail"];

const typeSpecificChips: Record<string, string[]> = {
  tech_stack: ["Ganti bahasa/framework", "Tambah alternatif", "Tentukan versi"],
  architecture: ["Sederhanakan arsitektur", "Ganti pola sistem", "Detailkan komponen"],
  features: ["Tambah kriteria penerimaan", "Pecah jadi sub-fitur", "Prioritaskan MVP"],
  data_model: ["Tambah relasi antartabel", "Sederhanakan skema", "Tambah field audit"],
  api: ["Format RESTful", "Tambah penanganan error", "Spesifikasikan auth"],
  security: ["Tambah autentikasi OAuth/JWT", "Perketat sanitasi input", "Perlindungan OWASP"],
  roadmap: ["Bagi per sprint", "Tentukan dependensi rilis"],
  nfr: ["Perjelas target SLO/SLA", "Tambah estimasi skala"],
  problem: ["Perjelas latar belakang", "Fokuskan dampak bisnis"],
  overview: ["Perjelas ringkasan eksekutif", "Fokuskan nilai produk"],
  goals: ["Jadikan SMART goals", "Tambah metrik keberhasilan"],
  users: ["Tambah persona sekunder", "Petakan user journey"],
};

export function NodeInstructionBar({
  sectionId,
  sectionTitle,
  sectionType = "custom",
  hasDiagram = false,
  className,
}: NodeInstructionBarProps) {
  const [instruction, setInstruction] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isCreatingChangeSet = useWorkspaceStore((state) => state.isCreatingChangeSet);
  const createChangeSet = useWorkspaceStore((state) => state.createChangeSet);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const changeSetRedirect = useWorkspaceStore((state) => state.changeSetRedirect);
  const clearChangeSetRedirect = useWorkspaceStore((state) => state.clearChangeSetRedirect);

  // Focus input when mounted
  useEffect(() => {
    inputRef.current?.focus();
  }, [sectionId]);

  // If redirected to this section with a prior instruction, pre-fill it (FR-AI-12)
  useEffect(() => {
    if (
      changeSetRedirect &&
      changeSetRedirect.sectionId === sectionId &&
      changeSetRedirect.instruction
    ) {
      setInstruction(changeSetRedirect.instruction);
      clearChangeSetRedirect();
    }
  }, [changeSetRedirect, sectionId, clearChangeSetRedirect]);

  // Compute chips for this section
  const chips = [
    ...standardChips,
    ...(hasDiagram ? ["Perbaiki diagram"] : []),
    ...(typeSpecificChips[sectionType] || []),
  ];

  // Submit instruction to AI revision engine (FR-AI-01, FR-AI-02)
  const handleSubmit = useCallback(
    async (textToSubmit?: string) => {
      const text = (textToSubmit ?? instruction).trim();
      if (!text || isCreatingChangeSet) return;

      // Switch to Revisions tab immediately
      setActiveTab("revisions");

      const success = await createChangeSet(sectionId, text);
      if (success) {
        setInstruction("");
      }
    },
    [instruction, isCreatingChangeSet, createChangeSet, sectionId, setActiveTab]
  );

  // Shortcut chip click
  const handleChipClick = (chipText: string) => {
    setInstruction(chipText);
    inputRef.current?.focus();
  };

  // Shortcut: Tulis ulang (FR-AI-01)
  const handleRewrite = () => {
    handleSubmit("Tulis ulang bagian ini secara menyeluruh");
  };

  return (
    <div
      onClick={(e: any) => e.stopPropagation()}
      className={cn(
        "nodrag nowheel w-[380px] max-w-[calc(100vw-32px)] bg-white/95 backdrop-blur-md border border-indigo-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xl transition-all duration-200 z-50 select-none",
        className
      )}
    >
      {/* Input row */}
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-indigo-400/50 focus-within:border-indigo-400 bg-white"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={instruction}
          onChange={(e: any) => setInstruction(e.target.value)}
          onKeyDown={(e: any) => e.stopPropagation()}
          disabled={isCreatingChangeSet}
          aria-label="Instruksi revisi AI"
          placeholder="Ubah bagian ini... (Enter kirim)"
          className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
        />

        <button
          type="submit"
          disabled={!instruction.trim() || isCreatingChangeSet}
          aria-label="Kirim instruksi ke AI"
          className="w-7 h-7 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center cursor-pointer"
          title="Kirim instruksi ke AI"
        >
          {isCreatingChangeSet ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CornerDownLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </form>

      {/* Quick Prompt Chips (FR-AI-01, FR-AI-14) */}
      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
        {/* Tulis Ulang shortcut chip */}
        <button
          type="button"
          onClick={handleRewrite}
          disabled={isCreatingChangeSet}
          className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 hover:bg-indigo-100 active:bg-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
          title="Pintasan instruksi: Tulis ulang bagian ini secara menyeluruh"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Tulis ulang</span>
        </button>

        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            disabled={isCreatingChangeSet}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60 hover:bg-slate-200/70 active:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

export default NodeInstructionBar;
