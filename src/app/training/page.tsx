"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  useTrainingStore,
  type TrainingConfig,
  getToneOption,
  completenessScore,
} from "@/store/training";
import TrainingEditorPanel from "@/components/TrainingEditorPanel";

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
    <div className="relative" style={{ width: size, height: size }}>
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TrainingConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

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

  return (
    <div className="mx-auto max-w-[1080px] px-10 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
              AI Training Center
            </h1>
          </div>
          <p className="mt-2 max-w-[520px] text-[14px] text-ink-mid">
            Create training profiles to teach the AI different writing styles.
            Assign them to sequences for targeted, personalised outreach.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New Training Profile
        </button>
      </div>

      {/* Grid */}
      {configs.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {configs.map((config, i) => {
            const toneOpt = getToneOption(config.tone);
            const score = completenessScore(config);
            const hasRules = config.dos.length + config.donts.length > 0;
            const hasExamples = config.exampleEmails.length > 0;
            const hasInstructions = config.customInstructions.trim().length > 0;

            return (
              <div
                key={config.id}
                onClick={() => openEdit(config)}
                className="group animate-fade-up cursor-pointer rounded-[16px] border border-edge bg-surface shadow-xs transition-all duration-200 hover:border-edge-strong hover:shadow-sm"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Card top */}
                <div className="p-5 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Tone badge */}
                      <div className="mb-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-cream px-2.5 py-[3px] text-[11px] font-semibold text-ink-mid">
                          {toneOpt.label}
                        </span>
                      </div>

                      <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                        {config.name || "Untitled"}
                      </p>
                      {config.description && (
                        <p className="mt-1 text-[12px] text-ink-mid line-clamp-2">
                          {config.description}
                        </p>
                      )}

                      {/* Sender context preview */}
                      {(config.senderName || config.companyName) && (
                        <p className="mt-2 text-[11px] text-ink-light">
                          {[config.senderName, config.senderTitle, config.companyName].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>

                    <CompletenessRing score={score} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-1.5 px-5 pt-3 pb-4">
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
                    <span className="text-[11px] text-ink-light italic">No rules configured yet</span>
                  )}
                </div>

                {/* Brand voice preview */}
                {config.brandVoice && (
                  <div className="border-t border-edge/60 px-5 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquareText className="h-3 w-3 text-ink-light" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">
                        Voice
                      </span>
                    </div>
                    <p className="text-[11px] leading-[1.5] text-ink-mid line-clamp-2 italic">
                      &ldquo;{config.brandVoice}&rdquo;
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div
                  className="flex items-center gap-1 border-t border-edge px-5 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEdit(config)}
                    className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
                    title="Edit"
                  >
                    <Pencil className="h-[15px] w-[15px]" />
                  </button>
                  <button
                    onClick={(e) => handleDuplicate(e, config)}
                    className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
                    title="Duplicate"
                  >
                    <Copy className="h-[15px] w-[15px]" />
                  </button>
                  <button
                    onClick={() => deleteConfig(config.id)}
                    className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                    title="Delete"
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
      )}

      {/* Editor panel */}
      {panelOpen && (
        <TrainingEditorPanel
          config={editingConfig}
          isNew={isNew}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
