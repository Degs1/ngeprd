"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  RotateCcw,
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
  isGenerating?: boolean;
}

export default function BrainstormWizard({
  prdId,
  idea,
  initialQuestions = [],
  initialAnswers = [],
  onGeneratePrd,
  onAnswersUpdated,
  isGenerating: propIsGenerating,
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
  const [localIsGenerating, setLocalIsGenerating] = useState<boolean>(false);
  const isGenerating = propIsGenerating !== undefined ? propIsGenerating : localIsGenerating;

  const isFetchingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAnswerRef = useRef<BrainstormAnswer | null>(null);

  const computeResumeStep = useCallback(
    (qs: BrainstormQuestion[], ans: BrainstormAnswer[]): number => {
      if (!qs || qs.length === 0) return 0;
      const answerMap = new Map(ans.map((a) => [a.questionId, a]));

      const firstUnansweredIndex = qs.findIndex((q) => {
        const item = answerMap.get(q.id);
        return !item || !item.value || item.value.trim().length === 0;
      });

      if (firstUnansweredIndex === -1) {
        return qs.length;
      }
      return firstUnansweredIndex;
    },
    []
  );

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
          "Gagal merumuskan pertanyaan brainstorming. Silakan coba kembali.";
        setError({ code: errorCode, message: errorMsg });
        setIsLoadingQuestions(false);
        isFetchingRef.current = false;
        return;
      }

      if (data?.data?.questions && Array.isArray(data.data.questions)) {
        const fetchedQuestions: BrainstormQuestion[] = data.data.questions;
        const fetchedAnswers: BrainstormAnswer[] = data.data.answers || [];

        setQuestions(fetchedQuestions);
        setAnswers(fetchedAnswers);

        if (!hasInitializedStep) {
          const step = computeResumeStep(fetchedQuestions, fetchedAnswers);
          setCurrentStepIndex(step);
          setHasInitializedStep(true);
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi gangguan jaringan saat meminta pertanyaan.";
      setError({ code: "NETWORK_ERROR", message: msg });
    } finally {
      setIsLoadingQuestions(false);
      isFetchingRef.current = false;
    }
  }, [prdId, hasInitializedStep, computeResumeStep]);

  useEffect(() => {
    if (initialQuestions.length === 0) {
      fetchQuestions();
    } else if (!hasInitializedStep) {
      const step = computeResumeStep(initialQuestions, initialAnswers);
      setCurrentStepIndex(step);
      setHasInitializedStep(true);
    }
  }, [fetchQuestions, initialQuestions, initialAnswers, hasInitializedStep, computeResumeStep]);

  const persistAnswerToServer = useCallback(
    async (answerToSave: BrainstormAnswer) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const res = await fetch(`/api/prds/${prdId}/brainstorm/answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: answerToSave.questionId,
            value: answerToSave.value,
            isCustom: answerToSave.isCustom,
            delegated: answerToSave.delegated,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSaveError(
            data?.error?.message || "Gagal menyimpan jawaban ke database."
          );
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Gangguan jaringan saat menyimpan jawaban.";
        setSaveError(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [prdId]
  );

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

  const saveAnswer = useCallback(
    (newAnswer: BrainstormAnswer, debounce: boolean = false) => {
      setAnswers((prev) => {
        const filtered = prev.filter((a) => a.questionId !== newAnswer.questionId);
        const updated = [...filtered, newAnswer];
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
        }, 800);
      } else {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pendingAnswerRef.current = null;
        persistAnswerToServer(newAnswer);
      }
    },
    [onAnswersUpdated, persistAnswerToServer]
  );

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
    setLocalIsGenerating(true);
    if (onGeneratePrd) {
      onGeneratePrd();
    }
  };

  // 1. Loading View
  if (isLoadingQuestions) {
    return (
      <div className="bg-[#121E19] rounded-2xl border border-[#22352B] shadow-xl p-8 md:p-12 text-center text-[#EAF0EB]">
        <div className="w-12 h-12 rounded-2xl bg-[#162720] border border-[#243D31] flex items-center justify-center text-[#8EA690] mx-auto mb-5 shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-lg md:text-xl font-serif font-bold text-[#EAF0EB]">
          AI Menyiapkan Pertanyaan...
        </h2>
        <p className="text-sm text-[#8FA396] mt-2 max-w-md mx-auto leading-relaxed">
          Menganalisis ide produk Anda untuk merumuskan 4–6 pertanyaan arsitektur dan kebutuhan spesifik domain.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-[#0C1310] border border-[#1F3028] max-w-lg mx-auto text-left">
          <div className="text-[10px] font-mono font-semibold text-[#8EA690] uppercase tracking-wider mb-1">
            Ide Anda:
          </div>
          <p className="text-xs text-[#8FA396] line-clamp-3 leading-relaxed">
            {idea}
          </p>
        </div>
      </div>
    );
  }

  // 2. Error View
  if (error) {
    return (
      <div className="bg-[#121E19] rounded-2xl border border-[#442420] shadow-xl p-6 md:p-8 text-center max-w-xl mx-auto text-[#EAF0EB]">
        <div className="w-12 h-12 rounded-2xl bg-[#281816] border border-[#442420] flex items-center justify-center text-[#D48B80] mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-serif font-bold text-[#D48B80]">
          Gagal Menyiapkan Pertanyaan
        </h2>
        <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-[#281816] border border-[#442420] text-[#D48B80] text-xs font-mono font-semibold">
          {error.code}
        </div>
        <p className="text-sm text-[#8FA396] mt-3 leading-relaxed">
          {error.message}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={fetchQuestions}
            className="px-5 py-2.5 text-xs font-semibold text-[#0C1310] bg-[#8EA690] hover:bg-[#7D967F] rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Summary View
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
        <div className="p-3.5 rounded-xl bg-[#262215] border border-[#3D3520] text-[#D4B36A] text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
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
            className="font-semibold underline hover:text-[#EAF0EB] shrink-0"
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
