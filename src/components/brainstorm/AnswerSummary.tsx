"use client";

import React from "react";
import {
  Pencil,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lightbulb,
  Edit3,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { BrainstormQuestion, BrainstormAnswer } from "@/lib/schemas/prd";
import { cn } from "@/lib/utils";

export interface AnswerSummaryProps {
  idea: string;
  questions: BrainstormQuestion[];
  answers: BrainstormAnswer[];
  onEditQuestion: (index: number) => void;
  onGeneratePrd?: () => void;
  isGenerating?: boolean;
}

export default function AnswerSummary({
  idea,
  questions,
  answers,
  onEditQuestion,
  onGeneratePrd,
  isGenerating = false,
}: AnswerSummaryProps) {
  const answerMap = new Map<string, BrainstormAnswer>(
    answers.map((a) => [a.questionId, a])
  );

  const answeredCount = questions.filter((q) => {
    const ans = answerMap.get(q.id);
    return ans && ans.value && ans.value.trim().length > 0;
  }).length;

  const allAnswered = answeredCount === questions.length;

  return (
    <div className="bg-[#121E19] text-[#EAF0EB] rounded-2xl border border-[#22352B] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 md:p-8 border-b border-[#1F3028] bg-[#15231D]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#162720] border border-[#243D31] flex items-center justify-center text-[#8EA690] shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-serif font-bold text-[#EAF0EB]">
                Ringkasan Brainstorming
              </h2>
              <p className="text-xs text-[#8FA396] mt-0.5">
                Tinjau preferensi arsitektur dan kebutuhan sebelum AI menyusun PRD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 border",
                allAnswered
                  ? "bg-[#152720] text-[#8EA690] border-[#243D31]"
                  : "bg-[#262215] text-[#D4B36A] border-[#3D3520]"
              )}
            >
              {allAnswered ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Semua Terjawab ({answeredCount}/{questions.length})</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    {answeredCount} dari {questions.length} Terjawab
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Idea Banner */}
        <div className="mt-4 sm:mt-5 p-3.5 sm:p-4 rounded-xl bg-[#0C1310] border border-[#1F3028]">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#8EA690] uppercase tracking-wider mb-1">
            <Lightbulb className="w-3.5 h-3.5 text-[#8EA690]" />
            <span>Ide Proyek</span>
          </div>
          <p className="text-xs sm:text-sm text-[#8FA396] leading-relaxed font-normal">
            {idea}
          </p>
        </div>
      </div>

      {/* Questions and Answers List */}
      <div className="p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-4">
        <div className="text-[11px] sm:text-xs font-mono font-semibold text-[#586C61] uppercase tracking-wider">
          Daftar Pertanyaan & Jawaban:
        </div>

        <div className="divide-y divide-[#1F3028] border border-[#1F3028] rounded-xl overflow-hidden bg-[#0C1310]">
          {questions.map((question, idx) => {
            const answer = answerMap.get(question.id);
            const isDelegated = answer?.delegated;
            const isCustom = answer?.isCustom;
            const hasAnswer = answer && answer.value && answer.value.trim().length > 0;

            return (
              <div
                key={question.id}
                className="p-3.5 sm:p-4 md:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 hover:bg-[#121E19] transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-lg bg-[#162720] border border-[#243D31] text-[#8EA690] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-serif font-bold text-[#EAF0EB] leading-snug">
                      {question.text}
                    </h3>

                    {/* Answer Pill */}
                    <div className="pt-0.5">
                      {hasAnswer ? (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {isDelegated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#162720] text-[#8EA690] border border-[#243D31]">
                              <Sparkles className="w-3 h-3" />
                              <span>Serahkan ke AI</span>
                            </span>
                          )}

                          {isCustom && !isDelegated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#18262F] text-[#8CB4D9] border border-[#243B4D]">
                              <Edit3 className="w-3 h-3" />
                              <span>Jawaban Kustom</span>
                            </span>
                          )}

                          {!isCustom && !isDelegated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#152720] text-[#8EA690] border border-[#243D31]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Opsi Terpilih</span>
                            </span>
                          )}

                          <span className="text-[11px] sm:text-xs font-medium text-[#EAF0EB] bg-[#121E19] border border-[#22352B] px-2.5 sm:px-3 py-1 rounded-lg break-words max-w-xl">
                            {answer.value}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#262215] text-[#D4B36A] border border-[#3D3520]">
                          <AlertCircle className="w-3 h-3" />
                          <span>Belum dijawab</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Button */}
                <div className="shrink-0 self-end sm:self-start">
                  <button
                    type="button"
                    onClick={() => onEditQuestion(idx)}
                    className="px-3 py-1.5 text-xs font-medium text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] border border-[#22352B] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Pencil className="w-3 h-3 text-[#586C61]" />
                    <span>Ubah</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 sm:p-6 md:p-8 bg-[#101A16] border-t border-[#1F3028] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="text-xs text-[#8FA396] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#586C61] shrink-0" />
          <span>
            Jawaban ini akan digunakan oleh Planner & Section Writer untuk menyusun spesifikasi PRD utuh.
          </span>
        </div>

        <button
          type="button"
          onClick={onGeneratePrd}
          disabled={!allAnswered || isGenerating}
          className={cn(
            "w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer active:scale-[0.98]",
            allAnswered && !isGenerating
              ? "bg-[#8EA690] hover:bg-[#7D967F] text-[#0C1310]"
              : "bg-[#192A22] text-[#586C61] border border-[#22352B] cursor-not-allowed"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#0C1310]" />
              <span>Memulai Penyusunan PRD...</span>
            </>
          ) : (
            <>
              <span>Buat PRD</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
