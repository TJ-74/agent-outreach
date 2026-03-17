"use client";

import { useState, type FormEvent } from "react";
import { X, Send, Mail, Loader2 } from "lucide-react";
import { useLeadStore, type Lead } from "@/store/leads";
import { useOutlookStore } from "@/store/outlook";
import { useGoogleStore } from "@/store/google";

interface Props {
  lead: Lead | null;
  onClose: () => void;
}

export default function SendEmailModal({ lead, onClose }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const updateLead = useLeadStore((s) => s.updateLead);
  const isOutlookConnected = useOutlookStore((s) => s.isConnected);
  const isGoogleConnected = useGoogleStore((s) => s.isConnected);
  const isConnected = isOutlookConnected || isGoogleConnected;

  if (!lead) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }

    setSending(true);
    setError("");

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

      await updateLead(lead.id, { status: "contacted", actionNeeded: "waiting_for_reply" });
      setSent(true);
      setTimeout(() => {
        onClose();
        setSent(false);
        setSubject("");
        setBody("");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-ink/10 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div className="animate-scale-up relative z-10 w-full max-w-[520px] rounded-[20px] border border-edge bg-surface p-8 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-copper-light">
              <Mail className="h-[18px] w-[18px] text-copper" />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.02em] text-ink">
                Send Email
              </h2>
              <p className="text-[12px] text-ink-mid">
                to {lead.firstName} {lead.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-[8px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center py-8">
            <p className="text-[13px] text-ink-mid">
              Connect your Outlook or Google account first.
            </p>
            <a
              href="/settings"
              className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper"
            >
              Go to Settings
            </a>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center py-10 animate-fade-up">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-light">
              <Send className="h-5 w-5 text-sage" />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-sage">Email sent!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* To (read-only) */}
            <div>
              <label className="mb-[6px] block text-[12px] font-medium text-ink-mid">
                To
              </label>
              <div className="rounded-[10px] border border-edge bg-cream-deep px-4 py-[10px] text-[13px] text-ink-mid">
                {lead.email}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-[6px] block text-[12px] font-medium text-ink-mid">
                Subject <span className="text-rose">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Quick intro from Agent Outreach"
                className="w-full rounded-[10px] border border-edge bg-cream px-4 py-[10px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
              />
            </div>

            {/* Body */}
            <div>
              <label className="mb-[6px] block text-[12px] font-medium text-ink-mid">
                Message <span className="text-rose">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi Jane, I wanted to reach out about..."
                rows={5}
                className="w-full resize-none rounded-[10px] border border-edge bg-cream px-4 py-3 text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
              />
            </div>

            {error && (
              <p className="text-[12px] text-rose">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-edge pt-5">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-[10px] border border-edge px-5 py-[10px] text-[13px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="cursor-pointer inline-flex items-center gap-2 rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
