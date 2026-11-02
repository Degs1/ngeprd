"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Edit3,
  FileCheck,
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

  // Sync customText if currentAnswer changes externally
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
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header with progress */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between text-xs mb-2.5">
          <span className="font-semibold text-slate-700 uppercase tracking-wider">
            Pertanyaan {questionIndex + 1} dari {totalQuestions}
          </span>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </span>
            )}
            {!isSaving && currentAnswer && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tersimpan</span>
              </span>
            )}
            <span className="font-bold text-slate-500">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Question Body */}
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
            {question.text}
          </h2>

          {question.why && (
            <div className="mt-3.5 flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 leading-relaxed">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700">
                  Mengapa ini penting?{" "}
                </span>
                {question.why}
              </div>
            </div>
          )}
        </div>

        {/* Options Selection */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pilih salah satu opsi:
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {question.options.map((option, idx) => {
              const isSelected =
                !isCustom && !isDelegated && currentAnswer?.value === option;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectOption(option)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 group",
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 font-medium shadow-sm ring-1 ring-indigo-500/20"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-800"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 group-hover:border-slate-400 bg-white"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-sm leading-relaxed">{option}</span>
                </button>
              );
            })}

            {/* Custom option pill */}
            {question.allowCustom && (
              <div
                className={cn(
                  "rounded-xl border transition-all overflow-hidden",
                  isCustom
                    ? "border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-500/20"
                    : "border-slate-200/90 bg-white hover:border-slate-300"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!isCustom) {
                      handleCustomSubmit(customText || "");
                    }
                  }}
                  className="w-full text-left p-4 flex items-center gap-3.5"
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                      isCustom
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {isCustom && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Edit3 className="w-4 h-4 text-slate-400" />
                    <span>Lainnya (Ketik preferensi sendiri)</span>
                  </div>
                </button>

                {isCustom && (
                  <div className="px-4 pb-4 pt-1">
                    <textarea
                      value={customText}
                      onChange={(e) => handleCustomSubmit(e.target.value)}
                      placeholder="Tuliskan spesifikasi, batasan, atau preferensi Anda..."
                      rows={2}
                      autoFocus
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Serahkan ke AI Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onDelegateToAi}
            className={cn(
              "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5",
              isDelegated
                ? "border-purple-500 bg-purple-50/60 text-purple-950 font-medium shadow-sm ring-1 ring-purple-400/30"
                : "border-purple-200/80 bg-purple-50/20 hover:bg-purple-50/50 hover:border-purple-300 text-slate-800"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                isDelegated
                  ? "border-purple-600 bg-purple-600 text-white"
                  : "border-purple-300 bg-white"
              )}
            >
              {isDelegated ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : (
                <Sparkles className="w-3 h-3 text-purple-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-900">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Serahkan ke AI</span>
              </div>
              <p className="text-xs text-purple-700/80 mt-0.5">
                Biarkan model AI menentukan pilihan arsitektur dan teknis terbaik
                berdasarkan ide proyek.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
        <div>
          {canPrev ? (
            <button
              type="button"
              onClick={onPrev}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
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
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <span>Ringkasan</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className={cn(
              "px-5 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm",
              canNext
                ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <span>
              {questionIndex === totalQuestions - 1 ? "Selesai & Ringkasan" : "Lanjut"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
