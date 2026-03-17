"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Mail, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOutlookStore } from "@/store/outlook";
import { useUnreadStore } from "@/store/unread";

interface Toast {
  id: string;
  from: string;
  subject: string;
  createdAt: number;
}

const TOAST_DURATION = 6000;
const POLL_INTERVAL = 30_000;

export default function InboxNotifier() {
  const { isConnected, userId } = useOutlookStore();
  const initUnread = useUnreadStore((s) => s.init);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (userId) initUnread(userId);
  }, [userId, initUnread]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isConnected || !userId) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/outlook/poll", { method: "POST" });
        if (!res.ok) return;
        const data = await res.json() as {
          newMessages?: number;
          newByLead?: Record<string, number>;
        };
        if (data.newMessages && data.newMessages > 0) {
          useUnreadStore.getState().refresh(userId);
        }
      } catch {
        // silent
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isConnected, userId]);

  useEffect(() => {
    if (!isConnected || !userId) return;

    const channel = supabase
      .channel("inbox-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            direction?: string;
            from_email?: string;
            subject?: string;
            id?: string;
          };
          if (row.direction !== "inbound") return;

          const toast: Toast = {
            id: row.id ?? crypto.randomUUID(),
            from: row.from_email ?? "Unknown",
            subject: row.subject ?? "(No subject)",
            createdAt: Date.now(),
          };
          setToasts((prev) => [toast, ...prev].slice(0, 5));

          setTimeout(() => dismiss(toast.id), TOAST_DURATION);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConnected, userId, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-[360px] items-start gap-3 rounded-[14px] border border-edge bg-surface px-4 py-3.5 shadow-lg animate-slide-in"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper-light">
            <Mail className="h-4 w-4 text-copper" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-ink">
              New email from {t.from}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-ink-mid">
              {t.subject}
            </p>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
