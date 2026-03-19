"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOutlookStore } from "@/store/outlook";
import { useGoogleStore } from "@/store/google";
import { supabase } from "@/lib/supabase";
import {
  Settings,
  Mail,
  CheckCircle,
  AlertCircle,
  LogOut,
  Loader2,
  Chrome,
  User,
  Save,
  Calendar,
  Users,
  GitBranch,
  Send,
  Brain,
  Ban,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface Stats {
  leads: number;
  sequences: number;
  sentEmails: number;
  trainingProfiles: number;
}

function SettingsContent() {
  const {
    isConnected: isOutlookConnected,
    userEmail: outlookEmail,
    userName: outlookName,
    userId: outlookUserId,
    isLoading: isOutlookLoading,
    checkConnection: checkOutlookConnection,
    disconnect: disconnectOutlook,
  } = useOutlookStore();
  const {
    isConnected: isGoogleConnected,
    userEmail: googleEmail,
    userName: googleName,
    userId: googleUserId,
    isLoading: isGoogleLoading,
    checkConnection: checkGoogleConnection,
    disconnect: disconnectGoogle,
  } = useGoogleStore();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected") === "true";
  const connectedProvider = searchParams.get("provider");
  const error = searchParams.get("error");

  const userId = outlookUserId || googleUserId;
  const connectedName = outlookName || googleName || "";
  const connectedEmail = outlookEmail || googleEmail || "";
  const provider = isOutlookConnected ? "outlook" : isGoogleConnected ? "google" : null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    checkOutlookConnection();
    checkGoogleConnection();
  }, [checkOutlookConnection, checkGoogleConnection]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [userRes, leadsRes, seqRes, sentRes, trainingRes] = await Promise.all([
        supabase.from("users").select("id, name, email, created_at").eq("id", userId).single(),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("sequences").select("id", { count: "exact", head: true }),
        supabase.from("sent_emails").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("ai_training_config").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (userRes.data) {
        setProfile(userRes.data as UserProfile);
        setEditName(userRes.data.name ?? "");
      }
      setStats({
        leads: leadsRes.count ?? 0,
        sequences: seqRes.count ?? 0,
        sentEmails: sentRes.count ?? 0,
        trainingProfiles: trainingRes.count ?? 0,
      });
    })();
  }, [userId]);

  const handleSave = async () => {
    if (!userId || !editName.trim()) return;
    setSaving(true);
    await supabase.from("users").update({ name: editName.trim() }).eq("id", userId);
    setProfile((p) => p ? { ...p, name: editName.trim() } : p);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const displayName = profile?.name || connectedName || "User";
  const displayEmail = profile?.email || connectedEmail || "";
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen py-10 px-6 md:px-10">
      <div className="mx-auto max-w-[760px]">

        {/* Toasts */}
        {justConnected && (
          <div className="mb-6 flex items-center gap-3 rounded-[12px] border border-sage-muted bg-sage-light px-5 py-3 animate-fade-up">
            <CheckCircle className="h-[18px] w-[18px] text-sage" />
            <p className="text-[13px] font-medium text-sage">
              {connectedProvider === "google" ? "Google" : "Outlook"} connected successfully!
            </p>
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[12px] border border-rose/20 bg-rose-light px-5 py-3 animate-fade-up">
            <AlertCircle className="h-[18px] w-[18px] text-rose" />
            <p className="text-[13px] font-medium text-rose">{error}</p>
          </div>
        )}

        {/* ════════ Profile Section ════════ */}
        <div className="rounded-[20px] border border-edge bg-surface shadow-xs overflow-hidden animate-fade-up">
          {/* Banner */}
          <div className="relative h-32 bg-gradient-to-br from-copper/15 via-copper-light to-cream-deep">
            <div className="absolute -bottom-10 left-8 flex h-20 w-20 items-center justify-center rounded-[22px] bg-copper shadow-lg font-[family-name:var(--font-display)] text-[28px] font-bold text-white ring-4 ring-surface">
              {initials}
            </div>
          </div>

          {/* Identity */}
          <div className="px-8 pt-14 pb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-[22px] font-extrabold tracking-[-0.02em] text-ink">
                  {displayName}
                </h1>
                <p className="mt-1 text-[14px] text-ink-mid">{displayEmail}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  {provider === "outlook" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-copper-light px-3 py-1 text-[11px] font-semibold text-copper">
                      <Mail className="h-3 w-3" /> Outlook
                    </span>
                  )}
                  {provider === "google" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-light px-3 py-1 text-[11px] font-semibold text-sage">
                      <Chrome className="h-3 w-3" /> Google
                    </span>
                  )}
                  {memberSince && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-light">
                      <Calendar className="h-3 w-3" /> Since {memberSince}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-cream-deep">
                <Settings className="h-4 w-4 text-ink-light" />
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-4 gap-3 mb-8">
                {[
                  { icon: Users, label: "Leads", value: stats.leads, color: "text-copper" },
                  { icon: GitBranch, label: "Sequences", value: stats.sequences, color: "text-copper" },
                  { icon: Send, label: "Sent", value: stats.sentEmails, color: "text-sage" },
                  { icon: Brain, label: "AI Profiles", value: stats.trainingProfiles, color: "text-copper" },
                ].map((s) => (
                  <div key={s.label} className="rounded-[12px] bg-cream/70 px-4 py-3.5 text-center">
                    <s.icon className={`mx-auto h-4 w-4 ${s.color} mb-1.5`} />
                    <p className="text-[20px] font-bold text-ink leading-none">{s.value}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-light">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Edit name */}
            <div className="border-t border-edge pt-6">
              <div className="grid grid-cols-[1fr_1fr] gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-light">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-[10px] border border-edge bg-cream/40 py-[11px] pl-10 pr-4 text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-light">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      value={displayEmail}
                      readOnly
                      className="w-full rounded-[10px] border border-edge bg-cream-deep/40 py-[11px] pl-10 pr-4 text-[13px] text-ink-mid cursor-default outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-[11px] text-ink-light">
                  Email is linked to your connected account.
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || !editName.trim() || editName.trim() === profile?.name}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[9px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-default"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ════════ Connections Section ════════ */}
        <div className="mt-10 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="mb-5 flex items-center gap-2.5 px-1">
            <div className="h-px flex-1 bg-edge" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-light">Email Connection</span>
            <div className="h-px flex-1 bg-edge" />
          </div>

          <div className="space-y-4">
            {/* Outlook */}
            <div className="rounded-[16px] border border-edge bg-surface shadow-xs overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-copper-light">
                  <Mail className="h-5 w-5 text-copper" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[15px] font-bold text-ink">Microsoft Outlook</h3>
                    {isOutlookConnected && (
                      <span className="rounded-full bg-sage-light px-2.5 py-[3px] text-[10px] font-semibold text-sage">Connected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-mid">Send emails and track replies via Outlook</p>
                </div>
              </div>
              <div className="border-t border-edge px-6 py-4 bg-cream/20">
                {isOutlookLoading ? (
                  <div className="flex items-center gap-3 py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-light" />
                    <span className="text-[13px] text-ink-mid">Checking…</span>
                  </div>
                ) : isOutlookConnected ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[12px] font-bold text-sage">
                        {outlookName ? outlookName.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{outlookName || "Connected"}</p>
                        <p className="truncate text-[12px] text-ink-mid">{outlookEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href="/api/auth/outlook" className="inline-flex cursor-pointer items-center rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:bg-surface hover:text-ink">
                        Switch account
                      </a>
                      <button onClick={disconnectOutlook} className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:border-rose/30 hover:bg-rose-light hover:text-rose">
                        <LogOut className="h-3 w-3" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : isGoogleConnected ? (
                  <div className="flex items-center gap-3 py-1">
                    <Ban className="h-4 w-4 text-ink-faint" />
                    <p className="text-[13px] text-ink-light">Disconnect Google first to connect Outlook</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <p className="text-[13px] text-ink-mid">No account connected</p>
                    <a href="/api/auth/outlook" className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[9px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]">
                      <Mail className="h-3.5 w-3.5" />
                      Sign in with Microsoft
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Google */}
            <div className="rounded-[16px] border border-edge bg-surface shadow-xs overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-sage-light">
                  <Chrome className="h-5 w-5 text-sage" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[15px] font-bold text-ink">Google Gmail</h3>
                    {isGoogleConnected && (
                      <span className="rounded-full bg-sage-light px-2.5 py-[3px] text-[10px] font-semibold text-sage">Connected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-mid">Send outreach emails with your Google account</p>
                </div>
              </div>
              <div className="border-t border-edge px-6 py-4 bg-cream/20">
                {isGoogleLoading ? (
                  <div className="flex items-center gap-3 py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-light" />
                    <span className="text-[13px] text-ink-mid">Checking…</span>
                  </div>
                ) : isGoogleConnected ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[12px] font-bold text-sage">
                        {googleName ? googleName.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{googleName || "Connected"}</p>
                        <p className="truncate text-[12px] text-ink-mid">{googleEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href="/api/auth/google" className="inline-flex cursor-pointer items-center rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:bg-surface hover:text-ink">
                        Switch account
                      </a>
                      <button onClick={disconnectGoogle} className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:border-rose/30 hover:bg-rose-light hover:text-rose">
                        <LogOut className="h-3 w-3" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : isOutlookConnected ? (
                  <div className="flex items-center gap-3 py-1">
                    <Ban className="h-4 w-4 text-ink-faint" />
                    <p className="text-[13px] text-ink-light">Disconnect Outlook first to connect Google</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <p className="text-[13px] text-ink-mid">No account connected</p>
                    <a href="/api/auth/google" className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-sage px-5 py-[9px] text-[12px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.98]">
                      <Chrome className="h-3.5 w-3.5" />
                      Sign in with Google
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-copper" />
          <span className="text-[13px] text-ink-mid">Loading…</span>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
