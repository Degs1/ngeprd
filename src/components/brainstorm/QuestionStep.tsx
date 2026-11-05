"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Edit3,
  FileCheck,
  Sparkles,
} from "lucide-react";
import type { BrainstormQuestion, BrainstormAnswer } from "@/lib/schemas/prd";
import { cn } from "@/lib/utils";

export interface QuestionStepProps {
  question: BrainstormQuestion;
  questionIndex: number;
  totalQuestions: number;
  currentAnswer?: BrainstormAnswer;
  onSelectOption: (option: string) => void;
  onCustomTextChange: (text: string) => void;
  onDelegateToAi: () => void;
  onNext: () => void;
  onPrev: () => void;
  canPrev: boolean;
  canNext: boolean;
  isSaving: boolean;
  onGoToSummary?: () => void;
  isAllAnswered?: boolean;
}

export default function QuestionStep({
  question,
  questionIndex,
  totalQuestions,
  currentAnswer,
  onSelectOption,
  onCustomTextChange,
  onDelegateToAi,
  onNext,
  onPrev,
  canPrev,
  canNext,
  isSaving,
  onGoToSummary,
  isAllAnswered,
}: QuestionStepProps) {
  const isCustom = currentAnswer?.isCustom ?? false;
  const isDelegated = currentAnswer?.delegated ?? false;
  const [customText, setCustomText] = useState(
    isCustom ? currentAnswer?.value || "" : ""
  );

  useEffect(() => {
    if (currentAnswer?.isCustom) {
      setCustomText(currentAnswer.value);
    } else if (!currentAnswer?.isCustom) {
      setCustomText("");
    }
  }, [currentAnswer]);

  const handleCustomSubmit = (text: string) => {
    setCustomText(text);
    onCustomTextChange(text);
  };

  const progressPercent = Math.round(
    ((questionIndex + 1) / totalQuestions) * 100
  );

  return (
    <div className="flex flex-col bg-[#121E19] text-[#EAF0EB] rounded-2xl border border-[#22352B] shadow-xl overflow-hidden">
      {/* Header with progress */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-[#1F3028] bg-[#15231D]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-mono font-semibold text-[#8FA396] uppercase tracking-wider text-[11px] sm:text-xs">
            Pertanyaan {questionIndex + 1} dari {totalQuestions}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-[#8CB4D9] font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden xs:inline">Menyimpan...</span>
              </span>
            )}
            {!isSaving && currentAnswer && (
              <span className="flex items-center gap-1 text-xs text-[#8EA690] font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Tersimpan</span>
              </span>
            )}
            <span className="font-bold text-[#8EA690] font-mono">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#0C1310] overflow-hidden border border-[#1F3028]">
          <div
            className="h-full bg-[#8EA690] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Question Body */}
      <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl font-serif font-bold text-[#EAF0EB] leading-snug">
            {question.text}
          </h2>

          {question.why && (
            <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-[#0C1310] border border-[#1F3028] text-xs text-[#8FA396] leading-relaxed">
              <HelpCircle className="w-4 h-4 text-[#8EA690] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#EAF0EB]">
                  Mengapa ini penting?{" "}
                </span>
                {question.why}
              </div>
            </div>
          )}
        </div>

        {/* Options Selection */}
        <div className="space-y-2.5 sm:space-y-3">
          <div className="text-[11px] sm:text-xs font-mono font-semibold text-[#586C61] uppercase tracking-wider">
            Pilih salah satu opsi:
          </div>

          <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
            {question.options.map((option, idx) => {
              const isSelected =
                !isCustom && !isDelegated && currentAnswer?.value === option;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectOption(option)}
                  className={cn(
                    "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3 group cursor-pointer active:scale-[0.99]",
                    isSelected
                      ? "border-[#243C30] bg-[#162620] text-[#EAF0EB] font-medium shadow-xs ring-1 ring-[#8EA690]"
                      : "border-[#22352B] bg-[#0C1310] hover:border-[#355243] hover:bg-[#162620] text-[#8FA396] hover:text-[#EAF0EB]"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected
                        ? "border-[#8EA690] bg-[#8EA690] text-[#0C1310]"
                        : "border-[#586C61] group-hover:border-[#8FA396] bg-[#0C1310]"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs sm:text-sm leading-relaxed">{option}</span>
                </button>
              );
            })}

            {/* Custom option pill */}
            {question.allowCustom && (
              <div
                className={cn(
                  "rounded-xl border transition-all overflow-hidden",
                  isCustom
                    ? "border-[#243C30] bg-[#162620] ring-1 ring-[#8EA690]"
                    : "border-[#22352B] bg-[#0C1310] hover:border-[#355243]"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!isCustom) {
                      handleCustomSubmit(customText || "");
                    }
                  }}
                  className="w-full text-left p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer"
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                      isCustom
                        ? "border-[#8EA690] bg-[#8EA690] text-[#0C1310]"
                        : "border-[#586C61] bg-[#0C1310]"
                    )}
                  >
                    {isCustom && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#EAF0EB]">
                    <Edit3 className="w-4 h-4 text-[#8EA690]" />
                    <span>Lainnya (Ketik preferensi sendiri)</span>
                  </div>
                </button>

                {isCustom && (
                  <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1">
                    <textarea
                      value={customText}
                      onChange={(e) => handleCustomSubmit(e.target.value)}
                      placeholder="Tuliskan spesifikasi, batasan, atau preferensi Anda..."
                      rows={2}
                      autoFocus
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#0C1310] border border-[#243C30] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8EA690] text-[#EAF0EB] placeholder:text-[#586C61]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Serahkan ke AI Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onDelegateToAi}
            className={cn(
              "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3 cursor-pointer active:scale-[0.99]",
              isDelegated
                ? "border-[#243C30] bg-[#162620] text-[#EAF0EB] font-medium shadow-xs ring-1 ring-[#8EA690]"
                : "border-[#22352B] bg-[#0C1310] hover:bg-[#162620] hover:border-[#355243] text-[#8FA396]"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                isDelegated
                  ? "border-[#8EA690] bg-[#8EA690] text-[#0C1310]"
                  : "border-[#586C61] bg-[#0C1310]"
              )}
            >
              {isDelegated ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : (
                <Sparkles className="w-3 h-3 text-[#8EA690]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#EAF0EB]">
                <Sparkles className="w-3.5 h-3.5 text-[#8EA690]" />
                <span>Serahkan ke AI</span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#8FA396] mt-0.5 leading-relaxed">
                Biarkan model AI menentukan pilihan arsitektur dan teknis terbaik
                berdasarkan ide proyek.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#101A16] border-t border-[#1F3028] flex items-center justify-between gap-2 sm:gap-3">
        <div>
          {canPrev ? (
            <button
              type="button"
              onClick={onPrev}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] border border-[#22352B] rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAllAnswered && onGoToSummary && (
            <button
              type="button"
              onClick={onGoToSummary}
              className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] border border-[#22352B] rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <FileCheck className="w-4 h-4 text-[#8EA690]" />
              <span className="hidden xs:inline">Ringkasan</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className={cn(
              "px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95",
              canNext
                ? "bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310]"
                : "bg-[#192A22] text-[#586C61] border border-[#22352B] cursor-not-allowed"
            )}
          >
            <span>
              {questionIndex === totalQuestions - 1 ? (
                <>
                  <span className="hidden xs:inline">Selesai & Ringkasan</span>
                  <span className="xs:hidden">Selesai</span>
                </>
              ) : (
                "Lanjut"
              )}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
