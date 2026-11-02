"use client";

import React from "react";
import {
  Sparkles,
  Pencil,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lightbulb,
  Edit3,
  Loader2,
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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">
                Ringkasan Brainstorming
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tinjau preferensi arsitektur dan kebutuhan sebelum AI menyusun PRD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5",
                allAnswered
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
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
        <div className="mt-5 p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Ide Proyek</span>
          </div>
          <p className="text-sm text-slate-800 leading-relaxed font-normal">
            {idea}
          </p>
        </div>
      </div>

      {/* Questions and Answers List */}
      <div className="p-6 md:p-8 space-y-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Daftar Pertanyaan & Jawaban:
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
          {questions.map((question, idx) => {
            const answer = answerMap.get(question.id);
            const isDelegated = answer?.delegated;
            const isCustom = answer?.isCustom;
            const hasAnswer = answer && answer.value && answer.value.trim().length > 0;

            return (
              <div
                key={question.id}
                className="p-4 md:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {question.text}
                    </h3>

                    {/* Answer Pill */}
                    <div className="pt-1">
                      {hasAnswer ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {isDelegated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              <span>Serahkan ke AI</span>
                            </span>
                          )}

                          {isCustom && !isDelegated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              <Edit3 className="w-3 h-3 text-indigo-600" />
                              <span>Jawaban Kustom</span>
                            </span>
                          )}

                          {!isCustom && !isDelegated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Opsi Terpilih</span>
                            </span>
                          )}

                          <span className="text-xs font-medium text-slate-800 bg-slate-100 px-3 py-1 rounded-lg break-words max-w-xl">
                            {answer.value}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Belum dijawab</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Button */}
                <div className="shrink-0 self-end md:self-start">
                  <button
                    type="button"
                    onClick={() => onEditQuestion(idx)}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Ubah</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Jawaban ini akan digunakan oleh Planner & Section Writer untuk menyusun spesifikasi PRD utuh.
          </span>
        </div>

        <button
          type="button"
          onClick={onGeneratePrd}
          disabled={!allAnswered || isGenerating}
          className={cn(
            "px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all shrink-0",
            allAnswered && !isGenerating
              ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:shadow-md"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memulai Penyusunan PRD...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Buat PRD</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
