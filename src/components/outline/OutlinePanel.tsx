"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  BookOpen,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  Clock,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { OutlineItem } from "./OutlineItem";
import RevisionPanel from "../revision/RevisionPanel";
import { getOutlineStats } from "@/lib/converter/outline";
import { cn } from "@/lib/utils";

export interface OutlinePanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  isMobileDrawer?: boolean;
  onCloseMobile?: () => void;
}

export default function OutlinePanel({
  isCollapsed = false,
  onToggleCollapse,
  className,
  isMobileDrawer = false,
  onCloseMobile,
}: OutlinePanelProps) {
  const { getNode, setCenter, fitView } = useReactFlow();

  const outlineTree = useWorkspaceStore((state) => state.outlineTree);
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);
  const selectNode = useWorkspaceStore((state) => state.selectNode);
  const collapsedChapters = useWorkspaceStore((state) => state.collapsedChapters);
  const toggleChapter = useWorkspaceStore((state) => state.toggleChapter);
  const setAllChaptersCollapsed = useWorkspaceStore((state) => state.setAllChaptersCollapsed);
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const activeChangeSet = useWorkspaceStore((state) => state.activeChangeSet);

  const pendingRevisionCount =
    activeChangeSet &&
    (activeChangeSet.status === "pending" || activeChangeSet.status === "generating")
      ? activeChangeSet.items.length
      : 0;

  // References to items for auto-scrolling
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Summary statistics
  const stats = useMemo(() => getOutlineStats(outlineTree), [outlineTree]);

  // Flat list of all section IDs for keyboard navigation
  const allSectionIds = useMemo(() => {
    const ids: string[] = [];
    for (const chap of outlineTree) {
      for (const item of chap.items) {
        ids.push(item.section.id);
      }
    }
    return ids;
  }, [outlineTree]);

  // Smooth centering on canvas when outline item is clicked (FR-OUT-03)
  const handleSectionClick = useCallback(
    (sectionId: string) => {
      selectNode(sectionId);

      const targetNode = getNode(sectionId);
      if (targetNode) {
        const width = targetNode.measured?.width ?? 380;
        const height = targetNode.measured?.height ?? 220;
        const centerX = targetNode.position.x + width / 2;
        const centerY = targetNode.position.y + height / 2;

        setCenter(centerX, centerY, { zoom: 1, duration: 400 });
      } else {
        // Fallback: wait a tick if node is freshly mounted
        setTimeout(() => {
          const freshNode = getNode(sectionId);
          if (freshNode) {
            const width = freshNode.measured?.width ?? 380;
            const height = freshNode.measured?.height ?? 220;
            setCenter(
              freshNode.position.x + width / 2,
              freshNode.position.y + height / 2,
              { zoom: 1, duration: 400 }
            );
          }
        }, 50);
      }

      // Close mobile drawer on item selection if in mobile drawer
      if (isMobileDrawer && onCloseMobile) {
        onCloseMobile();
      }
    },
    [getNode, selectNode, setCenter, isMobileDrawer, onCloseMobile]
  );

  // Chapter click fits canvas viewport to nodes in this chapter (FR-OUT-05)
  const handleChapterClick = useCallback(
    (chapterId: string, sectionIds: string[]) => {
      if (sectionIds.length === 0) return;
      const nodes = sectionIds
        .map((id) => getNode(id))
        .filter((n): n is NonNullable<typeof n> => n !== undefined);

      if (nodes.length > 0) {
        fitView({
          nodes,
          padding: 0.25,
          duration: 400,
        });
      }
    },
    [fitView, getNode]
  );

  // Auto-scroll outline to selected section when canvas selection changes (FR-OUT-04)
  useEffect(() => {
    if (!selectedNodeId) return;

    // Find the chapter containing this section and ensure it's not collapsed
    for (const chap of outlineTree) {
      const hasSection = chap.items.some((i) => i.section.id === selectedNodeId);
      if (hasSection && collapsedChapters[chap.chapter.id]) {
        toggleChapter(chap.chapter.id);
        break;
      }
    }

    const targetEl = itemRefs.current[selectedNodeId];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedNodeId, outlineTree, collapsedChapters, toggleChapter]);

  // Keyboard navigation handler (FR-OUT-07)
  const handleKeyDown = useCallback(
    (e: any, currentId: string) => {
      const currentIndex = allSectionIds.indexOf(currentId);
      if (currentIndex === -1) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextId = allSectionIds[Math.min(allSectionIds.length - 1, currentIndex + 1)];
        handleSectionClick(nextId);
        itemRefs.current[nextId]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevId = allSectionIds[Math.max(0, currentIndex - 1)];
        handleSectionClick(prevId);
        itemRefs.current[prevId]?.focus();
      }
    },
    [allSectionIds, handleSectionClick]
  );

  if (isCollapsed && !isMobileDrawer) {
    return (
      <div className="hidden md:flex border-l border-slate-200 bg-white flex-col items-center py-4 px-1 w-12 shrink-0 h-full">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Buka Panel Outline"
          aria-label="Buka panel outline"
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>
        <div className="mt-8 [writing-mode:vertical-rl] text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Outline ({stats.readySections}/{stats.totalSections})
        </div>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        isMobileDrawer
          ? "w-full h-full bg-white flex flex-col select-none"
          : "hidden md:flex w-80 md:w-88 border-l border-slate-200 bg-white flex-col h-full shrink-0 select-none shadow-xs z-10",
        className
      )}
    >
      {/* Top Header with Tabs & Collapse/Close Button */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("outline")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === "outline"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Outline</span>
            <span className="text-[11px] font-mono font-normal text-slate-400">
              {stats.readySections}/{stats.totalSections}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("revisions")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === "revisions"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>Revisi</span>
            {pendingRevisionCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-600 text-white animate-pulse">
                {pendingRevisionCount}
              </span>
            )}
          </button>
        </div>

        {isMobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup Panel"
            aria-label="Tutup panel"
          >
            <X className="w-5 h-5" />
          </button>
        ) : onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Sembunyikan Panel"
            aria-label="Sembunyikan panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab: Outline */}
      {activeTab === "outline" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Quick Toolbar */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-[11px] text-slate-500 uppercase tracking-wider">
              {stats.totalChapters} Bab · {stats.totalSections} Bagian
            </span>
            <button
              type="button"
              onClick={() => {
                const areAnyCollapsed = Object.values(collapsedChapters).some(Boolean);
                setAllChaptersCollapsed(!areAnyCollapsed);
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
            >
              <ChevronsUpDown className="w-3 h-3" />
              <span>
                {Object.values(collapsedChapters).some(Boolean)
                  ? "Buka Semua"
                  : "Lipat Semua"}
              </span>
            </button>
          </div>

          {/* Chapters & Sections Tree */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {outlineTree.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300 animate-pulse" />
                <p className="font-medium text-slate-600">Menunggu AI Planner...</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Outline akan muncul segera setelah struktur disiapkan
                </p>
              </div>
            ) : (
              outlineTree.map((chap) => {
                const isCollapsed = Boolean(collapsedChapters[chap.chapter.id]);
                const sectionIds = chap.items.map((i) => i.section.id);
                const readyInChapter = chap.items.filter(
                  (i) => i.section.status === "ready"
                ).length;

                return (
                  <div
                    key={chap.chapter.id}
                    className="border border-slate-200/80 rounded-2xl bg-white shadow-2xs overflow-hidden"
                  >
                    {/* Chapter Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100/60 transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleChapter(chap.chapter.id)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="text-slate-400">
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {chap.number}
                        </span>
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {chap.chapter.title}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {readyInChapter}/{chap.items.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChapterClick(chap.chapter.id, sectionIds)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                          title="Fokuskan kanvas ke bab ini"
                          aria-label={`Fokuskan kanvas ke bab ${chap.chapter.title}`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Section Items */}
                    {!isCollapsed && (
                      <div className="p-1.5 space-y-1">
                        {chap.items.map((item) => (
                          <OutlineItem
                            key={item.section.id}
                            ref={(el) => {
                              itemRefs.current[item.section.id] = el;
                            }}
                            item={item}
                            isSelected={selectedNodeId === item.section.id}
                            onClick={() => handleSectionClick(item.section.id)}
                            onKeyDown={(e) => handleKeyDown(e, item.section.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Revisions (PRD 8.2 & TASK-016) */}
      {activeTab === "revisions" && <RevisionPanel onSelectSection={handleSectionClick} />}
    </aside>
  );
}
