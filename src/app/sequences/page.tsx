"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, GitBranch, Trash2, Pencil, Users, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useSequenceStore, type Sequence, type SequenceStatus } from "@/store/sequences";
import SequenceBuilder from "@/components/SequenceBuilder";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import clsx from "clsx";

const STATUS_STYLE: Record<SequenceStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-cream-deep", text: "text-ink-mid", label: "Draft" },
  active: { bg: "bg-sage-light", text: "text-sage", label: "Active" },
  paused: { bg: "bg-amber-light", text: "text-amber", label: "Paused" },
  completed: { bg: "bg-copper-light", text: "text-copper", label: "Completed" },
};

const SEQUENCES_PAGE_SIZE = 12;

export default function SequencesPage() {
  const { sequences, loading, fetchSequences, deleteSequence } = useSequenceStore();
  const [page, setPage] = useState(1);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sequence | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const totalPages = Math.max(1, Math.ceil(sequences.length / SEQUENCES_PAGE_SIZE));
  const paginatedSequences = useMemo(() => {
    const start = (page - 1) * SEQUENCES_PAGE_SIZE;
    return sequences.slice(start, start + SEQUENCES_PAGE_SIZE);
  }, [sequences, page]);
  const rangeStart = sequences.length === 0 ? 0 : (page - 1) * SEQUENCES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * SEQUENCES_PAGE_SIZE, sequences.length);
  const activeCount = sequences.filter((s) => s.status === "active").length;
  const totalEnrolled = sequences.reduce((acc, s) => acc + (s.enrolledCount ?? 0), 0);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const openNew = () => {
    setEditingSequence(null);
    setIsNew(true);
    setBuilderOpen(true);
  };

  const openEdit = (seq: Sequence) => {
    setEditingSequence(seq);
    setIsNew(false);
    setBuilderOpen(true);
  };

  const handleClose = () => {
    setBuilderOpen(false);
    setEditingSequence(null);
    setIsNew(false);
    fetchSequences();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteSequence(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading && sequences.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading sequences…</p>
      </div>
    );
  }

  const renderSequenceCard = (seq: Sequence, i: number, compact?: boolean) => {
    const ss = STATUS_STYLE[seq.status];
    return (
      <div
        key={seq.id}
        onClick={() => openEdit(seq)}
        className={clsx(
          "animate-fade-up cursor-pointer rounded-[14px] border border-edge bg-surface shadow-xs transition-all duration-200 hover:border-edge-strong hover:shadow-sm",
          compact ? "p-4" : "p-5",
        )}
        style={{ animationDelay: `${i * 40}ms` }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-copper-light">
            <GitBranch className="h-5 w-5 text-copper" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                {seq.name}
              </p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ss.bg} ${ss.text}`}>
                {ss.label}
              </span>
            </div>
            {seq.description && (
              <p className={clsx("mt-0.5 text-[12px] text-ink-mid", compact ? "line-clamp-1" : "line-clamp-2")}>
                {seq.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-mid">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 text-ink-light" />
                {seq.stepCount ?? 0} step{(seq.stepCount ?? 0) !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3 w-3 text-ink-light" />
                {seq.enrolledCount ?? 0} enrolled
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1 border-t border-edge pt-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(seq)}
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
            aria-label="Edit sequence"
          >
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={() => setDeleteTarget(seq)}
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
            aria-label="Delete sequence"
          >
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
      {/* Header — title hidden on mobile since the top bar already shows "Sequences" */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden sm:block">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Sequences
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Build multi-step email sequences with dynamic templates.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] sm:w-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Sequence
        </button>
      </div>

      {/* Stats — compact on mobile */}
      {sequences.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2.5 animate-fade-up sm:mb-6 sm:gap-4">
          <div className="rounded-[12px] border border-edge bg-surface px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <GitBranch className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-light sm:text-[10px]">Total</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-ink sm:text-[24px]">{sequences.length}</p>
          </div>
          <div className="rounded-[12px] border border-sage/20 bg-sage-light/40 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <GitBranch className="h-3 w-3 text-sage sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-sage/70 sm:text-[10px]">Active</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-sage sm:text-[24px]">{activeCount}</p>
          </div>
          <div className="rounded-[12px] border border-copper/20 bg-copper-light/30 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Users className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-copper/70 sm:text-[10px]">Enrolled</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-copper sm:text-[24px]">{totalEnrolled}</p>
          </div>
        </div>
      )}

      {/* List / grid */}
      {sequences.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {paginatedSequences.map((seq, i) => renderSequenceCard(seq, i, true))}
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
            {paginatedSequences.map((seq, i) => renderSequenceCard(seq, i))}
          </div>
        </>
      ) : null}

      {/* Pagination */}
      {sequences.length > SEQUENCES_PAGE_SIZE && (
        <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[12px] text-ink-mid">
            Showing <span className="font-semibold text-ink">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-semibold text-ink">{sequences.length}</span> sequence{sequences.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e${idx}`} className="px-1 text-[12px] text-ink-light">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    className={clsx(
                      "cursor-pointer rounded-[8px] px-2.5 py-[5px] text-[12px] font-semibold transition-colors",
                      page === item
                        ? "bg-copper text-white shadow-xs"
                        : "text-ink-mid hover:bg-cream hover:text-ink",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {sequences.length === 0 ? (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface px-4 py-16 sm:py-20">
          <div className="rounded-[14px] bg-copper-light p-5">
            <GitBranch className="h-7 w-7 text-copper" strokeWidth={1.6} />
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
            No sequences yet
          </h3>
          <p className="mt-1.5 max-w-[300px] text-center text-[13px] text-ink-mid">
            Create your first email sequence to automate outreach to leads.
          </p>
          <button
            onClick={openNew}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create First Sequence
          </button>
        </div>
      ) : null}

      {/* Builder panel */}
      {builderOpen && (
        <SequenceBuilder
          sequence={editingSequence}
          isNew={isNew}
          onClose={handleClose}
        />
      )}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete sequence?"
        description={`Delete "${deleteTarget?.name ?? "this sequence"}" and its steps/enrollments? This cannot be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
