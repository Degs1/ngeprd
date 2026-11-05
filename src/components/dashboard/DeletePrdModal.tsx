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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md bg-[#121E19] rounded-2xl shadow-2xl border border-[#22352B] p-5 sm:p-6 flex flex-col gap-4 transform transition-all text-[#EAF0EB]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#281816] border border-[#442420] flex items-center justify-center text-[#D48B80] shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="delete-dialog-title"
              className="text-base font-serif font-bold text-[#EAF0EB]"
            >
              Hapus PRD
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[#8FA396] leading-relaxed break-words">
              Apakah Anda yakin ingin menghapus{" "}
              <span className="font-semibold text-[#EAF0EB]">
                &ldquo;{prdTitle}&rdquo;
              </span>
              ? Seluruh dokumen dan histori perubahan akan dihapus secara permanen.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1F3028]">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-4 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#8FA396] hover:text-[#EAF0EB] bg-[#162620] hover:bg-[#1D3028] border border-[#22352B] rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-[#0C1310] bg-[#D48B80] hover:bg-[#C0776D] active:scale-95 rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer",
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
