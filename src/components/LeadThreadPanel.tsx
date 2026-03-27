"use client";

import React, { useState, useEffect, useRef, type FormEvent } from "react";
import {
  X,
  Send,
  Loader2,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Building2,
  Briefcase,
  Linkedin,
  StickyNote,
  RefreshCw,
  Brain,
  Sparkles,
  Clock,
  TrendingUp,
  Check,
  Trash2,
  PenLine,
  FileText,
  Search,
  Wrench,
  MessageCircle,
  Globe,
} from "lucide-react";
import { useLeadStore, type Lead } from "@/store/leads";
import { useOutlookStore } from "@/store/outlook";
import { useGoogleStore } from "@/store/google";
import { useDraftStore, type Draft } from "@/store/drafts";
import { supabase } from "@/lib/supabase";
import ActionBadge from "@/components/StatusBadge";

interface Message {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyHtml?: string;
  from: string;
  to?: string;
  date: string;
  isFromMe: boolean;
  status?: string;
}

interface ThreadGroup {
  subject: string;
  messages: Message[];
}

interface Props {
  lead: Lead;
  onClose: () => void;
}

function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const olMatch = document.cookie.match(/(?:^|;\s*)ol_uid=([^;]*)/);
  if (olMatch) return decodeURIComponent(olMatch[1]);
  const ggMatch = document.cookie.match(/(?:^|;\s*)gg_uid=([^;]*)/);
  return ggMatch ? decodeURIComponent(ggMatch[1]) : null;
}

function groupByThread(messages: Message[]): ThreadGroup[] {
  const map = new Map<string, Message[]>();
  for (const msg of messages) {
    const key = msg.subject.replace(/^(Re:\s*|Fwd:\s*)/gi, "").trim() || "(No subject)";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }
  const groups: ThreadGroup[] = [];
  for (const [subject, msgs] of map) {
    groups.push({ subject, messages: msgs });
  }
  groups.sort(
    (a, b) =>
      new Date(b.messages[b.messages.length - 1].date).getTime() -
      new Date(a.messages[a.messages.length - 1].date).getTime()
  );
  return groups;
}

function SimpleMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key++} className="my-2 space-y-1.5 pl-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-[1.65] text-ink-mid">
            <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-copper/50" />
            <span>{inlineParse(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const inlineParse = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let k = 0;
    while ((match = re.exec(str)) !== null) {
      if (match.index > last) parts.push(str.slice(last, match.index));
      parts.push(<strong key={k++} className="font-semibold text-ink">{match[1]}</strong>);
      last = re.lastIndex;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      flushBullets();
      elements.push(
        <h3 key={key++} className="mt-4 mb-1.5 flex items-center gap-2 text-[13px] font-bold text-ink first:mt-0">
          <span className="h-[3px] w-[3px] rounded-full bg-copper" />
          {inlineParse(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushBullets();
      elements.push(
        <h2 key={key++} className="mt-5 mb-2 text-[15px] font-bold text-ink first:mt-0">
          {inlineParse(trimmed.slice(2))}
        </h2>
      );
    } else if (/^[-*•]\s/.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(/^[-*•]\s+/, ""));
    } else if (trimmed === "") {
      flushBullets();
    } else {
      flushBullets();
      elements.push(
        <p key={key++} className="my-1.5 text-[13px] leading-[1.7] text-ink-mid">
          {inlineParse(trimmed)}
        </p>
      );
    }
  }
  flushBullets();

  return <div className={className}>{elements}</div>;
}

const SENTIMENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: "bg-sage-light", text: "text-sage", label: "Positive" },
  neutral: { bg: "bg-cream-deep", text: "text-ink-mid", label: "Neutral" },
  negative: { bg: "bg-rose-light", text: "text-rose", label: "Negative" },
  unknown: { bg: "bg-cream-deep", text: "text-ink-light", label: "Unknown" },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  send_email: "Send Email",
  follow_up: "Follow Up",
  schedule_meeting: "Schedule Meeting",
  wait: "Wait",
  close: "Close",
};

export default function LeadThreadPanel({ lead, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"conversation" | "insights" | "agent">("conversation");
  const [summaryMap, setSummaryMap] = useState<Record<string, string>>({});
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [streamPhase, setStreamPhase] = useState<"idle" | "planning" | "executing" | "summarizing" | "done">("idle");
  const [streamThinking, setStreamThinking] = useState("");
  const [streamSummary, setStreamSummary] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const updateLead = useLeadStore((s) => s.updateLead);
  const fetchLeads = useLeadStore((s) => s.fetchLeads);
  const isOutlookConnected = useOutlookStore((s) => s.isConnected);
  const isGoogleConnected = useGoogleStore((s) => s.isConnected);
  const isConnected = isOutlookConnected || isGoogleConnected;

  const { drafts, fetchDrafts, saveDraft, updateDraft, deleteDraft } = useDraftStore();

  const [draftThreadMap, setDraftThreadMap] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  const setDraftThread = (draftId: string, value: string) =>
    setDraftThreadMap((prev) => ({ ...prev, [draftId]: value }));

  useEffect(() => {
    fetchThread();
    fetchDrafts(lead.id);
    fetchStoredSummaries();
  }, [lead.email, lead.id, fetchDrafts]);

  useEffect(() => {
    if (scrollRef.current && activeTab === "conversation") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, drafts, activeTab]);

  const fetchThread = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/outlook/thread?email=${encodeURIComponent(lead.email)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load");
      }
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread");
    } finally {
      setLoading(false);
    }
  };

  const fetchStoredSummaries = async () => {
    try {
      const { data } = await supabase
        .from("messages")
        .select("outlook_message_id, summary")
        .eq("lead_id", lead.id)
        .neq("summary", "");
      if (!data?.length) return;
      const map: Record<string, string> = {};
      for (const row of data) {
        if (row.outlook_message_id && row.summary) {
          map[row.outlook_message_id] = row.summary;
        }
      }
      setSummaryMap(map);
    } catch {
      // silently ignore
    }
  };

  const handleAnalyze = async () => {
    const uid = getUserId();
    if (!uid) return;

    setAnalyzing(true);
    setPlanSteps([]);
    setStreamPhase("planning");
    setStreamThinking("");
    setStreamSummary("");
    setActiveTab("agent");

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (messages.length > 0) {
        await fetch(`/agent/sync-messages/${lead.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": uid },
          body: JSON.stringify(messages),
          signal: controller.signal,
        });
      }

      const res = await fetch(`/api/agent/analyze-stream/${lead.id}`, {
        method: "POST",
        headers: { "X-User-Id": uid },
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Analysis failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed) as Record<string, unknown>;
            const type = msg.type as string;

            if (type === "plan") {
              const rawSteps = (msg.steps as { index: number; tool: string; description: string }[]) ?? [];
              const steps: PlanStep[] = rawSteps.map((s, i) => ({
                index: s.index,
                tool: s.tool,
                description: s.description,
                // First step starts running immediately (H3 fix: client-side prediction)
                status: i === 0 ? "running" : ("pending" as const),
              }));
              setPlanSteps(steps);
              setStreamPhase("executing");
            } else if (type === "step_complete") {
              const idx = msg.index as number;
              setPlanSteps((prev) => {
                const updated = prev.map((s) =>
                  s.index === idx
                    ? { ...s, status: "complete" as const, output: msg.output as string }
                    : s
                );
                // Mark next step as running (client-side prediction)
                const nextIdx = idx + 1;
                return updated.map((s) =>
                  s.index === nextIdx && s.status === "pending"
                    ? { ...s, status: "running" as const }
                    : s
                );
              });
            } else if (type === "response") {
              setStreamPhase("summarizing");
              setStreamSummary((msg.content as string) ?? "");
            } else if (type === "error") {
              setPlanSteps((prev) =>
                prev.map((s) => (s.status === "running" ? { ...s, status: "error" as const, output: msg.message as string } : s))
              );
            } else if (type === "done") {
              setStreamPhase("done");
              await fetchLeads();
              fetchStoredSummaries();
            }
          } catch {
            // malformed JSON line — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        alert(err instanceof Error ? err.message : "Analysis failed");
      }
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  };

  const handleGenerateEmail = async () => {
    const uid = getUserId();
    if (!uid) return;

    setGenerating(true);
    try {
      const res = await fetch(`/agent/suggest-email/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": uid },
        body: JSON.stringify({
          purpose: messages.length > 0 ? "follow up" : "initial outreach",
          tone: "professional and friendly",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to generate");
      }

      const data = await res.json();
      await saveDraft(lead.id, data.subject || "", data.body || "");
      setActiveTab("conversation");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveDraft = async (draft: Draft, replyToMessageId?: string) => {
    if (!isConnected) {
      alert("Connect Outlook or Google first to send emails.");
      return;
    }

    setSending(true);
    try {
      let res: Response;

      if (replyToMessageId && isOutlookConnected) {
        res = await fetch("/api/outlook/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: replyToMessageId, body: draft.body }),
        });
      } else {
        res = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lead.email,
            subject: replyToMessageId ? `Re: ${draft.subject}` : draft.subject,
            body: draft.body,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      await deleteDraft(draft.id);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          subject: replyToMessageId ? `Re: ${draft.subject}` : draft.subject,
          bodyPreview: draft.body,
          from: "me",
          date: new Date().toISOString(),
          isFromMe: true,
        },
      ]);

      await updateLead(lead.id, { status: "contacted", actionNeeded: "waiting_for_reply" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleDeclineDraft = async (draftId: string) => {
    await deleteDraft(draftId);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setSendError("Subject and message are required");
      return;
    }

    setSending(true);
    setSendError("");

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: lead.email, subject, body }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          subject,
          bodyPreview: body,
          from: "me",
          date: new Date().toISOString(),
          isFromMe: true,
        },
      ]);

      await updateLead(lead.id, { status: "contacted", actionNeeded: "waiting_for_reply" });
      setSubject("");
      setBody("");
      setComposeOpen(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const threads = groupByThread(messages);
  const sentimentStyle = SENTIMENT_STYLE[lead.sentiment] ?? SENTIMENT_STYLE.unknown;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-[760px] flex-col bg-surface shadow-lg animate-slide-in">
        {/* Header */}
        <div className="border-b border-edge px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-copper-light font-[family-name:var(--font-display)] text-[16px] font-bold text-copper">
                {lead.firstName[0]}{lead.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.02em] text-ink">
                    {lead.firstName} {lead.lastName}
                  </h2>
                  <ActionBadge action={lead.actionNeeded} />
                </div>
                <p className="mt-0.5 text-[13px] text-ink-mid">{lead.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] border border-edge px-3 py-1.5 text-[11px] font-semibold text-ink-mid transition-all hover:border-copper hover:bg-copper-light hover:text-copper disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                Analyze
              </button>
              <button
                onClick={handleGenerateEmail}
                disabled={generating}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] border border-edge px-3 py-1.5 text-[11px] font-semibold text-ink-mid transition-all hover:border-copper hover:bg-copper-light hover:text-copper disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Draft
              </button>
              <button onClick={fetchThread} className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {lead.company && (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-mid">
                <Building2 className="h-3 w-3 text-ink-light" />{lead.company}
              </span>
            )}
            {lead.jobTitle && (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-mid">
                <Briefcase className="h-3 w-3 text-ink-light" />{lead.jobTitle}
              </span>
            )}
            {lead.linkedIn && (
              <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-copper hover:underline">
                <Linkedin className="h-3 w-3" />LinkedIn
              </a>
            )}
            {lead.notes && (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-mid">
                <StickyNote className="h-3 w-3 text-ink-light" />{lead.notes.length > 60 ? lead.notes.slice(0, 60) + "..." : lead.notes}
              </span>
            )}
          </div>

          <div className="mt-5 flex gap-1 rounded-[8px] border border-edge bg-cream p-[3px]">
            <button
              onClick={() => setActiveTab("conversation")}
              className={`cursor-pointer flex-1 rounded-[6px] py-[6px] text-[12px] font-semibold transition-all ${activeTab === "conversation" ? "bg-surface text-ink shadow-xs" : "text-ink-mid hover:text-ink"}`}
            >
              Conversation {drafts.length > 0 && <span className="ml-1 rounded-full bg-amber-light px-1.5 text-[10px] text-amber">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</span>}
            </button>
            <button
              onClick={() => setActiveTab("insights")}
              className={`cursor-pointer flex-1 rounded-[6px] py-[6px] text-[12px] font-semibold transition-all ${activeTab === "insights" ? "bg-surface text-ink shadow-xs" : "text-ink-mid hover:text-ink"}`}
            >
              AI Insights
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={`cursor-pointer flex-1 rounded-[6px] py-[6px] text-[12px] font-semibold transition-all ${activeTab === "agent" ? "bg-surface text-ink shadow-xs" : "text-ink-mid hover:text-ink"}`}
            >
              Agent
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === "conversation" ? (
            <ConversationWithDrafts
              loading={loading}
              error={error}
              messages={messages}
              threads={threads}
              leadName={lead.firstName}
              onRetry={fetchThread}
              drafts={drafts}
              sending={sending}
              draftThreadMap={draftThreadMap}
              summaryMap={summaryMap}
              onSelectThread={setDraftThread}
              onApprove={(draft, replyMsgId) => handleApproveDraft(draft, replyMsgId)}
              onDecline={(draftId) => handleDeclineDraft(draftId)}
              onUpdateDraft={updateDraft}
            />
          ) : activeTab === "insights" ? (
            <InsightsView
              lead={lead}
              sentimentStyle={sentimentStyle}
              insightsOpen={insightsOpen}
              setInsightsOpen={setInsightsOpen}
            />
          ) : (
            <AgentView
              lead={lead}
              planSteps={planSteps}
              streamPhase={streamPhase}
              thinking={streamThinking}
              summary={streamSummary}
            />
          )}
        </div>

        {/* Compose */}
        {isConnected && activeTab === "conversation" && (
          <div className="border-t border-edge bg-cream/50 px-8 py-5">
            {!composeOpen ? (
              <button
                onClick={() => setComposeOpen(true)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-dashed border-edge-strong px-5 py-3.5 text-[13px] text-ink-mid transition-all hover:border-copper hover:bg-surface hover:text-ink"
              >
                <Send className="h-4 w-4 text-ink-light" />
                Write a new message...
              </button>
            ) : (
              <form onSubmit={handleSend} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-mid">New Message</p>
                  <button type="button" onClick={() => setComposeOpen(false)} className="cursor-pointer text-[11px] font-medium text-ink-light hover:text-ink-mid">Collapse</button>
                </div>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-[10px] border border-edge bg-surface px-4 py-[10px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message..." rows={4} className="w-full resize-none rounded-[10px] border border-edge bg-surface px-4 py-3 text-[13px] leading-[1.6] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                {sendError && <p className="text-[11px] text-rose">{sendError}</p>}
                <div className="flex justify-end">
                  <button type="submit" disabled={sending} className="cursor-pointer inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-[9px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] disabled:opacity-50">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {!isConnected && activeTab === "conversation" && (
          <div className="border-t border-edge px-8 py-5">
            <div className="flex items-center gap-3 rounded-[10px] bg-cream px-5 py-3.5">
              <Mail className="h-4 w-4 text-ink-light" />
              <p className="text-[13px] text-ink-mid">
                <a href="/settings" className="font-medium text-copper hover:underline">Connect Outlook or Google</a> to send and view messages.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Conversation With Drafts ────────────────────────────────

function ConversationWithDrafts({
  loading,
  error,
  messages,
  threads,
  leadName,
  onRetry,
  drafts,
  sending,
  draftThreadMap,
  summaryMap,
  onSelectThread,
  onApprove,
  onDecline,
  onUpdateDraft,
}: {
  loading: boolean;
  error: string;
  messages: Message[];
  threads: ThreadGroup[];
  leadName: string;
  onRetry: () => void;
  drafts: Draft[];
  sending: boolean;
  draftThreadMap: Record<string, string>;
  summaryMap: Record<string, string>;
  onSelectThread: (draftId: string, value: string) => void;
  onApprove: (draft: Draft, replyMsgId?: string) => void;
  onDecline: (draftId: string) => void;
  onUpdateDraft: (id: string, subject: string, body: string) => Promise<void>;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-ink-light" />
        <p className="mt-3 text-[13px] text-ink-mid">Loading conversation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[13px] text-rose">{error}</p>
        <button onClick={onRetry} className="mt-3 cursor-pointer text-[12px] font-medium text-copper hover:underline">Try again</button>
      </div>
    );
  }

  const getDraftTarget = (draft: Draft) =>
    draftThreadMap[draft.id] ?? draft.replyToMessageId ?? "__new__";

  const threadDraftMap = new Map<string, Draft[]>();
  const standaloneDrafts: Draft[] = [];

  for (const draft of drafts) {
    const target = getDraftTarget(draft);
    if (target === "__new__") {
      standaloneDrafts.push(draft);
    } else {
      const thread = threads.find((t) => t.messages.some((m) => m.id === target));
      if (thread) {
        const key = thread.subject;
        if (!threadDraftMap.has(key)) threadDraftMap.set(key, []);
        threadDraftMap.get(key)!.push(draft);
      } else {
        standaloneDrafts.push(draft);
      }
    }
  }

  const buildDraftCard = (draft: Draft) => {
    const target = getDraftTarget(draft);
    const isNewThread = target === "__new__";
    return (
      <DraftInlineCard
        key={draft.id}
        draft={draft}
        isNewThread={isNewThread}
        replyToMessageId={isNewThread ? undefined : target}
        sending={sending}
        onApprove={(replyMsgId) => onApprove(draft, replyMsgId)}
        onDecline={() => onDecline(draft.id)}
        onUpdate={onUpdateDraft}
      />
    );
  };

  const handleThreadRadioClick = (threadLastMsgId: string) => {
    const candidate = standaloneDrafts[0] ?? drafts[0];
    if (!candidate) return;
    onSelectThread(candidate.id, threadLastMsgId);
  };

  const handleUnassignDraft = (draftId: string) => {
    onSelectThread(draftId, "__new__");
  };

  if (messages.length === 0 && standaloneDrafts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-[14px] bg-cream-deep p-5">
            <MessageSquare className="h-7 w-7 text-ink-light" />
          </div>
          <p className="mt-5 font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">No messages yet</p>
          <p className="mt-1 text-[13px] text-ink-mid">Start the conversation below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {standaloneDrafts.map(buildDraftCard)}
      {threads.map((thread) => {
        const lastMsgId = thread.messages[thread.messages.length - 1].id;
        const assigned = threadDraftMap.get(thread.subject);
        const hasAssigned = assigned && assigned.length > 0;
        return (
          <ThreadSection
            key={thread.subject}
            thread={thread}
            leadName={leadName}
            assignedDrafts={assigned}
            buildDraftCard={buildDraftCard}
            showRadio={drafts.length > 0}
            radioSelected={!!hasAssigned}
            summaryMap={summaryMap}
            onRadioClick={
              hasAssigned
                ? () => handleUnassignDraft(assigned[0].id)
                : () => handleThreadRadioClick(lastMsgId)
            }
            radioDisabled={!hasAssigned && drafts.length === 0}
          />
        );
      })}
    </div>
  );
}


// ─── Draft Inline Card ──────────────────────────────────────

function DraftInlineCard({
  draft,
  isNewThread,
  replyToMessageId,
  sending,
  onApprove,
  onDecline,
  onUpdate,
}: {
  draft: Draft;
  isNewThread: boolean;
  replyToMessageId?: string;
  sending: boolean;
  onApprove: (replyToMessageId?: string) => void;
  onDecline: () => void;
  onUpdate: (id: string, subject: string, body: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [editBody, setEditBody] = useState(draft.body);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(draft.id, editSubject, editBody);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setEditing(false);
  };

  return (
    <div className="rounded-[12px] border-2 border-dashed border-amber/40 bg-amber-light/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-amber" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber">AI Draft</span>
          {!isNewThread && (
            <span className="rounded-full bg-copper-light px-1.5 py-[1px] text-[9px] font-semibold text-copper">Reply</span>
          )}
          <span className="text-[10px] text-ink-light">
            {new Date(draft.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-surface hover:text-ink-mid">
            <PenLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="border-t border-amber/20 px-4 py-3.5">
        {editing ? (
          <div className="space-y-2.5">
            {isNewThread && (
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-[8px] border border-edge bg-surface px-3 py-[7px] text-[13px] font-semibold text-ink outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light"
              />
            )}
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-[8px] border border-edge bg-surface px-3 py-2.5 text-[13px] leading-[1.65] text-ink-mid outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={handleCancel} className="cursor-pointer rounded-[8px] px-3 py-[5px] text-[12px] font-medium text-ink-mid hover:bg-cream">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-charcoal px-3.5 py-[5px] text-[12px] font-semibold text-white transition-all hover:bg-charcoal-light disabled:opacity-50">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {isNewThread && <p className="mb-1 text-[13px] font-semibold text-ink">{draft.subject}</p>}
            <p className="text-[13px] leading-[1.65] text-ink-mid whitespace-pre-wrap">{draft.body}</p>
          </>
        )}
      </div>

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-2 border-t border-amber/20 px-4 py-3">
          <button
            onClick={() => onApprove(replyToMessageId)}
            disabled={sending}
            className="cursor-pointer inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-sage px-4 py-[8px] text-[12px] font-semibold text-white transition-all hover:bg-sage/90 active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isNewThread ? "Approve & Send" : "Approve & Reply"}
          </button>
          <button
            onClick={onDecline}
            className="cursor-pointer inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-edge px-4 py-[8px] text-[12px] font-semibold text-ink-mid transition-all hover:border-rose hover:bg-rose-light hover:text-rose active:scale-[0.98]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Decline
          </button>
        </div>
      )}
    </div>
  );
}


// ─── Insights View ───────────────────────────────────────────

function InsightsView({
  lead,
  sentimentStyle,
  insightsOpen,
  setInsightsOpen,
}: {
  lead: Lead;
  sentimentStyle: { bg: string; text: string; label: string };
  insightsOpen: boolean;
  setInsightsOpen: (v: boolean) => void;
}) {
  if (!lead.aiSummary) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="rounded-[14px] bg-cream-deep p-5">
          <Brain className="h-7 w-7 text-ink-light" />
        </div>
        <p className="mt-5 font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">No analysis yet</p>
        <p className="mt-1 text-center text-[13px] text-ink-mid">Click &quot;Analyze&quot; to get AI-powered insights for this lead</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-edge bg-surface shadow-xs">
        <button onClick={() => setInsightsOpen(!insightsOpen)} className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-cream/40">
          {insightsOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-light" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-light" />}
          <Brain className="h-4 w-4 text-copper" />
          <span className="text-[13px] font-semibold text-ink">AI Analysis</span>
        </button>
        {insightsOpen && (
          <div className="border-t border-edge px-5 py-5 space-y-5">
            {lead.aiSummary && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Conversation Summary</p>
                <p className="text-[13px] leading-[1.65] text-ink-mid">{lead.aiSummary}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[10px] border border-edge p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Sentiment</p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${sentimentStyle.bg} ${sentimentStyle.text}`}>{sentimentStyle.label}</span>
              </div>
              <div className="rounded-[10px] border border-edge p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Engagement</p>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-bold text-ink">{lead.engagementScore}</span>
                  <span className="text-[11px] text-ink-light">/100</span>
                </div>
                <div className="mt-1.5 h-[4px] w-full rounded-full bg-cream-deep">
                  <div className="h-full rounded-full bg-copper transition-all" style={{ width: `${lead.engagementScore}%` }} />
                </div>
              </div>
              <div className="rounded-[10px] border border-edge p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Action</p>
                <ActionBadge action={lead.actionNeeded} />
              </div>
            </div>
            {lead.nextAction && (
              <div className="rounded-[10px] border border-copper-muted bg-copper-light/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-copper" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-copper">Recommended Action</p>
                  {lead.nextActionType && <span className="rounded-full bg-copper/10 px-2 py-0.5 text-[10px] font-semibold text-copper">{ACTION_TYPE_LABELS[lead.nextActionType] ?? lead.nextActionType}</span>}
                </div>
                <p className="text-[13px] leading-[1.6] text-ink">{lead.nextAction}</p>
                {lead.nextActionAt && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-mid">
                    <Clock className="h-3 w-3" />
                    {new Date(lead.nextActionAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Agent View ─────────────────────────────────────────────

interface PlanStep {
  index: number;
  tool: string;
  description: string;
  status: "pending" | "running" | "complete" | "error";
  output?: string;
}

interface AgentLog {
  id: string;
  task_type: string;
  steps: { index: number; tool: string; description: string; output: string }[];
  duration_ms: number;
  created_at: string;
}

type StreamPhase = "idle" | "planning" | "executing" | "summarizing" | "done";

const TOOL_ICONS: Record<string, React.ReactNode> = {
  get_lead_profile: <Briefcase className="h-3.5 w-3.5" />,
  get_conversation: <MessageSquare className="h-3.5 w-3.5" />,
  search_web: <Globe className="h-3.5 w-3.5" />,
  summarize_messages: <FileText className="h-3.5 w-3.5" />,
  analyze_engagement: <Brain className="h-3.5 w-3.5" />,
  draft_email: <PenLine className="h-3.5 w-3.5" />,
  update_lead: <Wrench className="h-3.5 w-3.5" />,
  _response: <MessageCircle className="h-3.5 w-3.5" />,
};

const TOOL_LABELS: Record<string, string> = {
  get_lead_profile: "Fetch Lead Profile",
  get_conversation: "Load Conversation",
  search_web: "Web Research",
  summarize_messages: "Summarize Messages",
  analyze_engagement: "Analyze Engagement",
  draft_email: "Draft Email",
  update_lead: "Update Lead",
  _response: "Agent Response",
};

const TASK_LABELS: Record<string, string> = {
  analyze: "Lead Analysis",
  draft_email: "Email Draft",
  summarize: "Message Summarization",
};

function StepNode({
  step,
  isLast,
  expanded,
  onToggle,
}: {
  step: PlanStep;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isPending = step.status === "pending";
  const isRunning = step.status === "running";
  const isComplete = step.status === "complete";
  const isError = step.status === "error";

  return (
    <div className="relative flex gap-0">
      {/* Vertical line + circle */}
      <div className="flex flex-col items-center" style={{ width: 28 }}>
        <div
          className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
            isRunning
              ? "border-copper bg-copper text-white shadow-md shadow-copper/30"
              : isComplete
                ? "border-sage bg-sage text-white"
                : isError
                  ? "border-rose bg-rose-light text-rose"
                  : "border-edge bg-cream text-ink-light"
          }`}
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isComplete ? (
            <Check className="h-3 w-3" />
          ) : isError ? (
            <X className="h-3 w-3" />
          ) : (
            <span className="text-[9px] font-bold">{step.index + 1}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={`w-[2px] flex-1 transition-colors duration-300 ${
              isComplete ? "bg-sage/40" : "bg-edge"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`ml-3 flex-1 pb-5 ${isLast ? "pb-0" : ""}`}>
        <button
          onClick={onToggle}
          className={`flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-left transition-all ${
            isRunning
              ? "bg-copper-light/30 shadow-sm"
              : isComplete && expanded
                ? "bg-cream/60"
                : "hover:bg-cream/40"
          }`}
        >
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
            isRunning ? "bg-copper/10 text-copper" : isComplete ? "bg-sage/10 text-sage" : "bg-edge/40 text-ink-light"
          }`}>
            {TOOL_ICONS[step.tool] ?? <Wrench className="h-3 w-3" />}
          </span>
          <div className="flex-1 min-w-0">
            <span className={`text-[11px] font-semibold ${isPending ? "text-ink-light" : "text-ink"}`}>
              {step.description || TOOL_LABELS[step.tool] || step.tool}
            </span>
          </div>
          {isRunning && (
            <span className="shrink-0 rounded-full bg-copper/10 px-2 py-0.5 text-[9px] font-semibold text-copper animate-pulse">
              Running
            </span>
          )}
          {isComplete && step.output && (
            expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-ink-light" /> : <ChevronRight className="h-3 w-3 shrink-0 text-ink-light" />
          )}
        </button>

        {/* Expanded output */}
        {expanded && step.output && (
          <div className="mt-1.5 ml-1 rounded-[8px] border border-edge/50 bg-cream-deep/40 px-3 py-2.5 max-h-[200px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
            <SimpleMarkdown text={step.output} className="text-[11px]" />
          </div>
        )}
      </div>
    </div>
  );
}

function AgentView({
  lead,
  planSteps,
  streamPhase,
  thinking,
  summary,
}: {
  lead: Lead;
  planSteps: PlanStep[];
  streamPhase: StreamPhase;
  thinking: string;
  summary: string;
}) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [expandedLogSteps, setExpandedLogSteps] = useState<Set<string>>(new Set());
  const activeRef = useRef<HTMLDivElement>(null);

  const isActive = streamPhase !== "idle" && streamPhase !== "done";
  const showLive = streamPhase !== "idle";

  useEffect(() => {
    if (streamPhase === "idle" || streamPhase === "done") {
      const uid = getUserId();
      if (!uid) return;
      setLoadingLogs(true);
      fetch(`/agent/logs/${lead.id}`, { headers: { "X-User-Id": uid } })
        .then((r) => r.json())
        .then((d) => {
          const fetched: AgentLog[] = d.logs ?? [];
          setLogs(fetched);
          if (fetched.length > 0) setExpandedLog(fetched[0].id);
        })
        .catch(() => {})
        .finally(() => setLoadingLogs(false));
    }
  }, [lead.id, streamPhase]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [planSteps]);

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleLogStep = (logId: string, idx: number) => {
    const key = `${logId}-${idx}`;
    setExpandedLogSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Live Execution Timeline */}
      {showLive && (
        <div className="rounded-[14px] border border-edge bg-surface shadow-xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-edge bg-cream/30">
            {streamPhase === "planning" ? (
              <Loader2 className="h-4 w-4 animate-spin text-copper" />
            ) : streamPhase === "done" ? (
              <Check className="h-4 w-4 text-sage" />
            ) : (
              <Brain className="h-4 w-4 text-copper" />
            )}
            <span className="text-[13px] font-semibold text-ink">
              {streamPhase === "planning"
                ? "Planning…"
                : streamPhase === "executing"
                  ? `Executing Plan — ${planSteps.filter((s) => s.status === "complete").length}/${planSteps.length} steps`
                  : streamPhase === "summarizing"
                    ? "Generating Summary…"
                    : `Analysis Complete — ${planSteps.length} steps`}
            </span>
            {isActive && (
              <span className="ml-auto flex h-2 w-2 rounded-full bg-copper animate-pulse" />
            )}
          </div>

          <div className="px-5 py-5">
            {/* Plan timeline */}
            {planSteps.length > 0 && (
              <div className="mb-2">
                {planSteps.map((step, idx) => (
                  <div key={step.index} ref={step.status === "running" ? activeRef : undefined}>
                    <StepNode
                      step={step}
                      isLast={idx === planSteps.length - 1 && streamPhase === "done" && !summary}
                      expanded={expandedSteps.has(step.index) || step.status === "running"}
                      onToggle={() => toggleStep(step.index)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="mt-4 rounded-[10px] border border-sage/30 bg-sage/5 px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-sage" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sage">Summary</span>
                </div>
                <SimpleMarkdown text={summary} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Research Profile */}
      <div className="rounded-[14px] border border-edge bg-surface shadow-xs">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-edge">
          <Search className="h-4 w-4 text-copper" />
          <span className="text-[13px] font-semibold text-ink">Research Profile</span>
        </div>
        <div className="px-5 py-5">
          {lead.research ? (
            <SimpleMarkdown text={lead.research} />
          ) : (
            <div className="flex flex-col items-center py-8">
              <div className="rounded-[12px] bg-cream-deep p-4">
                <Search className="h-5 w-5 text-ink-light" />
              </div>
              <p className="mt-3 text-[13px] font-medium text-ink-mid">No research yet</p>
              <p className="mt-1 text-[12px] text-ink-light">Click &ldquo;Analyze&rdquo; to trigger web research for this lead.</p>
            </div>
          )}
        </div>
      </div>

      {/* Historical Execution Logs */}
      {!isActive && (
        <div className="rounded-[14px] border border-edge bg-surface shadow-xs">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-edge">
            <Clock className="h-4 w-4 text-copper" />
            <span className="text-[13px] font-semibold text-ink">Execution History</span>
          </div>
          <div className="px-5 py-4">
            {loadingLogs ? (
              <div className="flex items-center gap-2 py-8 justify-center text-ink-light">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[12px]">Loading…</span>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-[12px] text-ink-light italic py-4 text-center">No agent executions yet.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-[10px] border border-edge overflow-hidden">
                    <button
                      onClick={() => {
                        setExpandedLog(expandedLog === log.id ? null : log.id);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-cream/40"
                    >
                      {expandedLog === log.id ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-light" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-light" />
                      )}
                      <span className="flex-1 text-[12px] font-semibold text-ink">
                        {TASK_LABELS[log.task_type] ?? log.task_type}
                      </span>
                      <span className="text-[10px] text-ink-light">
                        {log.steps.length} steps · {(log.duration_ms / 1000).toFixed(1)}s
                      </span>
                      <span className="text-[10px] text-ink-light">
                        {new Date(log.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                    {expandedLog === log.id && (
                      <div className="border-t border-edge px-4 py-4">
                        {log.steps.map((step, idx) => {
                          const key = `${log.id}-${idx}`;
                          const isExpanded = expandedLogSteps.has(key);
                          return (
                            <div key={idx} className="relative flex gap-0">
                              <div className="flex flex-col items-center" style={{ width: 24 }}>
                                <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-sage bg-sage text-white">
                                  <Check className="h-2.5 w-2.5" />
                                </div>
                                {idx < log.steps.length - 1 && <div className="w-[2px] flex-1 bg-sage/30" />}
                              </div>
                              <div className={`ml-2.5 flex-1 ${idx < log.steps.length - 1 ? "pb-3" : ""}`}>
                                <button
                                  onClick={() => toggleLogStep(log.id, idx)}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left hover:bg-cream/40"
                                >
                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-sage">
                                    {TOOL_ICONS[step.tool] ?? <Wrench className="h-3 w-3" />}
                                  </span>
                                  <span className="flex-1 text-[11px] font-semibold text-ink">
                                    {step.description || TOOL_LABELS[step.tool] || step.tool}
                                  </span>
                                  {step.output && (
                                    isExpanded
                                      ? <ChevronDown className="h-3 w-3 shrink-0 text-ink-light" />
                                      : <ChevronRight className="h-3 w-3 shrink-0 text-ink-light" />
                                  )}
                                </button>
                                {isExpanded && step.output && (
                                  <div className="mt-1 ml-1 rounded-[6px] border border-edge/40 bg-cream-deep/40 px-3 py-2 max-h-[160px] overflow-y-auto">
                                    <SimpleMarkdown text={step.output} className="text-[11px]" />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Thread Section ──────────────────────────────────────────

function ThreadSection({
  thread,
  leadName,
  assignedDrafts,
  buildDraftCard,
  showRadio,
  radioSelected,
  summaryMap,
  onRadioClick,
  radioDisabled,
}: {
  thread: ThreadGroup;
  leadName: string;
  assignedDrafts?: Draft[];
  buildDraftCard: (draft: Draft) => React.ReactNode;
  showRadio: boolean;
  radioSelected: boolean;
  summaryMap: Record<string, string>;
  onRadioClick: () => void;
  radioDisabled: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const lastMsg = thread.messages[thread.messages.length - 1];
  const hasDrafts = assignedDrafts && assignedDrafts.length > 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const formatFullDate = (iso: string) =>
    new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`rounded-[14px] border bg-surface shadow-xs transition-colors ${hasDrafts ? "border-amber/50" : "border-edge"}`}>
      <div className="flex items-center">
        {showRadio && (
          <button
            onClick={(e) => { e.stopPropagation(); onRadioClick(); }}
            disabled={radioDisabled}
            title={radioSelected ? "Remove draft from this thread" : "Assign draft to this thread"}
            className={`cursor-pointer shrink-0 pl-4 pr-1 py-4 transition-opacity ${radioDisabled ? "opacity-30 cursor-default" : "opacity-100"}`}
          >
            <span className={`flex h-[16px] w-[16px] items-center justify-center rounded-full border-2 transition-all ${
              radioSelected ? "border-amber bg-amber" : "border-edge-strong hover:border-copper"
            }`}>
              {radioSelected && <span className="block h-[6px] w-[6px] rounded-full bg-white" />}
            </span>
          </button>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex flex-1 cursor-pointer items-center gap-3 py-4 text-left transition-colors hover:bg-cream/40 ${showRadio ? "pr-5 pl-2" : "px-5"}`}
        >
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-light" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-light" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{thread.subject}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-mid">
              {thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""} · Last {lastMsg.isFromMe ? "sent" : "received"} {formatDate(lastMsg.date)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasDrafts && <span className="rounded-full bg-amber-light px-2 py-0.5 text-[10px] font-semibold text-amber">Draft</span>}
            {thread.messages.some((m) => !m.isFromMe) && <span className="rounded-full bg-sage-light px-2 py-0.5 text-[10px] font-semibold text-sage">Replied</span>}
            {thread.messages.some((m) => m.isFromMe) && <span className="rounded-full bg-copper-light px-2 py-0.5 text-[10px] font-semibold text-copper">Sent</span>}
          </div>
        </button>
      </div>
      {expanded && (
        <div className="border-t border-edge">
          {thread.messages.map((msg, i) => {
            const summary = summaryMap[msg.id];
            return (
              <div key={msg.id} className={`px-5 py-4 ${i > 0 ? "border-t border-edge/50" : ""}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${msg.isFromMe ? "bg-copper-light text-copper" : "bg-cream-deep text-ink-mid"}`}>
                    {msg.isFromMe ? "Y" : leadName[0]}
                  </span>
                  <span className="text-[12px] font-semibold text-ink">{msg.isFromMe ? "You" : leadName}</span>
                  <span className="text-[11px] text-ink-light">{formatFullDate(msg.date)}</span>
                </div>
                <div className="pl-8 space-y-2">
                  {summary && (
                    <div className="flex items-start gap-1.5 rounded-[8px] bg-copper-light/40 px-3 py-2">
                      <Sparkles className="mt-[1px] h-3 w-3 shrink-0 text-copper" />
                      <p className="text-[11px] leading-[1.6] text-copper font-medium">{summary}</p>
                    </div>
                  )}
                  <p className="text-[13px] leading-[1.65] text-ink-mid whitespace-pre-wrap">{msg.bodyPreview}</p>
                </div>
              </div>
            );
          })}

          {hasDrafts && (
            <div className="border-t border-edge/50 px-4 py-3 space-y-3">
              {assignedDrafts.map(buildDraftCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
