"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Save,
  Loader2,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  User,
  FileText,
  MessageSquareText,
  Brain,
  CheckCircle,
  Trash2,
} from "lucide-react";
import {
  useTrainingStore,
  TONE_OPTIONS,
  type Tone,
  type ExampleEmail,
  type TrainingConfig,
  type ConfigUpdates,
} from "@/store/training";

type Tab = "voice" | "rules" | "instructions" | "examples";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "voice", label: "Voice & Identity", icon: MessageSquareText },
  { key: "rules", label: "Do's & Don'ts", icon: Brain },
  { key: "instructions", label: "Instructions", icon: Sparkles },
  { key: "examples", label: "Examples", icon: FileText },
];

interface Props {
  config: TrainingConfig | null;
  isNew?: boolean;
  onClose: () => void;
}

function ListEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
  accentColor = "sage",
}: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  accentColor?: "sage" | "rose";
}) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3 py-[8px] text-[12px] font-semibold text-white transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 rounded-[8px] border px-3.5 py-2 transition-colors ${
                accentColor === "sage"
                  ? "border-sage/20 bg-sage-light/30"
                  : "border-rose/20 bg-rose-light/30"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  accentColor === "sage" ? "bg-sage" : "bg-rose"
                }`}
              />
              <span className="flex-1 text-[13px] text-ink">{item}</span>
              <button
                onClick={() => onRemove(i)}
                className="cursor-pointer shrink-0 rounded-[6px] p-1 text-ink-light transition-colors hover:bg-surface hover:text-rose"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrainingEditorPanel({
  config,
  isNew,
  onClose,
}: Props) {
  const { createConfig, updateConfig, saving } = useTrainingStore();

  const [tab, setTab] = useState<Tab>("voice");
  const [configId, setConfigId] = useState<string | null>(config?.id ?? null);

  // Fields
  const [name, setName] = useState(config?.name ?? "");
  const [description, setDescription] = useState(config?.description ?? "");
  const [brandVoice, setBrandVoice] = useState(config?.brandVoice ?? "");
  const [tone, setTone] = useState<Tone>(config?.tone ?? "professional");
  const [customInstructions, setCustomInstructions] = useState(config?.customInstructions ?? "");
  const [dos, setDos] = useState<string[]>(config?.dos ?? []);
  const [donts, setDonts] = useState<string[]>(config?.donts ?? []);
  const [exampleEmails, setExampleEmails] = useState<ExampleEmail[]>(config?.exampleEmails ?? []);
  const [senderName, setSenderName] = useState(config?.senderName ?? "");
  const [senderTitle, setSenderTitle] = useState(config?.senderTitle ?? "");
  const [companyName, setCompanyName] = useState(config?.companyName ?? "");
  const [companyDescription, setCompanyDescription] = useState(config?.companyDescription ?? "");

  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Example email form
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailLabel, setEmailLabel] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaved(false);
  }, []);

  const gatherUpdates = useCallback((): ConfigUpdates => ({
    name,
    description,
    brandVoice,
    tone,
    customInstructions,
    dos,
    donts,
    exampleEmails,
    senderName,
    senderTitle,
    companyName,
    companyDescription,
  }), [name, description, brandVoice, tone, customInstructions, dos, donts, exampleEmails, senderName, senderTitle, companyName, companyDescription]);

  const handleSave = async () => {
    if (!name.trim()) return;

    if (isNew && !configId) {
      const created = await createConfig(name, description);
      if (created) {
        setConfigId(created.id);
        await updateConfig(created.id, gatherUpdates());
      }
    } else if (configId) {
      await updateConfig(configId, gatherUpdates());
    }

    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    onClose();
  };

  // List helpers
  const addDo = (item: string) => { setDos((prev) => [...prev, item]); markDirty(); };
  const removeDo = (i: number) => { setDos((prev) => prev.filter((_, idx) => idx !== i)); markDirty(); };
  const addDont = (item: string) => { setDonts((prev) => [...prev, item]); markDirty(); };
  const removeDont = (i: number) => { setDonts((prev) => prev.filter((_, idx) => idx !== i)); markDirty(); };

  const addExampleEmail = () => {
    if (!emailSubject.trim() && !emailBody.trim()) return;
    setExampleEmails((prev) => [...prev, { label: emailLabel.trim() || "Example", subject: emailSubject.trim(), body: emailBody.trim() }]);
    setEmailLabel("");
    setEmailSubject("");
    setEmailBody("");
    setShowEmailForm(false);
    markDirty();
  };
  const removeExampleEmail = (i: number) => { setExampleEmails((prev) => prev.filter((_, idx) => idx !== i)); markDirty(); };

  // Tab counts for badges
  const voiceComplete = [senderName, companyName, brandVoice].filter((s) => s.trim()).length;
  const rulesCount = dos.length + donts.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/10 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 flex h-full w-[50vw] min-w-[480px] flex-col bg-surface shadow-lg animate-slide-in">
        {/* ── Header ── */}
        <div className="border-b border-edge px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); markDirty(); }}
                placeholder="Training profile name..."
                className="w-full bg-transparent font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em] text-ink placeholder:text-ink-light outline-none"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                placeholder="e.g. Cold outreach for SaaS founders"
                className="mt-1.5 w-full bg-transparent text-[13px] text-ink-mid placeholder:text-ink-light outline-none"
              />
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {saved && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage">
                  <CheckCircle className="h-3 w-3" />
                  Saved
                </span>
              )}
              <button
                onClick={handleSaveAndClose}
                disabled={saving || !name.trim()}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3.5 py-[7px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="mt-5 flex gap-1 rounded-[10px] border border-edge bg-cream p-[3px]">
            {TABS.map((t) => {
              const active = tab === t.key;
              let badge: number | null = null;
              if (t.key === "rules") badge = rulesCount;
              if (t.key === "examples") badge = exampleEmails.length;

              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[7px] text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-surface text-copper shadow-xs"
                      : "text-ink-mid hover:text-ink"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {badge !== null && badge > 0 && (
                    <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-bold ${
                      active ? "bg-copper-light text-copper" : "bg-cream-deep text-ink-light"
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Voice & Identity */}
          {tab === "voice" && (
            <div className="space-y-6 animate-fade-up">
              {/* Sender Context */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-copper" />
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mid">
                    Sender Context
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                      Your Name
                    </label>
                    <input type="text" value={senderName} onChange={(e) => { setSenderName(e.target.value); markDirty(); }} placeholder="e.g. Sarah Chen" className="w-full rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                      Your Title
                    </label>
                    <input type="text" value={senderTitle} onChange={(e) => { setSenderTitle(e.target.value); markDirty(); }} placeholder="e.g. Head of Partnerships" className="w-full rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                      Company
                    </label>
                    <input type="text" value={companyName} onChange={(e) => { setCompanyName(e.target.value); markDirty(); }} placeholder="e.g. Acme Corp" className="w-full rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                      Company Description
                    </label>
                    <textarea value={companyDescription} onChange={(e) => { setCompanyDescription(e.target.value); markDirty(); }} placeholder="Briefly describe what your company does..." rows={2} className="w-full resize-y rounded-[8px] border border-edge bg-surface px-3.5 py-2.5 text-[13px] leading-[1.6] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  </div>
                </div>
              </div>

              {/* Tone */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquareText className="h-4 w-4 text-copper" />
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mid">
                    Tone
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setTone(opt.value); markDirty(); }}
                      className={`cursor-pointer rounded-[10px] border px-4 py-3 text-left transition-all ${
                        tone === opt.value
                          ? "border-copper bg-copper-light ring-[2px] ring-copper/20"
                          : "border-edge bg-surface hover:border-edge-strong hover:bg-cream"
                      }`}
                    >
                      <p className={`text-[13px] font-semibold ${tone === opt.value ? "text-copper" : "text-ink"}`}>
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-mid">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Voice */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Voice Description
                </label>
                <textarea
                  value={brandVoice}
                  onChange={(e) => { setBrandVoice(e.target.value); markDirty(); }}
                  placeholder="Describe how emails should sound. e.g. 'Direct and value-driven. Short paragraphs, no jargon. Open with a specific insight about the prospect.'"
                  rows={4}
                  className="w-full resize-y rounded-[8px] border border-edge bg-surface px-3.5 py-2.5 text-[13px] leading-[1.6] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
                />
              </div>
            </div>
          )}

          {/* Rules (Do's & Don'ts) */}
          {tab === "rules" && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-sage" />
                  <span className="text-[12px] font-bold text-sage uppercase tracking-[0.08em]">
                    Do&apos;s
                  </span>
                  <span className="rounded-full bg-sage-light px-1.5 py-[1px] text-[10px] font-bold text-sage">
                    {dos.length}
                  </span>
                </div>
                <ListEditor items={dos} onAdd={addDo} onRemove={removeDo} placeholder="e.g. Mention their recent funding round" accentColor="sage" />
                {dos.length === 0 && (
                  <p className="mt-2 text-[11px] text-ink-light">Add things the AI should always do when writing emails.</p>
                )}
              </div>

              <div className="border-t border-edge pt-6">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-rose" />
                  <span className="text-[12px] font-bold text-rose uppercase tracking-[0.08em]">
                    Don&apos;ts
                  </span>
                  <span className="rounded-full bg-rose-light px-1.5 py-[1px] text-[10px] font-bold text-rose">
                    {donts.length}
                  </span>
                </div>
                <ListEditor items={donts} onAdd={addDont} onRemove={removeDont} placeholder="e.g. Never use 'hope this email finds you well'" accentColor="rose" />
                {donts.length === 0 && (
                  <p className="mt-2 text-[11px] text-ink-light">Add things the AI should never do.</p>
                )}
              </div>
            </div>
          )}

          {/* Custom Instructions */}
          {tab === "instructions" && (
            <div className="animate-fade-up">
              <p className="mb-3 text-[13px] text-ink-mid">
                Free-form instructions the AI will follow. Be as specific as you like.
              </p>
              <textarea
                value={customInstructions}
                onChange={(e) => { setCustomInstructions(e.target.value); markDirty(); }}
                placeholder={`Write any specific instructions here. For example:\n\n• Always include a clear CTA in the last paragraph\n• Reference the lead's LinkedIn activity when available\n• Keep emails under 150 words\n• Use the prospect's first name, never their full name\n• If the lead is a C-level exec, be more concise`}
                rows={16}
                className="w-full resize-y rounded-[8px] border border-edge bg-surface px-3.5 py-2.5 text-[13px] leading-[1.6] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
              />
            </div>
          )}

          {/* Example Emails */}
          {tab === "examples" && (
            <div className="space-y-3 animate-fade-up">
              <p className="text-[13px] text-ink-mid">
                Reference emails that show the exact style you want. The more examples, the better the AI learns.
              </p>

              {exampleEmails.map((email, i) => (
                <div key={i} className="group rounded-[10px] border border-edge bg-cream/40 transition-colors hover:border-edge-strong">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-light" />
                      <span className="text-[12px] font-semibold text-ink truncate">{email.label}</span>
                    </div>
                    <button onClick={() => removeExampleEmail(i)} className="cursor-pointer shrink-0 rounded-[6px] p-1 text-ink-light opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-light hover:text-rose">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    {email.subject && <p className="text-[12px] font-semibold text-ink">Subject: {email.subject}</p>}
                    <p className="mt-1 text-[12px] leading-[1.6] text-ink-mid whitespace-pre-wrap line-clamp-4">{email.body}</p>
                  </div>
                </div>
              ))}

              {showEmailForm ? (
                <div className="rounded-[10px] border border-copper/30 bg-surface p-4 space-y-3 animate-fade-up">
                  <input type="text" value={emailLabel} onChange={(e) => setEmailLabel(e.target.value)} placeholder="Label (e.g. 'Cold outreach — SaaS CEO')" className="w-full rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject line..." className="w-full rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] font-semibold text-ink placeholder:text-ink-light outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Paste or write the full email body..." rows={6} className="w-full resize-y rounded-[8px] border border-edge bg-surface px-3.5 py-2.5 text-[13px] leading-[1.6] text-ink placeholder:text-ink-light outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light" />
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setShowEmailForm(false); setEmailLabel(""); setEmailSubject(""); setEmailBody(""); }} className="cursor-pointer rounded-[8px] px-3 py-[6px] text-[12px] font-medium text-ink-mid hover:bg-cream">Cancel</button>
                    <button onClick={addExampleEmail} disabled={!emailSubject.trim() && !emailBody.trim()} className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3.5 py-[6px] text-[12px] font-semibold text-white transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-40">
                      <Plus className="h-3 w-3" />
                      Add Example
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-edge-strong py-4 text-[13px] font-medium text-ink-mid transition-all hover:border-copper hover:bg-copper-light/30 hover:text-copper"
                >
                  <Plus className="h-4 w-4" />
                  Add Example Email
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        {dirty && (
          <div className="border-t border-edge bg-cream/60 px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-mid">Unsaved changes</span>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-copper px-4 py-[7px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
