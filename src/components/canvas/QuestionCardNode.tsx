"use client";

import React, { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Clock, Check, ArrowRight } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { QuestionNodeData } from "@/types/canvas";
import { cn } from "@/lib/utils";

function QuestionCardNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as QuestionNodeData;
  const selectOption = useCanvasStore((s) => s.selectOption);
  const setCustomAnswer = useCanvasStore((s) => s.setCustomAnswer);

  const [customInput, setCustomInput] = useState(nodeData.customAnswer || "");

  useEffect(() => {
    setCustomInput(nodeData.customAnswer || "");
  }, [nodeData.customAnswer]);

  const handleSelectOption = useCallback(
    (optionId: string) => {
      selectOption(id, optionId);
    },
    [id, selectOption]
  );

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (customInput.trim()) {
        setCustomAnswer(id, customInput.trim());
      }
    },
    [id, customInput, setCustomAnswer]
  );

  const isAnswered = nodeData.status === "answered";
  const isCustomSelected = nodeData.selectedOptionId === "custom";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-white shadow-sm transition-all duration-200 w-[320px] select-none",
        selected
          ? "ring-2 ring-indigo-500 shadow-md"
          : "hover:shadow-md",
        isAnswered ? "border-slate-300" : "border-slate-200"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-slate-400 border-2 border-white rounded-full hover:!bg-indigo-600 transition-colors"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1 border-b border-slate-100">
        <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider">
          {nodeData.category || nodeData.title || "Keputusan"}
        </span>

        {isAnswered ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Answered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
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
                  ? "bg-indigo-50/80 border-indigo-500 text-indigo-950 font-medium shadow-xs"
                  : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center transition-colors border",
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-slate-300 group-hover:border-slate-400 bg-white"
                )}
              >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs leading-tight font-medium">
                  {option.label}
                </div>
                {option.description && (
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug font-normal">
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
            <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Dipilih
            </span>
          )}
        </div>
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Tulis jawaban spesifik..."
            className={cn(
              "nodrag nopan flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all",
              isCustomSelected
                ? "border-indigo-500 ring-1 ring-indigo-500"
                : "border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
            )}
          />
          <button
            type="submit"
            disabled={!customInput.trim()}
            className="nodrag nopan px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center gap-1"
            title="Terapkan jawaban kustom"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-indigo-500 border-2 border-white rounded-full hover:!bg-indigo-600 transition-colors"
      />
    </div>
  );
}

export default memo(QuestionCardNode);
