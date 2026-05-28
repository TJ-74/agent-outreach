"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Brain,
  Trash2,
  Pencil,
  Copy,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Sparkles,
  MessageSquareText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useTrainingStore,
  type TrainingConfig,
  getToneOption,
  completenessScore,
} from "@/store/training";
import TrainingEditorPanel from "@/components/TrainingEditorPanel";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import clsx from "clsx";

const TRAINING_PAGE_SIZE = 12;

function CompletenessRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "var(--color-sage)"
      : score >= 40
      ? "var(--color-amber)"
      : "var(--color-edge-strong)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-edge)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">
        {score}%
      </span>
    </div>
  );
}

function StatPill({
  icon: Icon,
  count,
  label,
  color,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
  color: "sage" | "rose" | "copper" | "ink-mid";
}) {
  const colorMap = {
    sage: "bg-sage-light/50 text-sage",
    rose: "bg-rose-light/50 text-rose",
    copper: "bg-copper-light text-copper",
    "ink-mid": "bg-cream-deep text-ink-mid",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold ${colorMap[color]}`}>
      <Icon className="h-2.5 w-2.5" />
      {count} {label}
    </span>
  );
}

export default function TrainingPage() {
  const { configs, loading, fetchConfigs, deleteConfig, duplicateConfig } =
    useTrainingStore();
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TrainingConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const totalPages = Math.max(1, Math.ceil(configs.length / TRAINING_PAGE_SIZE));
  const paginatedConfigs = useMemo(() => {
    const start = (page - 1) * TRAINING_PAGE_SIZE;
    return configs.slice(start, start + TRAINING_PAGE_SIZE);
  }, [configs, page]);
  const rangeStart = configs.length === 0 ? 0 : (page - 1) * TRAINING_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * TRAINING_PAGE_SIZE, configs.length);
  const completeCount = configs.filter((c) => completenessScore(c) >= 80).length;
  const totalExamples = configs.reduce((acc, c) => acc + c.exampleEmails.length, 0);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const openNew = () => {
    setEditingConfig(null);
    setIsNew(true);
    setPanelOpen(true);
  };

  const openEdit = (config: TrainingConfig) => {
    setEditingConfig(config);
    setIsNew(false);
    setPanelOpen(true);
  };

  const handleClose = () => {
    setPanelOpen(false);
    setEditingConfig(null);
    setIsNew(false);
    fetchConfigs();
  };

  const handleDuplicate = async (e: React.MouseEvent, config: TrainingConfig) => {
    e.stopPropagation();
    await duplicateConfig(config.id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteConfig(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  const renderConfigCard = (config: TrainingConfig, i: number, compact?: boolean) => {
    const toneOpt = getToneOption(config.tone);
    const score = completenessScore(config);
    const hasRules = config.dos.length + config.donts.length > 0;
    const hasExamples = config.exampleEmails.length > 0;
    const hasInstructions = config.customInstructions.trim().length > 0;

    return (
      <div
        key={config.id}
        onClick={() => openEdit(config)}
        className={clsx(
          "group animate-fade-up cursor-pointer rounded-[14px] border border-edge bg-surface shadow-xs transition-all duration-200 hover:border-edge-strong hover:shadow-sm",
          compact ? "p-4" : "p-5",
        )}
        style={{ animationDelay: `${i * 40}ms` }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-copper-light">
            <Brain className="h-5 w-5 text-copper" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-edge bg-cream px-2 py-[2px] text-[10px] font-semibold text-ink-mid">
                  {toneOpt.label}
                </span>
                <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                  {config.name || "Untitled"}
                </p>
                {config.description && (
                  <p className={clsx("mt-0.5 text-[12px] text-ink-mid", compact ? "line-clamp-1" : "line-clamp-2")}>
                    {config.description}
                  </p>
                )}
              </div>
              <CompletenessRing score={score} size={compact ? 40 : 44} />
            </div>

            {(config.senderName || config.companyName) && (
              <p className="mt-2 truncate text-[11px] text-ink-light">
                {[config.senderName, config.senderTitle, config.companyName].filter(Boolean).join(" · ")}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {config.dos.length > 0 && (
                <StatPill icon={ThumbsUp} count={config.dos.length} label="do's" color="sage" />
              )}
              {config.donts.length > 0 && (
                <StatPill icon={ThumbsDown} count={config.donts.length} label="don'ts" color="rose" />
              )}
              {hasExamples && (
                <StatPill icon={FileText} count={config.exampleEmails.length} label={config.exampleEmails.length === 1 ? "example" : "examples"} color="copper" />
              )}
              {hasInstructions && (
                <StatPill icon={Sparkles} count={1} label="instructions" color="ink-mid" />
              )}
              {!hasRules && !hasExamples && !hasInstructions && (
                <span className="text-[11px] italic text-ink-light">No rules configured yet</span>
              )}
            </div>
          </div>
        </div>

        {!compact && config.brandVoice && (
          <div className="mt-3 border-t border-edge/60 pt-3">
            <div className="mb-1 flex items-center gap-1.5">
              <MessageSquareText className="h-3 w-3 text-ink-light" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Voice</span>
            </div>
            <p className="line-clamp-2 text-[11px] italic leading-[1.5] text-ink-mid">
              &ldquo;{config.brandVoice}&rdquo;
            </p>
          </div>
        )}

        <div
          className="mt-3 flex items-center justify-end gap-1 border-t border-edge pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => openEdit(config)}
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
            aria-label="Edit profile"
          >
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={(e) => handleDuplicate(e, config)}
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
            aria-label="Duplicate profile"
          >
            <Copy className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={() => setDeleteTarget(config)}
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
            aria-label="Delete profile"
          >
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    );
  };

  if (loading && configs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading AI profiles…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
      {/* Header — title hidden on mobile since the top bar already shows "AI Training" */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden sm:block">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            AI Training Center
          </h1>
          <p className="mt-2 max-w-[520px] text-[14px] text-ink-mid">
            Create training profiles to teach the AI different writing styles.
            Assign them to sequences for targeted, personalised outreach.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] sm:w-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New Training Profile
        </button>
      </div>

      {/* Stats — compact on mobile */}
      {configs.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2.5 animate-fade-up sm:mb-6 sm:gap-4">
          <div className="rounded-[12px] border border-edge bg-surface px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-light sm:text-[10px]">Profiles</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-ink sm:text-[24px]">{configs.length}</p>
          </div>
          <div className="rounded-[12px] border border-sage/20 bg-sage-light/40 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-sage sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-sage/70 sm:text-[10px]">Complete</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-sage sm:text-[24px]">{completeCount}</p>
          </div>
          <div className="rounded-[12px] border border-copper/20 bg-copper-light/30 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-copper/70 sm:text-[10px]">Examples</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-copper sm:text-[24px]">{totalExamples}</p>
          </div>
        </div>
      )}

      {/* List / grid */}
      {configs.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {paginatedConfigs.map((config, i) => renderConfigCard(config, i, true))}
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
            {paginatedConfigs.map((config, i) => renderConfigCard(config, i))}
          </div>
        </>
      ) : null}

      {/* Pagination */}
      {configs.length > TRAINING_PAGE_SIZE && (
        <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[12px] text-ink-mid">
            Showing <span className="font-semibold text-ink">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-semibold text-ink">{configs.length}</span> profile{configs.length !== 1 ? "s" : ""}
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

      {configs.length === 0 ? (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface px-4 py-16 sm:py-20">
          <div className="rounded-[14px] bg-copper-light p-5">
            <Brain className="h-7 w-7 text-copper" strokeWidth={1.6} />
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
            No training profiles yet
          </h3>
          <p className="mt-1.5 max-w-[360px] text-center text-[13px] text-ink-mid">
            Create your first training profile to teach the AI how to write
            emails. Each profile can have a different voice, rules, and examples
            — then assign it to any sequence.
          </p>
          <button
            onClick={openNew}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create First Profile
          </button>
        </div>
      ) : null}

      {/* Editor panel */}
      {panelOpen && (
        <TrainingEditorPanel
          config={editingConfig}
          isNew={isNew}
          onClose={handleClose}
        />
      )}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete training profile?"
        description={`Delete "${deleteTarget?.name ?? "this profile"}"? This cannot be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
