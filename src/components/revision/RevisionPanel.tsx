"use client";

import React, { useState } from "react";
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Loader2,
  History,
  Check,
  X,
  Lightbulb,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import ChangeItemCard from "./ChangeItemCard";
import { cn } from "@/lib/utils";

export interface RevisionPanelProps {
  className?: string;
  onSelectSection?: (sectionId: string) => void;
}

export function RevisionPanel({ className, onSelectSection }: RevisionPanelProps) {
  const activeChangeSet = useWorkspaceStore((state) => state.activeChangeSet);
  const changeSetHistory = useWorkspaceStore((state) => state.changeSetHistory);
  const changeSetProgress = useWorkspaceStore((state) => state.changeSetProgress);
  const selectedChangeItemIds = useWorkspaceStore((state) => state.selectedChangeItemIds);
  const changeSetRedirect = useWorkspaceStore((state) => state.changeSetRedirect);
  const isCreatingChangeSet = useWorkspaceStore((state) => state.isCreatingChangeSet);
  const isApplyingChangeSet = useWorkspaceStore((state) => state.isApplyingChangeSet);
  const isRevertingChangeSet = useWorkspaceStore((state) => state.isRevertingChangeSet);
  const changeSetError = useWorkspaceStore((state) => state.changeSetError);
  const changeSetConflicts = useWorkspaceStore((state) => state.changeSetConflicts);
  const sectionNumberMap = useWorkspaceStore((state) => state.sectionNumberMap);
  const selectNode = useWorkspaceStore((state) => state.selectNode);

  // Actions
  const applyChangeSet = useWorkspaceStore((state) => state.applyChangeSet);
  const rejectChangeSet = useWorkspaceStore((state) => state.rejectChangeSet);
  const revertChangeSet = useWorkspaceStore((state) => state.revertChangeSet);
  const toggleChangeItemSelection = useWorkspaceStore(
    (state) => state.toggleChangeItemSelection
  );
  const selectAllChangeItems = useWorkspaceStore(
    (state) => state.selectAllChangeItems
  );
  const deselectImpactedChangeItems = useWorkspaceStore(
    (state) => state.deselectImpactedChangeItems
  );
  const clearChangeSetRedirect = useWorkspaceStore(
    (state) => state.clearChangeSetRedirect
  );
  const clearChangeSetError = useWorkspaceStore((state) => state.clearChangeSetError);
  const createChangeSet = useWorkspaceStore((state) => state.createChangeSet);

  const [applyResultMsg, setApplyResultMsg] = useState<string | null>(null);

  // Handle Apply All
  const handleApplyAll = async () => {
    if (!activeChangeSet) return;
    setApplyResultMsg(null);
    const res = await applyChangeSet(activeChangeSet._id);
    if (res.success) {
      setApplyResultMsg("Semua perubahan berhasil diterapkan ke dokumen.");
    }
  };

  // Handle Apply Selected
  const handleApplySelected = async () => {
    if (!activeChangeSet) return;
    setApplyResultMsg(null);
    const res = await applyChangeSet(activeChangeSet._id, selectedChangeItemIds);
    if (res.success) {
      setApplyResultMsg("Perubahan terpilih berhasil diterapkan ke dokumen.");
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!activeChangeSet) return;
    await rejectChangeSet(activeChangeSet._id);
  };

  // Handle Revert
  const handleRevert = async () => {
    if (!activeChangeSet) return;
    const res = await revertChangeSet(activeChangeSet._id);
    if (res.success) {
      setApplyResultMsg("Perubahan berhasil diurungkan.");
    }
  };

  // Redirect handling
  const handleApplyRedirect = () => {
    if (!changeSetRedirect) return;
    const targetSectionId = changeSetRedirect.sectionId;
    if (onSelectSection) {
      onSelectSection(targetSectionId);
    } else {
      selectNode(targetSectionId);
    }
  };

  const isGenerating =
    activeChangeSet?.status === "generating" || isCreatingChangeSet;
  const isPending = activeChangeSet?.status === "pending";
  const isApplied = activeChangeSet?.status === "applied";
  const isReverted = activeChangeSet?.status === "reverted";
  const isRejected = activeChangeSet?.status === "rejected";
  const isFailed = activeChangeSet?.status === "failed";

  // Total items ready / selected count
  const allItems = activeChangeSet?.items || [];
  const originItem = allItems.find((i) => i.role === "origin");
  const impactedItems = allItems.filter((i) => i.role === "impacted");
  const sortedItems = originItem ? [originItem, ...impactedItems] : allItems;
  const selectedCount = selectedChangeItemIds.length;

  // Empty State: No active changeset
  if (!activeChangeSet && !changeSetRedirect) {
    return (
      <div className={cn("flex-1 p-6 flex flex-col items-center justify-center text-center text-[#8FA396] bg-[#101A16]", className)}>
        <div className="w-12 h-12 rounded-2xl bg-[#162720] border border-[#243D31] flex items-center justify-center text-[#8EA690] mb-3 shadow-2xs">
          <GitPullRequest className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-serif font-bold text-[#EAF0EB]">Tidak Ada Revisi Aktif</h3>
        <p className="text-xs text-[#8FA396] mt-1.5 max-w-xs leading-relaxed font-sans">
          Pilih salah satu bagian di kanvas untuk memunculkan bilah instruksi AI, atau gunakan chip cepat untuk mengajukan revisi.
        </p>

        {/* History preview if available */}
        {changeSetHistory.length > 0 && (
          <div className="mt-8 w-full text-left border-t border-[#1F3028] pt-4">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#8FA396] mb-2 uppercase tracking-wider">
              <History className="w-3.5 h-3.5 text-[#586C61]" />
              <span>Riwayat Revisi ({changeSetHistory.length})</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {changeSetHistory.slice(0, 5).map((cs) => (
                <div
                  key={cs._id}
                  className="px-2.5 py-2 rounded-xl border border-[#22352B] bg-[#121E19] text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-[#EAF0EB] truncate">
                      &quot;{cs.instruction}&quot;
                    </p>
                    <span className="text-[10px] text-[#586C61] font-mono">
                      {cs.items.length} section · {cs.status}
                    </span>
                  </div>
                  {cs.status === "applied" && (
                    <button
                      type="button"
                      onClick={() => revertChangeSet(cs._id)}
                      disabled={isRevertingChangeSet}
                      className="text-[11px] font-semibold text-[#D48B80] hover:text-[#EAF0EB] shrink-0 px-2 py-0.5 rounded bg-[#281816] border border-[#442420] transition-colors"
                    >
                      Urungkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col min-h-0 bg-[#101A16] text-[#EAF0EB]", className)}>
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* Instruction Header Card */}
        {activeChangeSet && (
          <div className="p-3.5 rounded-2xl bg-[#121E19] border border-[#22352B] shadow-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#8EA690] uppercase tracking-wider">
                <span>Instruksi Revisi</span>
              </div>
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full border",
                  isGenerating && "bg-[#18262F] text-[#8CB4D9] border-[#243B4D] animate-pulse",
                  isPending && "bg-[#262215] text-[#D4B36A] border-[#3D3520]",
                  isApplied && "bg-[#152720] text-[#8EA690] border-[#243D31]",
                  isReverted && "bg-[#162620] text-[#8FA396] border-[#22352B]",
                  isRejected && "bg-[#281816] text-[#D48B80] border-[#442420]",
                  isFailed && "bg-[#281816] text-[#D48B80] border-[#442420]"
                )}
              >
                {activeChangeSet.status}
              </span>
            </div>

            <p className="text-xs font-medium text-[#EAF0EB] bg-[#0C1310] p-2.5 rounded-xl border border-[#1F3028] italic">
              &quot;{activeChangeSet.instruction}&quot;
            </p>

            {/* Rationale explanation if available */}
            {activeChangeSet.rationale && (
              <p className="text-[11px] text-[#8FA396] leading-normal">
                {activeChangeSet.rationale}
              </p>
            )}
          </div>
        )}

        {/* Redirect Suggestion Banner */}
        {changeSetRedirect && (
          <div className="p-3.5 rounded-2xl bg-[#18262F] border border-[#243B4D] text-xs shadow-2xs space-y-2 text-[#8CB4D9]">
            <div className="flex items-center gap-1.5 font-bold">
              <Lightbulb className="w-4 h-4 shrink-0" />
              <span>Saran Pengalihan (Redirect)</span>
            </div>
            <p className="leading-normal text-[#EAF0EB]">
              Instruksi ini terdeteksi lebih relevan untuk bagian lain: &quot;
              {changeSetRedirect.reason}&quot;.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={clearChangeSetRedirect}
                className="px-2.5 py-1 text-[#8CB4D9] hover:bg-[#243B4D] rounded-lg font-medium text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleApplyRedirect}
                className="px-3 py-1 bg-[#8CB4D9] hover:bg-[#72A0CC] text-[#0C1310] font-semibold rounded-lg shadow-2xs text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Terapkan ke Section Relevan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Stream Progress Indicator */}
        {isGenerating && (
          <div className="p-3.5 rounded-2xl bg-[#121E19] border border-[#22352B] shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono font-medium text-[#8CB4D9]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {changeSetProgress.message ||
                    (changeSetProgress.step === "analyzing"
                      ? "Menganalisis dampak..."
                      : "Menyusun perubahan...")}
                </span>
              </div>
              {changeSetProgress.total > 0 && (
                <span className="font-mono text-xs font-bold text-[#EAF0EB]">
                  {changeSetProgress.current}/{changeSetProgress.total}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div
              role="progressbar"
              aria-valuenow={
                changeSetProgress.total > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (changeSetProgress.current / changeSetProgress.total) * 100
                      )
                    )
                  : 25
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progres revisi AI"
              className="w-full bg-[#0C1310] h-2 rounded-full overflow-hidden border border-[#1F3028]"
            >
              <div
                className="bg-[#8EA690] h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    changeSetProgress.total > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (changeSetProgress.current / changeSetProgress.total) * 100
                          )
                        )
                      : 25
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Warnings Banner */}
        {activeChangeSet?.warnings && activeChangeSet.warnings.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#262215] border border-[#3D3520] text-xs shadow-2xs space-y-1.5 text-[#D4B36A]">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Peringatan Dampak AI</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-[#8FA396]">
              {activeChangeSet.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Decisions Changes Banner */}
        {activeChangeSet?.keyDecisionChanges &&
          activeChangeSet.keyDecisionChanges.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#121E19] border border-[#22352B] text-xs shadow-2xs space-y-2">
              <div className="flex items-center gap-1.5 font-mono font-semibold text-[#8EA690] uppercase tracking-wider">
                <span>Perubahan Keputusan Kunci</span>
              </div>
              <div className="space-y-1.5">
                {activeChangeSet.keyDecisionChanges.map((dec, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-xl bg-[#0C1310] border border-[#1F3028] text-[11px] space-y-0.5"
                  >
                    {dec.before && (
                      <div className="text-[#D48B80] line-through truncate font-mono">
                        - {dec.before}
                      </div>
                    )}
                    <div className="font-semibold text-[#8EA690] truncate font-mono">
                      + {dec.after}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Version Conflict Alert */}
        {changeSetConflicts && changeSetConflicts.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#281816] border border-[#442420] text-xs shadow-2xs space-y-2 text-[#D48B80]">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Konflik Versi Terdeteksi</span>
            </div>
            <p className="leading-normal text-[11px] text-[#8FA396]">
              Beberapa section telah mengalami modifikasi sejak change set ini dibuat:
            </p>
            <ul className="list-disc list-inside font-mono text-[11px] space-y-0.5 text-[#EAF0EB]">
              {changeSetConflicts.map((c) => (
                <li key={c.sectionId}>
                  Section {sectionNumberMap.get(c.sectionId) || c.sectionId} (base rev:{" "}
                  {c.baseRev}, server rev: {c.currentRev})
                </li>
              ))}
            </ul>
            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={clearChangeSetError}
                className="px-2.5 py-1 text-[#8FA396] hover:bg-[#38201E] rounded-lg text-xs font-medium cursor-pointer"
              >
                Abaikan
              </button>
              {activeChangeSet && (
                <button
                  type="button"
                  onClick={() =>
                    createChangeSet(
                      activeChangeSet.originSectionId,
                      activeChangeSet.instruction
                    )
                  }
                  className="px-3 py-1 bg-[#D48B80] hover:bg-[#C0776D] text-[#0C1310] font-semibold rounded-lg text-xs shadow-2xs cursor-pointer"
                >
                  Buat Ulang dari Versi Terbaru
                </button>
              )}
            </div>
          </div>
        )}

        {/* Generic Error Banner */}
        {changeSetError && !changeSetConflicts && (
          <div className="p-3 rounded-2xl bg-[#281816] border border-[#442420] text-xs text-[#D48B80] flex items-start gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-[#D48B80] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#EAF0EB]">Terjadi Kesalahan</p>
              <p className="text-[11px] text-[#D48B80] mt-0.5 leading-normal">
                {changeSetError}
              </p>
            </div>
            <button
              type="button"
              onClick={clearChangeSetError}
              className="text-[#8FA396] hover:text-[#EAF0EB] p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success message banner */}
        {applyResultMsg && (
          <div className="p-3 rounded-2xl bg-[#152720] border border-[#243D31] text-xs text-[#8EA690] flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium text-[11px]">{applyResultMsg}</span>
          </div>
        )}

        {/* List of ChangeItemCards */}
        {sortedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#8FA396] px-1 pt-1">
              <span>
                Daftar Perubahan ({selectedCount}/{sortedItems.length} dipilih)
              </span>
              {isPending && (
                <div className="flex items-center gap-2 text-[11px] font-normal text-[#586C61]">
                  <button
                    type="button"
                    onClick={selectAllChangeItems}
                    className="text-[#8EA690] hover:underline cursor-pointer"
                  >
                    Pilih Semua
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={deselectImpactedChangeItems}
                    className="text-[#8FA396] hover:underline cursor-pointer"
                  >
                    Hanya Origin
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {sortedItems.map((item) => (
                <ChangeItemCard
                  key={item.sectionId}
                  item={item}
                  sectionNumber={sectionNumberMap.get(item.sectionId)}
                  isSelected={selectedChangeItemIds.includes(item.sectionId)}
                  onToggleSelect={toggleChangeItemSelection}
                  disabled={!isPending || isApplyingChangeSet}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Action Footer */}
      <div className="p-3 bg-[#101A16] border-t border-[#1F3028] shrink-0 shadow-xs z-10">
        {isPending && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              {/* Terima Semua */}
              <button
                type="button"
                onClick={handleApplyAll}
                disabled={isApplyingChangeSet}
                className="flex-1 py-2.5 px-3 min-h-[38px] bg-[#8EA690] hover:bg-[#7D967F] active:scale-98 disabled:opacity-50 text-[#0C1310] rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isApplyingChangeSet ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Terima Semua ({sortedItems.length})</span>
              </button>

              {/* Terima Terpilih */}
              <button
                type="button"
                onClick={handleApplySelected}
                disabled={isApplyingChangeSet || selectedCount === 0}
                className="flex-1 py-2.5 px-3 min-h-[38px] bg-[#162620] hover:bg-[#1D3028] active:bg-[#121E19] border border-[#243D31] text-[#8EA690] disabled:opacity-50 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Terima Terpilih ({selectedCount})</span>
              </button>
            </div>

            {/* Tolak */}
            <button
              type="button"
              onClick={handleReject}
              disabled={isApplyingChangeSet}
              className="w-full py-2 px-3 min-h-[36px] bg-[#121E19] hover:bg-[#281816] text-[#8FA396] hover:text-[#D48B80] border border-[#22352B] rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tolak Change Set</span>
            </button>
          </div>
        )}

        {isApplied && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8EA690]">
              <CheckCircle2 className="w-4 h-4 text-[#8EA690]" />
              <span>Perubahan telah diterapkan</span>
            </div>
            {/* Urungkan */}
            <button
              type="button"
              onClick={handleRevert}
              disabled={isRevertingChangeSet}
              className="py-1.5 px-3 bg-[#281816] hover:bg-[#38201E] border border-[#442420] text-[#D48B80] font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {isRevertingChangeSet ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Urungkan</span>
            </button>
          </div>
        )}

        {isReverted && (
          <div className="flex items-center gap-1.5 text-xs text-[#586C61] justify-center py-1">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Change set telah diurungkan</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-1.5 text-xs text-[#D48B80] justify-center py-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Change set ditolak</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RevisionPanel;
