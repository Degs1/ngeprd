"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeletePrdModalProps {
  isOpen: boolean;
  prdTitle: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeletePrdModal({
  isOpen,
  prdTitle,
  isDeleting,
  onConfirm,
  onCancel,
}: DeletePrdModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3
              id="delete-dialog-title"
              className="text-base font-semibold text-slate-900"
            >
              Hapus PRD
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus{" "}
              <span className="font-semibold text-slate-800">
                &ldquo;{prdTitle}&rdquo;
              </span>
              ? Seluruh dokumen dan histori perubahan akan dihapus secara permanen.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm",
              isDeleting && "opacity-60 cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <span>Hapus PRD</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
