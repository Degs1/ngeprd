"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, X, AlertCircle, Lightbulb, ArrowRight } from "lucide-react";
import type { Edge } from "@xyflow/react";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNode, QuestionOption } from "@/types/canvas";
import type { QuestionItem } from "@/lib/ai/prompts";
import { getLayoutedElements } from "@/lib/layout/dagre";
import { cn } from "@/lib/utils";

export interface IdeaInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EXAMPLE_IDEAS = [
  "Web marketplace jasa cuci sepatu berbasis lokasi",
  "AI Resume & Portfolio builder untuk solo developer",
  "Aplikasi POS kasir kafe offline-first untuk tablet",
  "SaaS manajemen kos & kontrakan dengan tagihan otomatis",
];

export default function IdeaInputModal({
  isOpen,
  onClose,
  onSuccess,
}: IdeaInputModalProps) {
  const [idea, setIdea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmedIdea = idea.trim();
      if (!trimmedIdea || isLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/plan/questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idea: trimmedIdea }),
        });

        if (!response.ok) {
          let errorMsg = `Gagal merumuskan pertanyaan (Status ${response.status})`;
          try {
            const data = await response.json();
            if (data.error) errorMsg = data.error;
          } catch {
            // keep default error
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const questions: QuestionItem[] = Array.isArray(data)
          ? data
          : data.questions || [];

        if (!questions || questions.length === 0) {
          throw new Error("Tidak ada pertanyaan yang dihasilkan dari ide ini.");
        }

        // 1. Create root idea node
        const rootId = `idea-${Date.now()}`;
        const rootNode: CanvasNode = {
          id: rootId,
          type: "ideaCard",
          position: { x: 0, y: 0 },
          data: {
            label: trimmedIdea,
            idea: trimmedIdea,
            createdAt: new Date().toISOString(),
          },
        };

        // 2. Create question card nodes
        const questionNodes: CanvasNode[] = questions.map((item, index) => {
          const qId = item.id || `question-${index + 1}-${Date.now()}`;
          const options: QuestionOption[] = (item.suggestions || []).map(
            (suggestionText, optIdx) => ({
              id: `${qId}-opt-${optIdx + 1}`,
              label: suggestionText,
            })
          );

          return {
            id: qId,
            type: "questionCard",
            position: { x: 0, y: 0 },
            data: {
              category: item.category || "Arsitektur",
              title: item.category || "Arsitektur",
              question: item.question,
              options,
              status: "pending",
              selectedOptionId: null,
              customAnswer: "",
            },
          };
        });

        // 3. Connect root idea node to all question nodes with directed edges
        const newEdges: Edge[] = questionNodes.map((qNode) => ({
          id: `e-${rootId}-${qNode.id}`,
          source: rootId,
          target: qNode.id,
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }));

        // 4. Determine base nodes (clean up default placeholder if it was untouched)
        const currentNodes = useCanvasStore.getState().nodes;
        const isPlaceholderOnly =
          currentNodes.length <= 2 &&
          currentNodes.some((n) => n.id === "start-node") &&
          currentNodes.every(
            (n) => n.id === "start-node" || n.id === "question-1"
          );

        const baseNodes = isPlaceholderOnly ? [] : currentNodes;
        const baseEdges = isPlaceholderOnly
          ? []
          : useCanvasStore.getState().edges;

        const combinedNodes = [...baseNodes, rootNode, ...questionNodes];
        const combinedEdges = [...baseEdges, ...newEdges];

        // 5. Execute Dagre auto-layout to ensure zero overlap
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(combinedNodes, combinedEdges, {
            direction: "LR",
          });

        // 6. Update canvas store
        useCanvasStore.getState().setNodes(layoutedNodes);
        useCanvasStore.getState().setEdges(layoutedEdges);

        setIdea("");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error("[IdeaInputModal] Error generating plan:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses ide."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [idea, isLoading, onClose, onSuccess]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      {/* Backdrop click to dismiss */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-lg font-bold text-slate-900 leading-tight"
              >
                Rancang Ide Produk
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Apa ide project yang ingin kamu rancang hari ini?
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Gagal memproses ide</p>
                <p className="text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="idea-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Deskripsi Ide Singkat
            </label>
            <textarea
              id="idea-input"
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isLoading}
              placeholder="Contoh: Web marketplace jasa cuci sepatu berbasis lokasi dengan payment gateway dan pelacakan status pesanan real-time..."
              className={cn(
                "w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:bg-white transition-all resize-none",
                "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              autoFocus
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>Tekan Ctrl + Enter untuk langsung generate</span>
              <span>{idea.length} karakter</span>
            </div>
          </div>

          {/* Quick Examples */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Ide Contoh Cepat:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_IDEAS.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setIdea(ex)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-colors text-left"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Loading status bar */}
          {isLoading && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs animate-pulse">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <span>
                AI sedang merumuskan pertanyaan arsitektur & menata graph...
              </span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!idea.trim() || isLoading}
              className={cn(
                "px-5 py-2 text-xs font-semibold rounded-lg text-white transition-all shadow-sm flex items-center gap-2",
                "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Merumuskan...</span>
                </>
              ) : (
                <>
                  <span>Generate Plan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
