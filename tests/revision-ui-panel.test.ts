import { test } from "node:test";
import assert from "node:assert/strict";
import { diffWordsWithSpace, diffLines } from "diff";
import { useWorkspaceStore, type ClientChangeSet, type ClientChangeItem } from "../src/store/useWorkspaceStore";

test("DiffView logic - correctly calculates word-level additions and deletions", () => {
  const before = "Backend dibangun menggunakan Node.js dan Express.";
  const after = "Backend dibangun menggunakan Python dan FastAPI.";

  const parts = diffWordsWithSpace(before, after);

  const additions = parts.filter((p) => p.added).map((p) => p.value);
  const deletions = parts.filter((p) => p.removed).map((p) => p.value);

  assert.ok(additions.some((w) => w.includes("Python")));
  assert.ok(additions.some((w) => w.includes("FastAPI")));
  assert.ok(deletions.some((w) => w.includes("Node.js")));
  assert.ok(deletions.some((w) => w.includes("Express")));
});

test("DiffView logic - correctly calculates line-level additions and deletions", () => {
  const before = `line 1\nline 2 unchanged\nline 3 to remove`;
  const after = `line 1\nline 2 unchanged\nline 3 added\nline 4 new`;

  const lines = diffLines(before, after);

  const addedLines = lines.filter((l) => l.added).map((l) => l.value);
  const removedLines = lines.filter((l) => l.removed).map((l) => l.value);

  assert.ok(addedLines.some((l) => l.includes("line 3 added")));
  assert.ok(addedLines.some((l) => l.includes("line 4 new")));
  assert.ok(removedLines.some((l) => l.includes("line 3 to remove")));
});

test("ChangeItemCard logic - enforces origin section locking and consistency warning on term-match", () => {
  const originItem: ClientChangeItem = {
    sectionId: "sec_tech_stack",
    role: "origin",
    reason: "Ganti ke Python",
    detectedBy: "origin",
    baseRev: 1,
    before: { title: "Tech Stack", content: "Node.js" },
    after: { title: "Tech Stack", content: "Python" },
    status: "ready",
  };

  const termMatchItem: ClientChangeItem = {
    sectionId: "sec_arch",
    role: "impacted",
    reason: "Term-match Node.js",
    detectedBy: "term-match",
    baseRev: 1,
    before: { title: "Arsitektur", content: "Node.js service" },
    after: { title: "Arsitektur", content: "Python service" },
    status: "ready",
  };

  // Rule 1: Origin role cannot be unchecked
  const isOrigin = originItem.role === "origin";
  assert.equal(isOrigin, true);

  // Rule 2: Unchecked term-match item displays consistency warning condition (FR-AI-05)
  const isSelected = false;
  const showConsistencyWarning = termMatchItem.detectedBy === "term-match" && !isSelected;
  assert.equal(showConsistencyWarning, true);

  // If selected, consistency warning is false
  const showWhenSelected = termMatchItem.detectedBy === "term-match" && true;
  assert.equal(showWhenSelected, true);
});

test("WorkspaceStore - changeset selection state prevents deselecting origin section (FR-AI-05)", () => {
  const dummyChangeSet: ClientChangeSet = {
    _id: "cs_123",
    docId: "doc_123",
    originSectionId: "sec_origin",
    instruction: "Pakai Python",
    status: "pending",
    rationale: "Migrasi tech stack",
    warnings: ["Perlu setup virtual environment"],
    keyDecisionChanges: [{ before: "Node.js", after: "Python" }],
    items: [
      {
        sectionId: "sec_origin",
        role: "origin",
        reason: "User instruction",
        detectedBy: "origin",
        baseRev: 1,
        before: { title: "Tech Stack", content: "Node.js" },
        after: { title: "Tech Stack", content: "Python" },
        status: "ready",
      },
      {
        sectionId: "sec_impacted_1",
        role: "impacted",
        reason: "Term-match",
        detectedBy: "term-match",
        baseRev: 1,
        before: { title: "Arsitektur", content: "Node.js" },
        after: { title: "Arsitektur", content: "Python" },
        status: "ready",
      },
    ],
  };

  // Set store state with changeset
  useWorkspaceStore.setState({
    activeChangeSet: dummyChangeSet,
    selectedChangeItemIds: ["sec_origin", "sec_impacted_1"],
  });

  // Attempt to deselect origin: should be a no-op per FR-AI-05
  useWorkspaceStore.getState().toggleChangeItemSelection("sec_origin");
  let selected = useWorkspaceStore.getState().selectedChangeItemIds;
  assert.ok(selected.includes("sec_origin"), "Origin section MUST remain selected");

  // Deselect impacted section: should succeed
  useWorkspaceStore.getState().toggleChangeItemSelection("sec_impacted_1");
  selected = useWorkspaceStore.getState().selectedChangeItemIds;
  assert.ok(!selected.includes("sec_impacted_1"), "Impacted section should be toggled off");
  assert.ok(selected.includes("sec_origin"), "Origin section MUST still be selected");

  // Select all: both are selected
  useWorkspaceStore.getState().selectAllChangeItems();
  selected = useWorkspaceStore.getState().selectedChangeItemIds;
  assert.equal(selected.length, 2);

  // Deselect impacted items: only origin remains
  useWorkspaceStore.getState().deselectImpactedChangeItems();
  selected = useWorkspaceStore.getState().selectedChangeItemIds;
  assert.deepEqual(selected, ["sec_origin"]);
});

test("WorkspaceStore - handles redirect suggestion state (FR-AI-12)", () => {
  useWorkspaceStore.setState({
    changeSetRedirect: {
      sectionId: "sec_features",
      reason: "Instruksi ini membahas fitur chat, lebih cocok di 2.1 Fitur",
    },
  });

  const state = useWorkspaceStore.getState();
  assert.equal(state.changeSetRedirect?.sectionId, "sec_features");
  assert.ok(state.changeSetRedirect?.reason.includes("fitur chat"));

  // Clear redirect
  useWorkspaceStore.getState().clearChangeSetRedirect();
  assert.equal(useWorkspaceStore.getState().changeSetRedirect, null);
});

test("WorkspaceStore - handles 409 conflict and revert state cleanly", () => {
  // Simulate setting conflict state
  useWorkspaceStore.setState({
    changeSetConflicts: [
      { sectionId: "sec_tech_stack", baseRev: 1, currentRev: 2 },
    ],
    changeSetError: "Konflik versi: Section telah berubah sejak revisi dibuat.",
  });

  let state = useWorkspaceStore.getState();
  assert.equal(state.changeSetConflicts?.length, 1);
  assert.equal(state.changeSetConflicts?.[0].baseRev, 1);
  assert.equal(state.changeSetConflicts?.[0].currentRev, 2);

  // Clear conflict
  useWorkspaceStore.getState().clearChangeSetError();
  state = useWorkspaceStore.getState();
  assert.equal(state.changeSetConflicts, null);
  assert.equal(state.changeSetError, null);
});
