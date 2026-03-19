"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  AlertTriangle,
  Sparkles,
  Search,
  Globe,
  RefreshCw,
  BrainCircuit,
} from "lucide-react";
import type { LeadPreview } from "@/app/api/sequences/preview-step/route";
import { extractDomain, clusterByDomain } from "@/lib/domain";
import { supabase } from "@/lib/supabase";

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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[6px] bg-ink/[0.06] ${className}`} />;
}

function EmailSkeleton({ hasResearch = false }: { hasResearch?: boolean }) {
  return (
    <div className="py-1">
      <div className="mb-5 flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-copper" />
        <p className="text-[13px] font-medium text-copper">
          {hasResearch ? "Generating email…" : "Researching lead & generating email…"}
        </p>
      </div>
      <div className="space-y-4">
        <SkeletonLine className="h-3 w-3/5" />
        <div className="space-y-2.5">
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-4/5" />
        </div>
        <div className="space-y-2.5 pt-1">
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-3/4" />
        </div>
        <div className="space-y-2.5 pt-1">
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-2/3" />
        </div>
        <SkeletonLine className="mt-2 h-3 w-1/3" />
      </div>
    </div>
  );
}

function ResearchSkeleton() {
  return (
    <div className="py-1">
      <div className="mb-5 flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-copper" />
        <p className="text-[13px] font-medium text-copper">Searching the web for lead & company info…</p>
      </div>
      <div className="space-y-5">
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <SkeletonLine className="h-5 w-1 !rounded-full" />
            <SkeletonLine className="h-4 w-40" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-3 w-4/5" />
          </div>
        </div>
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <SkeletonLine className="h-5 w-1 !rounded-full" />
            <SkeletonLine className="h-4 w-36" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-3 w-3/4" />
          </div>
        </div>
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <SkeletonLine className="h-5 w-1 !rounded-full" />
            <SkeletonLine className="h-4 w-32" />
          </div>
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[8px] border border-edge/60 bg-cream/40 px-3.5 py-2.5">
                <SkeletonLine className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  // Tracks leads with a pending AI draft awaiting accept/reject
  const [aiDrafts, setAiDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  // Tab switcher: email preview vs research
  const [contentTab, setContentTab] = useState<"email" | "research">("email");
  // Research overrides from AI rewrite (keyed by leadId)
  const [leadResearch, setLeadResearch] = useState<Record<string, string>>({});
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [trainingProfileName, setTrainingProfileName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: seq } = await supabase
        .from("sequences")
        .select("training_config_id")
        .eq("id", sequenceId)
        .single();
      if (cancelled || !seq?.training_config_id) return;
      const { data: config } = await supabase
        .from("ai_training_config")
        .select("name")
        .eq("id", seq.training_config_id)
        .single();
      if (!cancelled && config?.name) {
        setTrainingProfileName(config.name);
      }
    })();
    return () => { cancelled = true; };
  }, [sequenceId]);

  const current = previews[index];
  const approvedCount = Object.values(cardStates).filter((s) => s === "approved").length;
  const declinedCount = Object.values(cardStates).filter((s) => s === "declined").length;

  const orgClusters = useMemo(
    () => clusterByDomain(previews, (p) => p.email).filter((c) => !c.isFree),
    [previews],
  );
  const clusterDomains = useMemo(
    () => new Set(orgClusters.map((c) => c.domain)),
    [orgClusters],
  );

  const currentDomain = current ? extractDomain(current.email) : null;
  const currentCluster = currentDomain && clusterDomains.has(currentDomain)
    ? orgClusters.find((c) => c.domain === currentDomain)
    : null;
  const sameDomainPeers = currentCluster
    ? previews.filter(
        (p) => p.enrollmentId !== current?.enrollmentId && extractDomain(p.email) === currentDomain,
      )
    : [];
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
      setContentTab("email");
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [index, previews.length]
  );

  const goNext = useCallback(() => navigateTo(Math.min(index + 1, previews.length - 1)), [index, previews.length, navigateTo]);
  const goPrev = useCallback(() => navigateTo(Math.max(index - 1, 0)), [index, navigateTo]);

  const persistDraft = useCallback(
    (enrollmentId: string, subject: string, body: string, isHtml = false) => {
      fetch("/api/sequences/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, subject, body, isHtml }),
      }).catch(() => {});
    },
    [],
  );

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
    persistDraft(current.enrollmentId, draftSubject, draftBody, current.isHtml);
  }, [current, draftSubject, draftBody, persistDraft]);

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
    persistDraft(current.enrollmentId, current.subject, current.body, current.isHtml);
  }, [current, persistDraft]);

  const handleAiRewrite = useCallback(async () => {
    if (!current) return;
    const eid = current.enrollmentId;
    const hasResearch = !!(leadResearch[current.leadId] || current.research);
    setRewritingId(eid);

    try {
      const override = edits[eid];
      const res = await fetch("/api/sequences/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequenceId,
          leadId: current.leadId,
          leadName: current.leadName,
          email: current.email,
          company: current.company,
          currentSubject: override?.subject ?? current.subject,
          currentBody: override?.body ?? current.body,
          skipResearch: hasResearch,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors((prev) => ({
          ...prev,
          [eid]: data.error ?? "AI rewrite failed",
        }));
        setCardState(eid, "error");
        return;
      }

      const { subject, body, research } = await res.json();
      setAiDrafts((prev) => ({ ...prev, [eid]: { subject, body } }));
      if (research && current.leadId) {
        setLeadResearch((prev) => ({ ...prev, [current.leadId]: research }));
      }
      if (editingId === eid) setEditingId(null);
    } catch {
      setErrors((prev) => ({ ...prev, [eid]: "Network error during AI rewrite" }));
      setCardState(eid, "error");
    } finally {
      setRewritingId(null);
    }
  }, [current, edits, editingId, sequenceId, setCardState]);

  const handleRedoEmail = useCallback(async () => {
    if (!current) return;
    const eid = current.enrollmentId;
    setRewritingId(eid);

    try {
      const override = edits[eid];
      const res = await fetch("/api/sequences/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequenceId,
          leadId: current.leadId,
          leadName: current.leadName,
          email: current.email,
          company: current.company,
          currentSubject: override?.subject ?? current.subject,
          currentBody: override?.body ?? current.body,
          skipResearch: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors((prev) => ({ ...prev, [eid]: data.error ?? "AI regenerate failed" }));
        setCardState(eid, "error");
        return;
      }

      const { subject, body } = await res.json();
      setAiDrafts((prev) => ({ ...prev, [eid]: { subject, body } }));
      if (editingId === eid) setEditingId(null);
    } catch {
      setErrors((prev) => ({ ...prev, [eid]: "Network error during regeneration" }));
      setCardState(eid, "error");
    } finally {
      setRewritingId(null);
    }
  }, [current, edits, editingId, sequenceId, setCardState]);

  const handleRedoResearch = useCallback(async () => {
    if (!current) return;
    setResearchingId(current.enrollmentId);

    try {
      const res = await fetch("/api/sequences/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: current.leadId,
          leadName: current.leadName,
          email: current.email,
          company: current.company,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors((prev) => ({
          ...prev,
          [current.enrollmentId]: data.error ?? "Research failed",
        }));
        return;
      }

      const { research } = await res.json();
      if (research && current.leadId) {
        setLeadResearch((prev) => ({ ...prev, [current.leadId]: research }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        [current.enrollmentId]: "Network error during research",
      }));
    } finally {
      setResearchingId(null);
    }
  }, [current]);

  const acceptAiDraft = useCallback(() => {
    if (!current) return;
    const draft = aiDrafts[current.enrollmentId];
    if (!draft) return;
    setEdits((prev) => ({ ...prev, [current.enrollmentId]: draft }));
    setAiDrafts((prev) => {
      const next = { ...prev };
      delete next[current.enrollmentId];
      return next;
    });
    persistDraft(current.enrollmentId, draft.subject, draft.body, current.isHtml);
  }, [current, aiDrafts, persistDraft]);

  const rejectAiDraft = useCallback(() => {
    if (!current) return;
    setAiDrafts((prev) => {
      const next = { ...prev };
      delete next[current.enrollmentId];
      return next;
    });
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

  const keyboardRef = useRef({
    allDone,
    editingId,
    index,
    previews,
    aiDrafts,
    goPrev,
    goNext,
    handleApprove,
    handleDecline,
    handleAiRewrite,
    acceptAiDraft,
    rejectAiDraft,
    startEdit,
    cancelEdit,
  });
  keyboardRef.current = {
    allDone,
    editingId,
    index,
    previews,
    aiDrafts,
    goPrev,
    goNext,
    handleApprove,
    handleDecline,
    handleAiRewrite,
    acceptAiDraft,
    rejectAiDraft,
    startEdit,
    cancelEdit,
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const r = keyboardRef.current;
      if (r.allDone) return;
      const eid = r.previews[r.index]?.enrollmentId;
      const hasDraft = eid ? !!r.aiDrafts[eid] : false;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          r.goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          r.goNext();
          break;
        case "a":
        case "A":
          e.preventDefault();
          if (hasDraft) r.acceptAiDraft();
          else r.handleApprove();
          break;
        case "d":
        case "D":
          e.preventDefault();
          if (hasDraft) r.rejectAiDraft();
          else r.handleDecline();
          break;
        case "e":
        case "E":
          e.preventDefault();
          if (r.editingId) r.cancelEdit();
          else r.startEdit();
          break;
        case "g":
        case "G":
          e.preventDefault();
          r.handleAiRewrite();
          break;
        case "Escape":
          if (r.editingId) {
            e.preventDefault();
            r.cancelEdit();
          }
          break;
        case "?":
          setShowShortcuts((s) => !s);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentState = current ? (cardStates[current.enrollmentId] ?? "idle") : "idle";
  const isApproving = currentState === "approving";
  const currentAiDraft = current ? aiDrafts[current.enrollmentId] : null;
  const hasAiDraft = !!currentAiDraft;

  const currentEdit = current ? edits[current.enrollmentId] : null;
  const displaySubject = currentAiDraft?.subject ?? currentEdit?.subject ?? current?.subject ?? "";
  const displayBody = currentAiDraft?.body ?? currentEdit?.body ?? current?.body ?? "";
  const emailIsEmpty = !displaySubject.trim() && !displayBody.trim();
  const currentResearch = current
    ? (leadResearch[current.leadId] || current.research || "")
    : "";

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
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="truncate text-[10px] text-ink-light">{p.email}</p>
                      {(() => {
                        const d = extractDomain(p.email);
                        return d && clusterDomains.has(d) ? (
                          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-amber" title={`${orgClusters.find((c) => c.domain === d)?.count} contacts @${d}`} />
                        ) : null;
                      })()}
                    </div>
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
              <p><kbd className="rounded bg-cream px-1 py-0.5 font-mono text-[9px]">G</kbd> AI rewrite</p>
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
                <div className="shrink-0 ml-3 flex items-center gap-2">
                  <span className="rounded-full bg-cream-deep px-2.5 py-[4px] text-[11px] font-bold text-ink-mid md:hidden">
                    {index + 1}/{previews.length}
                  </span>
                  {trainingProfileName && (
                    <div className="flex items-center gap-1.5 rounded-[8px] bg-copper-light/40 px-2.5 py-1.5">
                      <BrainCircuit className="h-3.5 w-3.5 text-copper" />
                      <span className="text-[12px] font-semibold text-copper">{trainingProfileName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Same-domain warning */}
              {currentCluster && (
                <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-amber/30 bg-amber-light/20 px-3.5 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-amber">
                      {currentCluster.count} contacts at @{currentCluster.domain}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-[1.5] text-ink-mid">
                      Others in this batch:{" "}
                      {sameDomainPeers.map((p, i) => (
                        <span key={p.enrollmentId}>
                          {i > 0 && ", "}
                          <button
                            onClick={() => navigateTo(previews.indexOf(p))}
                            className="cursor-pointer font-medium text-copper hover:underline"
                          >
                            {p.leadName}
                          </button>
                          {cardStates[p.enrollmentId] === "approved" && (
                            <span className="ml-0.5 text-[10px] text-sage">(sent)</span>
                          )}
                        </span>
                      ))}
                      . Personalise each message to avoid appearing templated.
                    </p>
                  </div>
                </div>
              )}

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

              {/* AI draft review banner */}
              {hasAiDraft && (
                <div className="mb-4 rounded-[10px] border border-copper/30 bg-copper-light/20 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-copper" />
                      <span className="text-[13px] font-semibold text-copper">AI has rewritten this email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={rejectAiDraft}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-[8px] border border-edge px-3 py-1.5 text-[12px] font-semibold text-ink-mid transition-all hover:border-rose/30 hover:bg-rose-light hover:text-rose active:scale-[0.98]"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                      <button
                        onClick={handleRedoEmail}
                        disabled={rewritingId === current.enrollmentId}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-[8px] border border-edge px-3 py-1.5 text-[12px] font-semibold text-ink-mid transition-all hover:border-copper/30 hover:bg-copper-light hover:text-copper active:scale-[0.98] disabled:opacity-40"
                      >
                        {rewritingId === current.enrollmentId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Redo
                      </button>
                      <button
                        onClick={acceptAiDraft}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-[8px] bg-copper px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-copper-hover active:scale-[0.98]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-mid">Review the AI version below. Accept to use it, or reject to keep the original.</p>
                </div>
              )}

              {/* Content tabs */}
              <div className="mb-4 flex items-center gap-1 rounded-[10px] bg-cream-deep/60 p-1">
                <button
                  onClick={() => setContentTab("email")}
                  className={`cursor-pointer flex items-center gap-1.5 rounded-[8px] px-3.5 py-2 text-[12px] font-semibold transition-all ${
                    contentTab === "email"
                      ? "bg-surface text-ink shadow-xs"
                      : "text-ink-mid hover:text-ink"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>
                <button
                  onClick={() => setContentTab("research")}
                  className={`cursor-pointer flex items-center gap-1.5 rounded-[8px] px-3.5 py-2 text-[12px] font-semibold transition-all ${
                    contentTab === "research"
                      ? "bg-surface text-ink shadow-xs"
                      : "text-ink-mid hover:text-ink"
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                  Research
                  {currentResearch && (
                    <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  )}
                </button>
              </div>

              {contentTab === "research" ? (
                /* ── Research tab ── */
                <div className="rounded-[14px] border border-edge bg-surface shadow-xs overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-edge px-5 py-3">
                    <Globe className="h-4 w-4 shrink-0 text-ink-light" />
                    <p className="text-[14px] font-semibold text-ink flex-1">Research — {current.leadName}</p>
                    {currentResearch && (
                      <button
                        onClick={handleRedoResearch}
                        disabled={researchingId === current.enrollmentId}
                        title="Redo research"
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] border border-edge px-2.5 py-1.5 text-[11px] font-semibold text-ink-mid transition-all hover:border-copper/30 hover:bg-copper-light hover:text-copper disabled:opacity-40"
                      >
                        {researchingId === current.enrollmentId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {researchingId === current.enrollmentId ? "Searching..." : "Redo"}
                      </button>
                    )}
                  </div>
                  <div className="px-5 py-4 min-h-[180px]">
                    {researchingId === current.enrollmentId ? (
                      <ResearchSkeleton />
                    ) : currentResearch ? (
                      <div className="space-y-5">
                        {currentResearch.split(/\n(?=## )/).map((section, si) => {
                          const lines = section.split("\n");
                          const headingLine = lines[0]?.startsWith("## ") ? lines[0].replace(/^##\s*/, "") : null;
                          const bodyLines = headingLine ? lines.slice(1) : lines;
                          const bullets: string[] = [];
                          const paragraphs: string[] = [];

                          for (const line of bodyLines) {
                            const trimmed = line.trim();
                            if (!trimmed) continue;
                            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                              bullets.push(trimmed.replace(/^[-*]\s*/, ""));
                            } else {
                              paragraphs.push(trimmed);
                            }
                          }

                          return (
                            <div key={si}>
                              {headingLine && (
                                <div className="mb-2.5 flex items-center gap-2">
                                  <div className="h-5 w-1 rounded-full bg-copper" />
                                  <p className="text-[14px] font-bold text-ink">{headingLine}</p>
                                </div>
                              )}
                              {paragraphs.length > 0 && (
                                <p className="text-[13px] leading-[1.7] text-ink-mid mb-2.5">
                                  {paragraphs.join(" ")}
                                </p>
                              )}
                              {bullets.length > 0 && (
                                <div className="space-y-1.5">
                                  {bullets.map((bullet, bi) => (
                                    <div key={bi} className="flex gap-2.5 rounded-[8px] border border-edge/60 bg-cream/40 px-3.5 py-2.5">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-copper/60" />
                                      <p className="text-[12px] leading-[1.6] text-ink-mid">{bullet}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-deep">
                          <Search className="h-5 w-5 text-ink-light" />
                        </div>
                        <p className="mt-3 text-[13px] font-semibold text-ink">No research yet</p>
                        <p className="mt-1 max-w-[280px] text-[12px] text-ink-mid">
                          Research is gathered automatically when you generate or rewrite an email with AI.
                        </p>
                        <button
                          onClick={() => { setContentTab("email"); handleAiRewrite(); }}
                          disabled={rewritingId === current.enrollmentId || currentState === "approved" || currentState === "declined"}
                          className="mt-4 cursor-pointer inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-2.5 text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-40"
                        >
                          <Sparkles className="h-4 w-4" />
                          Generate with AI
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Email tab ── */
                <>
              {/* Email card */}
              <div className={`rounded-[14px] border bg-surface shadow-xs overflow-hidden transition-colors ${
                hasAiDraft ? "border-copper/40 ring-[3px] ring-copper/10" : editingId === current.enrollmentId ? "border-copper/40 ring-[3px] ring-copper/10" : "border-edge"
              }`}>
                {/* Subject bar */}
                <div className="flex items-center gap-3 border-b border-edge px-5 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-ink-light" />
                  {rewritingId === current.enrollmentId && editingId !== current.enrollmentId ? (
                    <SkeletonLine className="h-4 w-2/5 flex-1" />
                  ) : editingId === current.enrollmentId ? (
                    <input
                      autoFocus
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      placeholder="Subject…"
                      className="flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none placeholder:text-ink-faint"
                    />
                  ) : (
                    <p className="text-[14px] font-semibold text-ink flex-1 min-w-0 truncate">
                      {(currentAiDraft?.subject ?? edits[current.enrollmentId]?.subject ?? current.subject) || "(No subject)"}
                    </p>
                  )}
                  {/* Edit / Done / Reset / AI draft buttons */}
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {hasAiDraft ? (
                      <span className="rounded-full bg-copper-light px-2.5 py-[2px] text-[9px] font-bold uppercase text-copper flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI Draft
                      </span>
                    ) : editingId === current.enrollmentId ? (
                      <>
                        <button
                          onClick={handleAiRewrite}
                          disabled={rewritingId === current.enrollmentId}
                          title="AI rewrite (G)"
                          className="cursor-pointer rounded-[6px] p-1.5 text-ink-light transition-colors hover:bg-copper-light hover:text-copper disabled:opacity-40"
                        >
                          {rewritingId === current.enrollmentId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-copper" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </button>
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
                          onClick={handleAiRewrite}
                          disabled={currentState === "approved" || currentState === "declined" || rewritingId === current.enrollmentId}
                          title="AI rewrite (G)"
                          className="cursor-pointer rounded-[6px] p-1.5 text-ink-light transition-colors hover:bg-copper-light hover:text-copper disabled:opacity-30"
                        >
                          {rewritingId === current.enrollmentId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-copper" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </button>
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
                  {rewritingId === current.enrollmentId && editingId !== current.enrollmentId ? (
                    <EmailSkeleton hasResearch={!!(leadResearch[current.leadId] || current.research)} />
                  ) : editingId === current.enrollmentId ? (
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder="Email body…"
                      rows={10}
                      className="w-full resize-y bg-transparent text-[13px] leading-[1.7] text-ink-mid outline-none placeholder:text-ink-faint"
                    />
                  ) : emailIsEmpty && !hasAiDraft ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-copper-light">
                        <Sparkles className="h-5 w-5 text-copper" />
                      </div>
                      <p className="mt-3 text-[13px] font-semibold text-ink">No email content yet</p>
                      <p className="mt-1 max-w-[280px] text-[12px] text-ink-mid">
                        Use AI to generate a personalised email for this lead based on your training profile.
                      </p>
                      <button
                        onClick={handleAiRewrite}
                        disabled={rewritingId === current.enrollmentId || currentState === "approved" || currentState === "declined"}
                        className="mt-4 cursor-pointer inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-2.5 text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                      </button>
                    </div>
                  ) : hasAiDraft ? (
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-mid">
                      {currentAiDraft.body || "(No body)"}
                    </p>
                  ) : current.isHtml && !edits[current.enrollmentId] ? (
                    <HtmlPreview html={current.body} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-mid">
                      {(edits[current.enrollmentId]?.body ?? current.body) || "(No body)"}
                    </p>
                  )}
                </div>
              </div>
                </>
              )}

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
                {hasAiDraft ? (
                  <>
                    <button
                      onClick={rejectAiDraft}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-[10px] border border-edge px-4 py-2 text-[13px] font-semibold text-ink-mid transition-all active:scale-[0.98] hover:border-rose/30 hover:bg-rose-light hover:text-rose"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      onClick={handleRedoEmail}
                      disabled={rewritingId === current.enrollmentId}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-[10px] border border-edge px-4 py-2 text-[13px] font-semibold text-ink-mid transition-all active:scale-[0.98] hover:border-copper/30 hover:bg-copper-light hover:text-copper disabled:opacity-40"
                    >
                      {rewritingId === current.enrollmentId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Redo
                    </button>
                    <button
                      onClick={acceptAiDraft}
                      disabled={rewritingId === current.enrollmentId}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-[10px] bg-copper px-5 py-2 text-[13px] font-semibold text-white shadow-xs shadow-copper transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleAiRewrite}
                      disabled={isApproving || currentState === "approved" || currentState === "declined" || rewritingId === current.enrollmentId}
                      className={`cursor-pointer inline-flex items-center gap-1.5 rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
                        rewritingId === current.enrollmentId
                          ? "border-copper/30 bg-copper-light text-copper"
                          : "border-edge text-ink-mid hover:border-copper/30 hover:bg-copper-light hover:text-copper"
                      }`}
                    >
                      {rewritingId === current.enrollmentId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {rewritingId === current.enrollmentId
                        ? (emailIsEmpty ? "Generating..." : "Rewriting...")
                        : (emailIsEmpty ? "AI Generate" : "AI Rewrite")}
                    </button>

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
                      disabled={isApproving || currentState === "approved" || emailIsEmpty}
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
                  </>
                )}
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
