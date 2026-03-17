"use client";

import { useState, useEffect } from "react";
import { Plus, GitBranch, Trash2, Pencil, Play, Pause, Users } from "lucide-react";
import { useSequenceStore, type Sequence, type SequenceStatus } from "@/store/sequences";
import SequenceBuilder from "@/components/SequenceBuilder";
import clsx from "clsx";

const STATUS_STYLE: Record<SequenceStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-cream-deep", text: "text-ink-mid", label: "Draft" },
  active: { bg: "bg-sage-light", text: "text-sage", label: "Active" },
  paused: { bg: "bg-amber-light", text: "text-amber", label: "Paused" },
  completed: { bg: "bg-copper-light", text: "text-copper", label: "Completed" },
};

export default function SequencesPage() {
  const { sequences, loading, fetchSequences, deleteSequence, updateSequence } = useSequenceStore();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

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

  const toggleStatus = async (seq: Sequence) => {
    const next: SequenceStatus = seq.status === "active" ? "paused" : "active";
    await updateSequence(seq.id, { status: next });
  };

  return (
    <div className="mx-auto max-w-[1080px] px-10 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Sequences
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Build multi-step email sequences with dynamic templates.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Sequence
        </button>
      </div>

      {/* Grid */}
      {sequences.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sequences.map((seq, i) => {
            const ss = STATUS_STYLE[seq.status];
            return (
              <div
                key={seq.id}
                onClick={() => openEdit(seq)}
                className="animate-fade-up cursor-pointer rounded-[16px] border border-edge bg-surface p-5 shadow-xs transition-all duration-200 hover:border-edge-strong hover:shadow-sm"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                      {seq.name}
                    </p>
                    {seq.description && (
                      <p className="mt-1 text-[12px] text-ink-mid line-clamp-2">
                        {seq.description}
                      </p>
                    )}
                  </div>
                  <span className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ss.bg} ${ss.text}`}>
                    {ss.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-mid">
                    <GitBranch className="h-3 w-3 text-ink-light" />
                    {seq.stepCount ?? 0} step{(seq.stepCount ?? 0) !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-mid">
                    <Users className="h-3 w-3 text-ink-light" />
                    {seq.enrolledCount ?? 0} enrolled
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-1 border-t border-edge pt-3" onClick={(e) => e.stopPropagation()}>
                  {seq.status !== "completed" ? (
                    <button
                      onClick={() => toggleStatus(seq)}
                      title={seq.status === "active" ? "Pause" : "Activate"}
                      className={clsx(
                        "cursor-pointer rounded-[7px] p-[6px] transition-colors",
                        seq.status === "active"
                          ? "text-amber hover:bg-amber-light"
                          : "text-sage hover:bg-sage-light"
                      )}
                    >
                      {seq.status === "active" ? <Pause className="h-[15px] w-[15px]" /> : <Play className="h-[15px] w-[15px]" />}
                    </button>
                  ) : (
                    <span className="rounded-[7px] px-2 py-[6px] text-[11px] font-semibold text-copper">
                      Done
                    </span>
                  )}
                  <button
                    onClick={() => openEdit(seq)}
                    className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
                  >
                    <Pencil className="h-[15px] w-[15px]" />
                  </button>
                  <button
                    onClick={() => deleteSequence(seq.id)}
                    className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                  >
                    <Trash2 className="h-[15px] w-[15px]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-20">
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
      )}

      {/* Builder panel */}
      {builderOpen && (
        <SequenceBuilder
          sequence={editingSequence}
          isNew={isNew}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
