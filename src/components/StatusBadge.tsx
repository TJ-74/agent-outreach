"use client";

import { type ActionNeeded } from "@/store/leads";
import clsx from "clsx";

const variants: Record<
  Exclude<ActionNeeded, "none">,
  { label: string; bg: string; text: string; ring: string; dot: string }
> = {
  needs_reply: {
    label: "Needs Reply",
    bg: "bg-orange-50",
    text: "text-orange-600",
    ring: "ring-orange-200",
    dot: "bg-orange-500",
  },
  waiting_for_reply: {
    label: "Waiting",
    bg: "bg-slate-50",
    text: "text-slate-500",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
  },
  needs_human: {
    label: "Needs Human",
    bg: "bg-violet-50",
    text: "text-violet-600",
    ring: "ring-violet-200",
    dot: "bg-violet-500",
  },
};

export default function ActionBadge({ action }: { action: ActionNeeded }) {
  if (action === "none") {
    return (
      <span className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] text-[11px] font-medium text-ink-light ring-1 ring-inset ring-edge bg-cream-deep">
        —
      </span>
    );
  }

  const v = variants[action];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold tracking-[0.01em] ring-1 ring-inset",
        v.bg,
        v.text,
        v.ring
      )}
    >
      <span className={clsx("h-[5px] w-[5px] rounded-full", v.dot)} />
      {v.label}
    </span>
  );
}
