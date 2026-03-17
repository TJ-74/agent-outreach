"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Check,
  XCircle,
  Loader2,
  Mail,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Send,
  User,
  Building2,
  Keyboard,
  PenLine,
  RotateCcw,
} from "lucide-react";
import type { LeadPreview } from "@/app/api/sequences/preview-step/route";

interface Props {
  sequenceId: string;
  sequenceName: string;
  previews: LeadPreview[];
  onClose: () => void;
  onSequenceCompleted?: () => void;
  standalone?: boolean;
}

function HtmlPreview({ html }: { html: string }) {
  return (
    <iframe
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full bg-white"
      style={{ border: "none", minHeight: 220 }}
      onLoad={(e) => {
        const iframe = e.currentTarget;
        const doc = iframe.contentDocument;
        if (doc) {
          iframe.style.height = Math.min(doc.documentElement.scrollHeight + 2, 520) + "px";
        }
      }}
    />
  );
}

type CardState = "idle" | "approving" | "approved" | "declined" | "error";

export default function SequenceApprovalPanel({
  sequenceId,
  sequenceName,
  previews,
  onClose,
  onSequenceCompleted,
  standalone = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sequenceDone, setSequenceDone] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Per-lead overrides (edited subject/body before sending)
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  // Which lead is currently in edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  // Draft values while editing
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const current = previews[index];
  const approvedCount = Object.values(cardStates).filter((s) => s === "approved").length;
  const declinedCount = Object.values(cardStates).filter((s) => s === "declined").length;
  const totalDone = approvedCount + declinedCount;
  const allDone = totalDone === previews.length;
  const progressPct = previews.length > 0 ? (totalDone / previews.length) * 100 : 0;

  const setCardState = (id: string, state: CardState) =>
    setCardStates((prev) => ({ ...prev, [id]: state }));

  const navigateTo = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= previews.length || newIndex === index) return;
      setAnimDir(newIndex > index ? "left" : "right");
      setIndex(newIndex);
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [index, previews.length]
  );

  const goNext = useCallback(() => navigateTo(Math.min(index + 1, previews.length - 1)), [index, previews.length, navigateTo]);
  const goPrev = useCallback(() => navigateTo(Math.max(index - 1, 0)), [index, navigateTo]);

  const startEdit = useCallback(() => {
    if (!current) return;
    const override = edits[current.enrollmentId];
    setDraftSubject(override?.subject ?? current.subject);
    setDraftBody(override?.body ?? current.body);
    setEditingId(current.enrollmentId);
  }, [current, edits]);

  const saveEdit = useCallback(() => {
    if (!current) return;
    setEdits((prev) => ({
      ...prev,
      [current.enrollmentId]: { subject: draftSubject, body: draftBody },
    }));
    setEditingId(null);
  }, [current, draftSubject, draftBody]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const resetEdit = useCallback(() => {
    if (!current) return;
    setEdits((prev) => {
      const next = { ...prev };
      delete next[current.enrollmentId];
      return next;
    });
    setEditingId(null);
  }, [current]);

  const handleApprove = useCallback(async () => {
    if (!current) return;
    const state = cardStates[current.enrollmentId];
    if (state === "approving" || state === "approved") return;
    // Exit edit mode silently before sending (save pending draft)
    if (editingId === current.enrollmentId) {
      setEdits((prev) => ({
        ...prev,
        [current.enrollmentId]: { subject: draftSubject, body: draftBody },
      }));
      setEditingId(null);
    }

    const override = edits[current.enrollmentId];
    const finalSubject = override?.subject ?? current.subject;
    const finalBody = override?.body ?? current.body;

    setCardState(current.enrollmentId, "approving");
    setErrors((prev) => ({ ...prev, [current.enrollmentId]: "" }));

    try {
      const res = await fetch("/api/sequences/approve-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: current.enrollmentId,
          leadId: current.leadId,
          sequenceId,
          subject: finalSubject,
          body: finalBody,
          isHtml: current.isHtml,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCardState(current.enrollmentId, "error");
        setErrors((prev) => ({
          ...prev,
          [current.enrollmentId]: data.error ?? "Failed to send",
        }));
        return;
      }

      setCardState(current.enrollmentId, "approved");
      if (data.sequenceCompleted) setSequenceDone(true);

      setTimeout(() => {
        if (index < previews.length - 1) goNext();
      }, 400);
    } catch {
      setCardState(current.enrollmentId, "error");
      setErrors((prev) => ({
        ...prev,
        [current.enrollmentId]: "Network error — please try again",
      }));
    }
  }, [current, cardStates, edits, editingId, draftSubject, draftBody, sequenceId, index, previews.length, goNext]);

  const handleDecline = useCallback(() => {
    if (!current) return;
    const state = cardStates[current.enrollmentId];
    if (state === "approving" || state === "declined") return;

    setCardState(current.enrollmentId, "declined");
    setTimeout(() => {
      if (index < previews.length - 1) goNext();
    }, 300);
  }, [current, cardStates, index, previews.length, goNext]);

  useEffect(() => {
    if (animDir) {
      const t = setTimeout(() => setAnimDir(null), 250);
      return () => clearTimeout(t);
    }
  }, [animDir]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (allDone) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
        case "a":
        case "A":
          e.preventDefault();
          handleApprove();
          break;
        case "d":
        case "D":
          e.preventDefault();
          handleDecline();
          break;
        case "e":
        case "E":
          e.preventDefault();
          if (editingId) cancelEdit(); else startEdit();
          break;
        case "Escape":
          if (editingId) { e.preventDefault(); cancelEdit(); }
          break;
        case "?":
          setShowShortcuts((s) => !s);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allDone, editingId, goPrev, goNext, handleApprove, handleDecline, startEdit, cancelEdit]);

  const currentState = current ? (cardStates[current.enrollmentId] ?? "idle") : "idle";
  const isApproving = currentState === "approving";

  const stateIcon = (enrollmentId: string) => {
    const s = cardStates[enrollmentId];
    if (s === "approved") return <Check className="h-3 w-3 text-white" />;
    if (s === "declined") return <XCircle className="h-3 w-3 text-white" />;
    if (s === "approving") return <Loader2 className="h-3 w-3 text-white animate-spin" />;
    return null;
  };

  const stateBg = (enrollmentId: string) => {
    const s = cardStates[enrollmentId];
    if (s === "approved") return "bg-sage";
    if (s === "declined") return "bg-rose/80";
    if (s === "approving") return "bg-copper";
    return "bg-ink-faint";
  };

  /* ─────────── Layout ─────────── */
  const panel = (
    <div
      className={
        standalone
          ? "flex h-screen w-full bg-cream"
          : "relative z-10 flex h-full max-h-[92vh] w-full max-w-[960px] rounded-[16px] bg-cream shadow-lg overflow-hidden mx-4 my-auto"
      }
    >
      {/* ── Left sidebar: lead list ── */}
      <div className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-edge bg-surface">
        {/* Sidebar header */}
        <div className="flex items-center gap-2 border-b border-edge px-4 py-3.5">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-[7px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{sequenceName}</p>
            <p className="text-[10px] text-ink-light">{previews.length} leads</p>
          </div>
        </div>

        {/* Progress ring */}
        <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
          <div className="relative h-9 w-9 shrink-0">
            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-edge)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--color-copper)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progressPct * 0.974} 100`}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-ink">
              {totalDone}/{previews.length}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <span className="text-sage">{approvedCount} sent</span>
              <span className="text-ink-faint">·</span>
              <span className="text-rose">{declinedCount} skipped</span>
            </div>
          </div>
        </div>

        {/* Lead list — grouped by state */}
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const pendingLeads = previews.filter(
              (p) => !cardStates[p.enrollmentId] || cardStates[p.enrollmentId] === "idle" || cardStates[p.enrollmentId] === "error"
            );
            const reviewedLeads = previews.filter(
              (p) => cardStates[p.enrollmentId] === "approved" || cardStates[p.enrollmentId] === "declined" || cardStates[p.enrollmentId] === "approving"
            );

            const renderRow = (p: LeadPreview, i: number) => {
              const globalIdx = previews.indexOf(p);
              const active = globalIdx === index;
              const state = cardStates[p.enrollmentId];
              return (
                <button
                  key={p.enrollmentId}
                  onClick={() => navigateTo(globalIdx)}
                  className={`cursor-pointer flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-all ${
                    active
                      ? "bg-copper-light/60 border-l-[3px] border-copper"
                      : "border-l-[3px] border-transparent hover:bg-cream/70"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${stateBg(p.enrollmentId)}`}>
                    {stateIcon(p.enrollmentId) ?? (
                      <span className="text-[10px] font-bold text-white">{globalIdx + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[12px] font-medium ${active ? "text-ink" : "text-ink-mid"}`}>
                      {p.leadName}
                    </p>
                    <p className="truncate text-[10px] text-ink-light">{p.email}</p>
                  </div>
                  {state === "approved" && (
                    <span className="shrink-0 text-[9px] font-bold text-sage uppercase">Sent</span>
                  )}
                  {state === "declined" && (
                    <span className="shrink-0 text-[9px] font-bold text-rose uppercase">Skip</span>
                  )}
                </button>
              );
            };

            return (
              <>
                {/* Pending group */}
                {pendingLeads.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber">
                        Pending
                      </span>
                      <span className="rounded-full bg-amber-light px-1.5 py-[1px] text-[9px] font-bold text-amber">
                        {pendingLeads.length}
                      </span>
                    </div>
                    {pendingLeads.map((p, i) => renderRow(p, i))}
                  </div>
                )}

                {/* Reviewed group */}
                {reviewedLeads.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-sage">
                        Reviewed
                      </span>
                      <span className="rounded-full bg-sage-light px-1.5 py-[1px] text-[9px] font-bold text-sage">
                        {reviewedLeads.length}
                      </span>
                    </div>
                    {reviewedLeads.map((p, i) => renderRow(p, i))}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Keyboard hint */}
        <div className="border-t border-edge px-4 py-2.5">
          <button
            onClick={() => setShowShortcuts((s) => !s)}
            className="cursor-pointer flex items-center gap-1.5 text-[10px] text-ink-light hover:text-ink-mid transition-colors"
          >
            <Keyboard className="h-3 w-3" />
            Keyboard shortcuts
          </button>
          {showShortcuts && (
            <div className="mt-2 space-y-1 text-[10px] text-ink-mid">
              <p><kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">A</kbd> Approve & send</p>
              <p><kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">D</kbd> Decline</p>
              <p><kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">E</kbd> Edit email</p>
              <p><kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">Esc</kbd> Cancel edit</p>
              <p><kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">&larr;</kbd> <kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">&rarr;</kbd> Navigate</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header (shown on small screens) */}
        <div className="flex md:hidden items-center justify-between border-b border-edge bg-surface px-4 py-3">
          <button onClick={onClose} className="cursor-pointer rounded-[7px] p-1.5 text-ink-light hover:bg-cream hover:text-ink-mid">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-ink">{sequenceName}</p>
            <p className="text-[10px] text-ink-light">{totalDone}/{previews.length} reviewed</p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-[7px] p-1.5 text-ink-light hover:bg-cream hover:text-ink-mid">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile progress bar */}
        <div className="md:hidden h-[3px] bg-cream-deep">
          <div className="h-full bg-copper transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {allDone ? (
            /* ── Completion screen ── */
            <div className="flex flex-col items-center justify-center px-8 py-20 text-center animate-scale-up">
              <div className="relative">
                <div className={`flex h-20 w-20 items-center justify-center rounded-[22px] shadow-md ${
                  sequenceDone ? "bg-sage" : "bg-copper"
                }`}>
                  <Check className="h-9 w-9 text-white" strokeWidth={2.5} />
                </div>
              </div>

              <p className="mt-6 font-[family-name:var(--font-display)] text-[20px] font-bold text-ink">
                {sequenceDone ? "Sequence complete!" : "All leads reviewed"}
              </p>
              <p className="mt-1.5 max-w-[340px] text-[13px] leading-[1.6] text-ink-mid">
                {sequenceDone
                  ? "Every lead has been processed — the sequence is marked as done."
                  : "You've reviewed all pending emails for this sequence."}
              </p>

              {/* Stats */}
              <div className="mt-6 flex items-center gap-4">
                <div className="flex items-center gap-1.5 rounded-full bg-sage-light px-3.5 py-1.5">
                  <Send className="h-3 w-3 text-sage" />
                  <span className="text-[12px] font-semibold text-sage">{approvedCount} sent</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-cream-deep px-3.5 py-1.5">
                  <XCircle className="h-3 w-3 text-ink-mid" />
                  <span className="text-[12px] font-semibold text-ink-mid">{declinedCount} skipped</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (sequenceDone) onSequenceCompleted?.();
                  onClose();
                }}
                className="mt-8 cursor-pointer rounded-[10px] bg-copper px-7 py-2.5 text-[13px] font-semibold text-white shadow-copper transition-all hover:bg-copper-hover active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          ) : current ? (
            /* ── Email preview ── */
            <div
              key={current.enrollmentId}
              className={`p-5 md:p-7 ${
                animDir === "left"
                  ? "animate-slide-in-left"
                  : animDir === "right"
                  ? "animate-slide-in-right"
                  : "animate-fade-up"
              }`}
            >
              {/* Recipient bar */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-copper-light">
                    <User className="h-4.5 w-4.5 text-copper" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">{current.leadName}</p>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-[12px] text-ink-mid">{current.email}</span>
                      {current.company && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-light">
                            <Building2 className="h-3 w-3" />
                            {current.company}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 ml-3 rounded-full bg-cream-deep px-2.5 py-[4px] text-[11px] font-bold text-ink-mid md:hidden">
                  {index + 1}/{previews.length}
                </span>
              </div>

              {/* Status badge if already reviewed */}
              {(currentState === "approved" || currentState === "declined") && (
                <div className={`mb-4 flex items-center gap-2 rounded-[10px] px-3.5 py-2 ${
                  currentState === "approved" ? "bg-sage-light" : "bg-rose-light"
                }`}>
                  {currentState === "approved" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-sage" />
                      <span className="text-[12px] font-semibold text-sage">Email sent successfully</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-rose" />
                      <span className="text-[12px] font-semibold text-rose">Declined — email not sent</span>
                    </>
                  )}
                </div>
              )}

              {/* Email card */}
              <div className={`rounded-[14px] border bg-surface shadow-xs overflow-hidden transition-colors ${
                editingId === current.enrollmentId ? "border-copper/40 ring-[3px] ring-copper/10" : "border-edge"
              }`}>
                {/* Subject bar */}
                <div className="flex items-center gap-3 border-b border-edge px-5 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-ink-light" />
                  {editingId === current.enrollmentId ? (
                    <input
                      autoFocus
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      placeholder="Subject…"
                      className="flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none placeholder:text-ink-faint"
                    />
                  ) : (
                    <p className="text-[14px] font-semibold text-ink flex-1 min-w-0 truncate">
                      {(edits[current.enrollmentId]?.subject ?? current.subject) || "(No subject)"}
                    </p>
                  )}
                  {/* Edit / Done / Reset buttons */}
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {editingId === current.enrollmentId ? (
                      <>
                        <button
                          onClick={resetEdit}
                          title="Reset to original"
                          className="cursor-pointer rounded-[6px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-amber"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="cursor-pointer rounded-[6px] px-2.5 py-1 text-[11px] font-semibold text-ink-mid transition-colors hover:bg-cream"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          className="cursor-pointer rounded-[6px] bg-copper px-2.5 py-1 text-[11px] font-semibold text-white transition-all hover:bg-copper-hover"
                        >
                          Done
                        </button>
                      </>
                    ) : (
                      <>
                        {edits[current.enrollmentId] && (
                          <span className="mr-1 rounded-full bg-amber-light px-2 py-[2px] text-[9px] font-bold uppercase text-amber">
                            Edited
                          </span>
                        )}
                        <button
                          onClick={startEdit}
                          disabled={currentState === "approved" || currentState === "declined"}
                          title="Edit email (E)"
                          className="cursor-pointer rounded-[6px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-copper disabled:opacity-30"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* To field */}
                <div className="flex items-center gap-2 border-b border-edge/60 px-5 py-2">
                  <span className="text-[11px] font-medium text-ink-light">To:</span>
                  <span className="rounded-full bg-cream px-2.5 py-[2px] text-[11px] font-medium text-ink-mid">
                    {current.email}
                  </span>
                </div>

                {/* Body */}
                <div className="px-5 py-4 min-h-[180px]">
                  {editingId === current.enrollmentId ? (
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder="Email body…"
                      rows={10}
                      className="w-full resize-y bg-transparent text-[13px] leading-[1.7] text-ink-mid outline-none placeholder:text-ink-faint"
                    />
                  ) : current.isHtml && !edits[current.enrollmentId] ? (
                    <HtmlPreview html={current.body} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-mid">
                      {(edits[current.enrollmentId]?.body ?? current.body) || "(No body)"}
                    </p>
                  )}
                </div>
              </div>

              {/* Error message */}
              {currentState === "error" && errors[current.enrollmentId] && (
                <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-rose-light px-4 py-2.5">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-rose" />
                  <p className="text-[12px] font-medium text-rose">{errors[current.enrollmentId]}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* ── Footer action bar ── */}
        {!allDone && current && (
          <div className="border-t border-edge bg-surface px-5 md:px-7 py-4">
            <div className="flex items-center justify-between">
              {/* Navigation */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={goPrev}
                  disabled={index === 0}
                  className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-[9px] border border-edge bg-surface text-ink-mid transition-all hover:bg-cream disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  disabled={index >= previews.length - 1}
                  className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-[9px] border border-edge bg-surface text-ink-mid transition-all hover:bg-cream disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="ml-2 hidden md:inline text-[11px] text-ink-light">
                  {totalDone} of {previews.length} reviewed
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleDecline}
                  disabled={isApproving || currentState === "declined"}
                  className={`cursor-pointer inline-flex items-center gap-1.5 rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
                    currentState === "declined"
                      ? "border-rose/30 bg-rose-light text-rose"
                      : "border-edge text-ink-mid hover:border-rose/30 hover:bg-rose-light hover:text-rose"
                  }`}
                >
                  <XCircle className="h-4 w-4" />
                  {currentState === "declined" ? "Declined" : "Decline"}
                </button>

                <button
                  onClick={handleApprove}
                  disabled={isApproving || currentState === "approved"}
                  className={`cursor-pointer inline-flex items-center gap-1.5 rounded-[10px] px-5 py-2 text-[13px] font-semibold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 ${
                    currentState === "approved"
                      ? "bg-sage text-white"
                      : "bg-copper text-white shadow-copper hover:bg-copper-hover"
                  }`}
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : currentState === "approved" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {currentState === "approved"
                    ? "Sent"
                    : isApproving
                    ? "Sending…"
                    : "Approve & Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (standalone) {
    return panel;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      {panel}
    </div>
  );
}
