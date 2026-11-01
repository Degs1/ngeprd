"use client";

import React, { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Clock, Check, ArrowRight, X } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { QuestionNodeData } from "@/types/canvas";
import { cn } from "@/lib/utils";

function QuestionCardNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as QuestionNodeData;
  const setAnswer = useCanvasStore((s) => s.setAnswer);

  const [customInput, setCustomInput] = useState(nodeData.customAnswer || "");

  useEffect(() => {
    setCustomInput(nodeData.customAnswer || "");
  }, [nodeData.customAnswer]);

  const handleSelectOption = useCallback(
    (optionId: string) => {
      setAnswer(id, optionId);
    },
    [id, setAnswer]
  );

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (customInput.trim()) {
        setAnswer(id, "custom", customInput.trim());
      }
    },
    [id, customInput, setAnswer]
  );

  const handleClearCustom = useCallback(() => {
    setCustomInput("");
    setAnswer(id, null, "");
  }, [id, setAnswer]);

  const isAnswered = nodeData.status === "answered";
  const isCustomSelected = nodeData.selectedOptionId === "custom";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-white shadow-xs transition-all duration-200 w-[320px] select-none",
        selected
          ? "ring-2 ring-indigo-500 shadow-lg border-indigo-400"
          : isAnswered
          ? "border-emerald-300 ring-1 ring-emerald-500/20 shadow-sm"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "w-3 h-3 border-2 border-white rounded-full transition-colors",
          isAnswered
            ? "!bg-emerald-500 hover:!bg-emerald-600"
            : "!bg-slate-400 hover:!bg-indigo-600"
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1 border-b border-slate-100">
        <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider">
          {nodeData.category || nodeData.title || "Keputusan"}
        </span>

        {isAnswered ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all duration-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Answered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 transition-all duration-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
            Pending
          </span>
        )}
      </div>

      {/* Question Body */}
      <div className="px-3.5 pt-2.5 pb-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug">
          {nodeData.question}
        </p>
      </div>

      {/* Options List */}
      <div className="flex flex-col gap-1.5 px-3.5 pb-2.5">
        {nodeData.options?.map((option) => {
          const isSelected = nodeData.selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectOption(option.id)}
              className={cn(
                "nodrag nopan w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2.5 cursor-pointer group",
                isSelected
                  ? "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-semibold shadow-2xs ring-1 ring-indigo-500/20"
                  : "bg-slate-50/70 hover:bg-slate-100/90 border-slate-200 text-slate-700 hover:border-slate-300"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all border",
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs"
                    : "border-slate-300 group-hover:border-slate-400 bg-white"
                )}
              >
                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-xs leading-tight",
                    isSelected ? "font-semibold text-indigo-950" : "font-medium text-slate-800"
                  )}
                >
                  {option.label}
                </div>
                {option.description && (
                  <div
                    className={cn(
                      "text-[11px] mt-0.5 leading-snug font-normal",
                      isSelected ? "text-indigo-800/80" : "text-slate-500"
                    )}
                  >
                    {option.description}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Answer Input */}
      <div className="px-3.5 pb-3 pt-2 border-t border-slate-100">
        <div className="text-[11px] font-medium text-slate-500 mb-1.5 flex items-center justify-between">
          <span>Opsi Lainnya (Kustom)</span>
          {isCustomSelected && (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-semibold">
              <Check className="w-3 h-3 text-emerald-600" /> Kustom Aktif
            </span>
          )}
        </div>
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={customInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCustomInput(e.target.value)
            }
            placeholder="Tulis jawaban spesifik..."
            className={cn(
              "nodrag nopan flex-1 px-2.5 py-1.5 text-xs rounded-md placeholder-slate-400 focus:outline-none transition-all",
              isCustomSelected
                ? "bg-white border border-indigo-500 ring-2 ring-indigo-500/20 text-slate-900 font-medium"
                : "bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
            )}
          />
          {isCustomSelected && (
            <button
              type="button"
              onClick={handleClearCustom}
              className="nodrag nopan p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="Hapus jawaban kustom"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={
              !customInput.trim() ||
              (isCustomSelected &&
                customInput.trim() === (nodeData.customAnswer || "").trim())
            }
            className="nodrag nopan px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center gap-1 shadow-2xs"
            title="Terapkan jawaban kustom"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "w-3 h-3 border-2 border-white rounded-full transition-colors",
          isAnswered
            ? "!bg-emerald-500 hover:!bg-emerald-600"
            : "!bg-indigo-500 hover:!bg-indigo-600"
        )}
      />
    </div>
  );
}

export default memo(QuestionCardNode);
