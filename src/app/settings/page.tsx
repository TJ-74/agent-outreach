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
    setProfile((p) => (p ? { ...p, name: editName.trim() } : p));
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
    <div className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">

        {/* Toasts */}
        {justConnected && (
          <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-sage-muted bg-sage-light px-4 py-3 animate-fade-up sm:mb-6 sm:px-5">
            <CheckCircle className="h-[18px] w-[18px] text-sage" />
            <p className="text-[13px] font-medium text-sage">
              {connectedProvider === "google" ? "Google" : "Outlook"} connected successfully!
            </p>
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-rose/20 bg-rose-light px-4 py-3 animate-fade-up sm:mb-6 sm:px-5">
            <AlertCircle className="h-[18px] w-[18px] text-rose" />
            <p className="text-[13px] font-medium text-rose">{error}</p>
          </div>
        )}

        {/* Profile Section */}
        <div className="overflow-hidden rounded-[16px] border border-edge bg-surface shadow-xs animate-fade-up sm:rounded-[20px]">
          {/* Banner */}
          <div className="relative h-24 bg-gradient-to-br from-copper/15 via-copper-light to-cream-deep sm:h-32">
            <div className="absolute -bottom-8 left-5 flex h-16 w-16 items-center justify-center rounded-[18px] bg-copper font-[family-name:var(--font-display)] text-[22px] font-bold text-white shadow-lg ring-4 ring-surface sm:-bottom-10 sm:left-8 sm:h-20 sm:w-20 sm:rounded-[22px] sm:text-[28px]">
              {initials}
            </div>
          </div>

          {/* Identity */}
          <div className="px-4 pb-5 pt-12 sm:px-8 sm:pb-8 sm:pt-14">
            <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-[family-name:var(--font-display)] text-[20px] font-extrabold tracking-[-0.02em] text-ink sm:text-[22px]">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-[13px] text-ink-mid sm:text-[14px]">{displayEmail}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
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
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-cream-deep sm:flex">
                <Settings className="h-4 w-4 text-ink-light" />
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:mb-8 sm:grid-cols-4 sm:gap-3">
                {[
                  { icon: Users, label: "Leads", value: stats.leads, color: "text-copper" },
                  { icon: GitBranch, label: "Sequences", value: stats.sequences, color: "text-copper" },
                  { icon: Send, label: "Sent", value: stats.sentEmails, color: "text-sage" },
                  { icon: Brain, label: "AI Profiles", value: stats.trainingProfiles, color: "text-copper" },
                ].map((s) => (
                  <div key={s.label} className="rounded-[12px] bg-cream/70 px-3 py-3 text-center sm:px-4 sm:py-3.5">
                    <s.icon className={`mx-auto mb-1 h-3.5 w-3.5 sm:mb-1.5 sm:h-4 sm:w-4 ${s.color}`} />
                    <p className="text-[18px] font-bold leading-none text-ink sm:text-[20px]">{s.value}</p>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-ink-light sm:text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Edit name */}
            <div className="border-t border-edge pt-5 sm:pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-ink-light">
                  Email is linked to your connected account.
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || !editName.trim() || editName.trim() === profile?.name}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-copper px-5 py-[9px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:cursor-default disabled:opacity-40 sm:w-auto"
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

        {/* Connections Section */}
        <div className="mt-8 animate-fade-up sm:mt-10" style={{ animationDelay: "60ms" }}>
          <div className="mb-4 flex items-center gap-2.5 px-1 sm:mb-5">
            <div className="h-px flex-1 bg-edge" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-light">Email Connection</span>
            <div className="h-px flex-1 bg-edge" />
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Outlook */}
            <div className="overflow-hidden rounded-[14px] border border-edge bg-surface shadow-xs sm:rounded-[16px]">
              <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-copper-light sm:h-12 sm:w-12 sm:rounded-[14px]">
                  <Mail className="h-5 w-5 text-copper" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    <h3 className="text-[14px] font-bold text-ink sm:text-[15px]">Microsoft Outlook</h3>
                    {isOutlookConnected && (
                      <span className="rounded-full bg-sage-light px-2.5 py-[3px] text-[10px] font-semibold text-sage">Connected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-mid">Send emails and track replies via Outlook</p>
                </div>
              </div>
              <div className="border-t border-edge bg-cream/20 px-4 py-4 sm:px-6">
                {isOutlookLoading ? (
                  <div className="flex items-center gap-3 py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-light" />
                    <span className="text-[13px] text-ink-mid">Checking…</span>
                  </div>
                ) : isOutlookConnected ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[12px] font-bold text-sage">
                        {outlookName ? outlookName.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{outlookName || "Connected"}</p>
                        <p className="truncate text-[12px] text-ink-mid">{outlookEmail}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0 sm:items-center">
                      <a href="/api/auth/outlook" className="inline-flex w-full cursor-pointer items-center justify-center rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:bg-surface hover:text-ink sm:w-auto">
                        Switch account
                      </a>
                      <button onClick={disconnectOutlook} className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:border-rose/30 hover:bg-rose-light hover:text-rose sm:w-auto">
                        <LogOut className="h-3 w-3" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : isGoogleConnected ? (
                  <div className="flex items-center gap-3 py-1">
                    <Ban className="h-4 w-4 shrink-0 text-ink-faint" />
                    <p className="text-[13px] text-ink-light">Disconnect Google first to connect Outlook</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-ink-mid">No account connected</p>
                    <a href="/api/auth/outlook" className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-copper px-5 py-[9px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] sm:w-auto">
                      <Mail className="h-3.5 w-3.5" />
                      Sign in with Microsoft
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Google */}
            <div className="overflow-hidden rounded-[14px] border border-edge bg-surface shadow-xs sm:rounded-[16px]">
              <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-sage-light sm:h-12 sm:w-12 sm:rounded-[14px]">
                  <Chrome className="h-5 w-5 text-sage" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    <h3 className="text-[14px] font-bold text-ink sm:text-[15px]">Google Gmail</h3>
                    {isGoogleConnected && (
                      <span className="rounded-full bg-sage-light px-2.5 py-[3px] text-[10px] font-semibold text-sage">Connected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-mid">Send outreach emails with your Google account</p>
                </div>
              </div>
              <div className="border-t border-edge bg-cream/20 px-4 py-4 sm:px-6">
                {isGoogleLoading ? (
                  <div className="flex items-center gap-3 py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-light" />
                    <span className="text-[13px] text-ink-mid">Checking…</span>
                  </div>
                ) : isGoogleConnected ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[12px] font-bold text-sage">
                        {googleName ? googleName.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{googleName || "Connected"}</p>
                        <p className="truncate text-[12px] text-ink-mid">{googleEmail}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0 sm:items-center">
                      <a href="/api/auth/google" className="inline-flex w-full cursor-pointer items-center justify-center rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:bg-surface hover:text-ink sm:w-auto">
                        Switch account
                      </a>
                      <button onClick={disconnectGoogle} className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-edge px-3.5 py-[7px] text-[11px] font-medium text-ink-mid transition-all hover:border-rose/30 hover:bg-rose-light hover:text-rose sm:w-auto">
                        <LogOut className="h-3 w-3" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : isOutlookConnected ? (
                  <div className="flex items-center gap-3 py-1">
                    <Ban className="h-4 w-4 shrink-0 text-ink-faint" />
                    <p className="text-[13px] text-ink-light">Disconnect Outlook first to connect Google</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-ink-mid">No account connected</p>
                    <a href="/api/auth/google" className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-sage px-5 py-[9px] text-[12px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.98] sm:w-auto">
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
