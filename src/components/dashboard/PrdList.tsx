"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Check,
  X,
  FileText,
  Search,
} from "lucide-react";
import { usePrdStore, type PrdListItem } from "@/store/usePrdStore";
import StatusChip from "./StatusChip";
import DeletePrdModal from "./DeletePrdModal";
import { cn } from "@/lib/utils";

export default function PrdList() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    prds,
    isLoading,
    searchQuery,
    renamePrd,
    deletePrd,
    setSidebarOpenMobile,
  } = usePrdStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deletingItem, setDeletingItem] = useState<PrdListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Client-side filter
  const filteredPrds = useMemo(() => {
    if (!searchQuery.trim()) return prds;
    const q = searchQuery.toLowerCase().trim();
    return prds.filter((p) => p.title.toLowerCase().includes(q));
  }, [prds, searchQuery]);

  // Group by "Hari ini", "7 hari terakhir", "Lebih lama"
  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const groups: {
      today: PrdListItem[];
      last7Days: PrdListItem[];
      older: PrdListItem[];
    } = {
      today: [],
      last7Days: [],
      older: [],
    };

    filteredPrds.forEach((item) => {
      const itemDate = new Date(item.updatedAt);
      if (isNaN(itemDate.getTime())) {
        groups.older.push(item);
      } else if (itemDate >= today) {
        groups.today.push(item);
      } else if (itemDate >= sevenDaysAgo) {
        groups.last7Days.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  }, [filteredPrds]);

  const handleStartRename = (e: React.MouseEvent, item: PrdListItem) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(item._id);
    setEditTitle(item.title);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleSaveRename = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!editingId || !editTitle.trim() || isRenaming) return;

    setIsRenaming(true);
    try {
      await renamePrd(editingId, editTitle.trim());
      setEditingId(null);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleStartDelete = (e: React.MouseEvent, item: PrdListItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem || isDeleting) return;

    setIsDeleting(true);
    const idToDelete = deletingItem._id;
    try {
      const ok = await deletePrd(idToDelete);
      if (ok && pathname === `/prd/${idToDelete}`) {
        router.push("/");
      }
      setDeletingItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && prds.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-12 rounded-xl bg-slate-100 animate-pulse border border-slate-200/50"
          />
        ))}
      </div>
    );
  }

  if (prds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <FileText className="w-5 h-5" />
        </div>
        <p className="text-xs font-medium text-slate-600">Belum ada PRD</p>
        <p className="text-[11px] text-slate-400">
          Tulis ide proyek pertamamu di dashboard untuk mulai membuat PRD!
        </p>
      </div>
    );
  }

  if (filteredPrds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
        <Search className="w-5 h-5 text-slate-400" />
        <p className="text-xs text-slate-500">
          Tidak ada PRD dengan judul &ldquo;{searchQuery}&rdquo;
        </p>
      </div>
    );
  }

  const renderGroup = (title: string, items: PrdListItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          {title}
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {items.map((item) => {
            const isActive = pathname === `/prd/${item._id}`;
            const isEditing = editingId === item._id;

            return (
              <div
                key={item._id}
                className={cn(
                  "group relative flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all border",
                  isActive
                    ? "bg-indigo-50/80 border-indigo-200 text-indigo-950 font-medium shadow-sm"
                    : "border-transparent text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                {isEditing ? (
                  <div
                    className="flex items-center gap-1.5 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename();
                        if (e.key === "Escape") handleCancelRename();
                      }}
                      autoFocus
                      disabled={isRenaming}
                      className="w-full px-2 py-1.5 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRename}
                      disabled={isRenaming || !editTitle.trim()}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-50"
                      title="Simpan"
                      aria-label="Simpan judul"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      disabled={isRenaming}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 active:bg-slate-300"
                      title="Batal"
                      aria-label="Batal ubah judul"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href={`/prd/${item._id}`}
                      onClick={() => setSidebarOpenMobile(false)}
                      className="flex-1 min-w-0 pr-2 py-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs text-slate-800 font-medium">
                          {item.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <StatusChip status={item.status} size="sm" />
                      </div>
                    </Link>

                    {/* Actions: visible on mobile touch, reveal on desktop hover */}
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(e, item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 active:bg-slate-200 transition-colors"
                        title="Ganti nama"
                        aria-label={`Ganti nama ${item.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleStartDelete(e, item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors"
                        title="Hapus PRD"
                        aria-label={`Hapus ${item.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {renderGroup("Hari ini", grouped.today)}
        {renderGroup("7 hari terakhir", grouped.last7Days)}
        {renderGroup("Lebih lama", grouped.older)}
      </div>

      <DeletePrdModal
        isOpen={!!deletingItem}
        prdTitle={deletingItem?.title || ""}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </>
  );
}
