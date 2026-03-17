"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useOutlookStore } from "@/store/outlook";
import { useGoogleStore } from "@/store/google";
import { Mail, CheckCircle, AlertCircle, LogOut, Loader2, Chrome } from "lucide-react";

export default function SettingsPage() {
  const {
    isConnected: isOutlookConnected,
    userEmail: outlookEmail,
    userName: outlookName,
    isLoading: isOutlookLoading,
    checkConnection: checkOutlookConnection,
    disconnect: disconnectOutlook,
  } = useOutlookStore();
  const {
    isConnected: isGoogleConnected,
    userEmail: googleEmail,
    userName: googleName,
    isLoading: isGoogleLoading,
    checkConnection: checkGoogleConnection,
    disconnect: disconnectGoogle,
  } = useGoogleStore();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected") === "true";
  const connectedProvider = searchParams.get("provider");
  const error = searchParams.get("error");

  useEffect(() => {
    checkOutlookConnection();
    checkGoogleConnection();
  }, [checkOutlookConnection, checkGoogleConnection]);

  return (
    <div className="mx-auto max-w-[720px] px-10 py-12">
      <div className="mb-10">
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
          Settings
        </h1>
        <p className="mt-2 text-[14px] text-ink-mid">
          Connect your email account to send outreach.
        </p>
      </div>

      {/* Connection status toast */}
      {justConnected && (
        <div className="mb-6 flex items-center gap-3 rounded-[12px] border border-sage-muted bg-sage-light px-5 py-3 animate-fade-up">
          <CheckCircle className="h-[18px] w-[18px] text-sage" />
          <p className="text-[13px] font-medium text-sage">
            {connectedProvider === "google"
              ? "Google connected successfully!"
              : "Outlook connected successfully!"}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-[12px] border border-rose/20 bg-rose-light px-5 py-3 animate-fade-up">
          <AlertCircle className="h-[18px] w-[18px] text-rose" />
          <p className="text-[13px] font-medium text-rose">{error}</p>
        </div>
      )}

      {/* Outlook Card */}
      <div className="rounded-[16px] border border-edge bg-surface p-7 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-copper-light">
            <Mail className="h-5 w-5 text-copper" />
          </div>
          <div className="flex-1">
            <h2 className="font-[family-name:var(--font-display)] text-[16px] font-bold tracking-[-0.01em] text-ink">
              Microsoft Outlook
            </h2>
            <p className="mt-1 text-[13px] text-ink-mid">
              Send emails and track replies via your Outlook account.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-edge pt-6">
          {isOutlookLoading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-ink-light" />
              <span className="text-[13px] text-ink-mid">Checking connection...</span>
            </div>
          ) : isOutlookConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage-light">
                  <CheckCircle className="h-4 w-4 text-sage" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Connected</p>
                  <p className="text-[12px] text-ink-mid">
                    {outlookName && `${outlookName} · `}{outlookEmail}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/auth/outlook"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-edge px-4 py-[8px] text-[12px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-ink"
                >
                  Sign in with different account
                </a>
                <button
                  onClick={disconnectOutlook}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-edge px-4 py-[8px] text-[12px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-rose"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-ink-mid">
                No account connected. Sign in to start sending outreach emails.
              </p>
              <a
                href="/api/auth/outlook"
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
              >
                <Mail className="h-4 w-4" />
                Sign in with Microsoft
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Google Card */}
      <div className="mt-6 rounded-[16px] border border-edge bg-surface p-7 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-sage-light">
            <Chrome className="h-5 w-5 text-sage" />
          </div>
          <div className="flex-1">
            <h2 className="font-[family-name:var(--font-display)] text-[16px] font-bold tracking-[-0.01em] text-ink">
              Google Gmail
            </h2>
            <p className="mt-1 text-[13px] text-ink-mid">
              Connect Gmail for sending outreach with your Google account.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-edge pt-6">
          {isGoogleLoading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-ink-light" />
              <span className="text-[13px] text-ink-mid">Checking connection...</span>
            </div>
          ) : isGoogleConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage-light">
                  <CheckCircle className="h-4 w-4 text-sage" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Connected</p>
                  <p className="text-[12px] text-ink-mid">
                    {googleName && `${googleName} · `}{googleEmail}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/auth/google"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-edge px-4 py-[8px] text-[12px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-ink"
                >
                  Sign in with different account
                </a>
                <button
                  onClick={disconnectGoogle}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-edge px-4 py-[8px] text-[12px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-rose"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-ink-mid">
                No account connected. Sign in to start sending outreach emails.
              </p>
              <a
                href="/api/auth/google"
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-sage px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Chrome className="h-4 w-4" />
                Sign in with Google
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="mt-8 rounded-[16px] border border-dashed border-edge-strong bg-surface p-7">
        <h3 className="font-[family-name:var(--font-display)] text-[14px] font-bold text-ink">
          Setup Guide
        </h3>
        <ol className="mt-3 space-y-2 text-[13px] text-ink-mid">
          <li>
            <span className="font-semibold text-ink">1.</span> Register an app in{" "}
            <a
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-copper underline decoration-copper/30 hover:decoration-copper"
            >
              Azure Portal
            </a>{" "}
            (Microsoft Entra ID &gt; App Registrations).
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span> Add a redirect URI:{" "}
            <code className="rounded bg-cream px-1.5 py-0.5 text-[12px] text-ink">
              http://localhost:3000/api/auth/outlook/callback
            </code>
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> Create a client secret under Certificates &amp; Secrets.
          </li>
          <li>
            <span className="font-semibold text-ink">4.</span> Copy Client ID and Secret into your{" "}
            <code className="rounded bg-cream px-1.5 py-0.5 text-[12px] text-ink">.env.local</code> file.
          </li>
        </ol>
      </div>
    </div>
  );
}
