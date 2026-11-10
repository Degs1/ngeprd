"use client";

import { useWorkspaceStore } from "@/store/useWorkspaceStore";

export interface RevisionPanelProps { className?: string; onSelectSection?: (sectionId: string) => void; }

/** Historical AI changesets remain readable and reversible. New AI revisions are retired. */
export default function RevisionPanel({ className = "", onSelectSection }: RevisionPanelProps) {
  const history = useWorkspaceStore((state) => state.changeSetHistory);
  const revert = useWorkspaceStore((state) => state.revertChangeSet);
  const busy = useWorkspaceStore((state) => state.isRevertingChangeSet);
  const error = useWorkspaceStore((state) => state.changeSetError);
  return <div className={`p-4 space-y-3 ${className}`}>
    <h2 className="text-sm font-semibold text-[#EAF0EB]">Riwayat revisi</h2>
    <p className="text-xs text-[#8FA396]">Revisi lama tetap dapat dibaca. Edit baru dilakukan langsung pada node.</p>
    {error && <p role="alert" className="text-xs text-[#D48B80]">{error}</p>}
    {history.length === 0 && <p className="text-xs text-[#8FA396]">Belum ada riwayat revisi.</p>}
    {history.map((item) => <div key={item._id} className="rounded-lg border border-[#243C30] bg-[#15231D] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-[#EAF0EB]">{item.status}</span>
        {item.createdAt && <time className="text-[10px] text-[#8FA396]">{new Date(item.createdAt).toLocaleDateString()}</time>}</div>
      <p className="text-xs text-[#8FA396]">{item.instruction}</p>
      <button type="button" className="text-xs underline text-[#8EA690]" onClick={() => onSelectSection?.(item.originSectionId)}>Lihat section</button>
      {item.status === "applied" && <button type="button" disabled={busy} className="ml-3 text-xs underline text-[#D4B36A]" onClick={() => void revert(item._id)}>Urungkan</button>}
    </div>)}
  </div>;
}
