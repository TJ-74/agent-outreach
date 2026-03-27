"use client";

import { type ActionNeeded } from "@/store/leads";
import clsx from "clsx";

const variants: Record<
  Exclude<ActionNeeded, "none">,
  { label: string; bg: string; text: string; ring: string; dot: string }
> = {
  needs_reply: {
    label: "Needs Reply",
    bg: "bg-amber-light",
    text: "text-amber",
    ring: "ring-amber/30",
    dot: "bg-amber",
  },
  waiting_for_reply: {
    label: "Waiting",
    bg: "bg-cream-deep",
    text: "text-ink-mid",
    ring: "ring-edge",
    dot: "bg-ink-light",
  },
  needs_human: {
    label: "Needs Human",
    bg: "bg-copper-light",
    text: "text-copper",
    ring: "ring-copper/30",
    dot: "bg-copper",
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
