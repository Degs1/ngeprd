"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import type { BrainstormQuestion, BrainstormAnswer } from "@/lib/schemas/prd";
import QuestionStep from "./QuestionStep";
import AnswerSummary from "./AnswerSummary";

export interface BrainstormWizardProps {
  prdId: string;
  idea: string;
  initialQuestions?: BrainstormQuestion[];
  initialAnswers?: BrainstormAnswer[];
  onGeneratePrd?: () => void;
  onAnswersUpdated?: (answers: BrainstormAnswer[]) => void;
}

export default function BrainstormWizard({
  prdId,
  idea,
  initialQuestions = [],
  initialAnswers = [],
  onGeneratePrd,
  onAnswersUpdated,
}: BrainstormWizardProps) {
  const [questions, setQuestions] = useState<BrainstormQuestion[]>(initialQuestions);
  const [answers, setAnswers] = useState<BrainstormAnswer[]>(initialAnswers);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [hasInitializedStep, setHasInitializedStep] = useState<boolean>(false);

  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(
    initialQuestions.length === 0
  );
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Guard against concurrent fetching
  const isFetchingRef = useRef<boolean>(false);

  // Debounce timer for custom text inputs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAnswerRef = useRef<BrainstormAnswer | null>(null);

  /**
   * Computes the step index to resume from:
   * Finds the first unanswered question index, or returns questions.length (Summary view)
   * if all questions have already been answered.
   */
  const computeResumeStep = useCallback(
    (qs: BrainstormQuestion[], ans: BrainstormAnswer[]): number => {
      if (!qs || qs.length === 0) return 0;
      const answerMap = new Map(ans.map((a) => [a.questionId, a]));

      const firstUnansweredIndex = qs.findIndex((q) => {
        const item = answerMap.get(q.id);
        return !item || !item.value || item.value.trim().length === 0;
      });

      if (firstUnansweredIndex === -1) {
        return qs.length; // All questions answered, resume at summary
      }
      return firstUnansweredIndex;
    },
    []
  );

  /**
   * Fetches or generates questions via POST /api/prds/[id]/brainstorm.
   * Endpoint is idempotent: returns existing questions if already present in DB.
   */
  const fetchQuestions = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoadingQuestions(true);
    setError(null);

    try {
      const res = await fetch(`/api/prds/${prdId}/brainstorm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        const errorCode = data?.error?.code || "AI_FAILED";
        const errorMsg =
          data?.error?.message ||
          "Gagal memuat pertanyaan dari AI. Silakan coba lagi.";
        throw { code: errorCode, message: errorMsg };
      }

      const loadedQuestions: BrainstormQuestion[] = data.questions || [];
      setQuestions(loadedQuestions);

      if (!hasInitializedStep) {
        const resumeIndex = computeResumeStep(loadedQuestions, answers);
        setCurrentStepIndex(resumeIndex);
        setHasInitializedStep(true);
      }
    } catch (err: unknown) {
      const typedErr = err as { code?: string; message?: string };
      setError({
        code: typedErr?.code || "AI_FAILED",
        message: typedErr?.message || "Gagal menghubungi layanan AI",
      });
    } finally {
      isFetchingRef.current = false;
      setIsLoadingQuestions(false);
    }
  }, [prdId, answers, hasInitializedStep, computeResumeStep]);

  // Initial load
  useEffect(() => {
    if (questions.length === 0) {
      fetchQuestions();
    } else if (!hasInitializedStep) {
      const resumeIndex = computeResumeStep(questions, answers);
      setCurrentStepIndex(resumeIndex);
      setHasInitializedStep(true);
    }
  }, [fetchQuestions, questions, answers, hasInitializedStep, computeResumeStep]);

  /**
   * Sends the answer to the database via PUT /api/prds/[id]/brainstorm/answers.
   */
  const persistAnswerToServer = useCallback(
    async (answerToSave: BrainstormAnswer) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`/api/prds/${prdId}/brainstorm/answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answerToSave),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          console.error("Gagal menyimpan jawaban:", errData);
          setSaveError("Gagal menyimpan jawaban ke database.");
        }
      } catch (err) {
        console.error("Network error while saving answer:", err);
        setSaveError("Koneksi terputus saat menyimpan jawaban.");
      } finally {
        setIsSaving(false);
      }
    },
    [prdId]
  );

  /**
   * Flushes any pending debounced answer immediately.
   */
  const flushPendingAnswer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingAnswerRef.current) {
      persistAnswerToServer(pendingAnswerRef.current);
      pendingAnswerRef.current = null;
    }
  }, [persistAnswerToServer]);

  /**
   * Upserts the answer in local state and initiates server persistence.
   */
  const saveAnswer = useCallback(
    (newAnswer: BrainstormAnswer, debounce = false) => {
      // Optimistic local update
      setAnswers((prev) => {
        const index = prev.findIndex((a) => a.questionId === newAnswer.questionId);
        let updated: BrainstormAnswer[];
        if (index >= 0) {
          updated = [...prev];
          updated[index] = newAnswer;
        } else {
          updated = [...prev, newAnswer];
        }
        if (onAnswersUpdated) {
          onAnswersUpdated(updated);
        }
        return updated;
      });

      if (debounce) {
        pendingAnswerRef.current = newAnswer;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          if (pendingAnswerRef.current) {
            persistAnswerToServer(pendingAnswerRef.current);
            pendingAnswerRef.current = null;
          }
        }, 400);
      } else {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pendingAnswerRef.current = null;
        persistAnswerToServer(newAnswer);
      }
    },
    [persistAnswerToServer, onAnswersUpdated]
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handler for selecting a pre-defined option
  const handleSelectOption = (option: string) => {
    const activeQuestion = questions[currentStepIndex];
    if (!activeQuestion) return;

    saveAnswer(
      {
        questionId: activeQuestion.id,
        value: option,
        isCustom: false,
        delegated: false,
      },
      false
    );
  };

  // Handler for custom text change
  const handleCustomTextChange = (text: string) => {
    const activeQuestion = questions[currentStepIndex];
    if (!activeQuestion) return;

    saveAnswer(
      {
        questionId: activeQuestion.id,
        value: text,
        isCustom: true,
        delegated: false,
      },
      true
    );
  };

  // Handler for delegating to AI
  const handleDelegateToAi = () => {
    const activeQuestion = questions[currentStepIndex];
    if (!activeQuestion) return;

    saveAnswer(
      {
        questionId: activeQuestion.id,
        value: "Serahkan ke AI (rekomendasi otomatis)",
        isCustom: false,
        delegated: true,
      },
      false
    );
  };

  const handleNext = () => {
    flushPendingAnswer();
    if (currentStepIndex < questions.length) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    flushPendingAnswer();
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleGoToSummary = () => {
    flushPendingAnswer();
    setCurrentStepIndex(questions.length);
  };

  const handleEditQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentStepIndex(index);
    }
  };

  const handleGeneratePrd = () => {
    flushPendingAnswer();
    setIsGenerating(true);
    if (onGeneratePrd) {
      onGeneratePrd();
    }
  };

  // 1. Loading View (Section 6.2 FR-BRN-01)
  if (isLoadingQuestions) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 md:p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-5 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-lg md:text-xl font-bold text-slate-900">
          AI Menyiapkan Pertanyaan...
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          Menganalisis ide produk Anda untuk merumuskan 4–6 pertanyaan arsitektur dan kebutuhan spesifik domain.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200/60 max-w-lg mx-auto text-left">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Ide Anda:
          </div>
          <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">
            {idea}
          </p>
        </div>
      </div>
    );
  }

  // 2. Error View with "Coba lagi" (Section 6.2 FR-BRN-02)
  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 md:p-8 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-rose-950">
          Gagal Menyiapkan Pertanyaan
        </h2>
        <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-mono font-semibold">
          {error.code}
        </div>
        <p className="text-sm text-rose-700 mt-3 leading-relaxed">
          {error.message}
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Sistem tidak menggunakan pertanyaan templat default. Silakan coba kembali untuk meminta AI merumuskan pertanyaan baru.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={fetchQuestions}
            className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Summary View (if currentStepIndex is questions.length)
  if (currentStepIndex >= questions.length && questions.length > 0) {
    return (
      <AnswerSummary
        idea={idea}
        questions={questions}
        answers={answers}
        onEditQuestion={handleEditQuestion}
        onGeneratePrd={handleGeneratePrd}
        isGenerating={isGenerating}
      />
    );
  }

  // 4. Wizard Step View
  const activeQuestion = questions[currentStepIndex];
  if (!activeQuestion) {
    return null;
  }

  const currentAnswer = answers.find(
    (a) => a.questionId === activeQuestion.id
  );
  const canNext = Boolean(
    currentAnswer &&
      currentAnswer.value &&
      currentAnswer.value.trim().length > 0
  );

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const isAllAnswered = questions.every((q) => {
    const ans = answerMap.get(q.id);
    return ans && ans.value && ans.value.trim().length > 0;
  });

  return (
    <div className="space-y-4">
      {saveError && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaveError(null);
              if (currentAnswer) {
                persistAnswerToServer(currentAnswer);
              }
            }}
            className="font-semibold underline hover:text-amber-950 shrink-0"
          >
            Coba Simpan Ulang
          </button>
        </div>
      )}

      <QuestionStep
        question={activeQuestion}
        questionIndex={currentStepIndex}
        totalQuestions={questions.length}
        currentAnswer={currentAnswer}
        onSelectOption={handleSelectOption}
        onCustomTextChange={handleCustomTextChange}
        onDelegateToAi={handleDelegateToAi}
        onNext={handleNext}
        onPrev={handlePrev}
        canPrev={currentStepIndex > 0}
        canNext={canNext}
        isSaving={isSaving}
        onGoToSummary={handleGoToSummary}
        isAllAnswered={isAllAnswered}
      />
    </div>
  );
}
