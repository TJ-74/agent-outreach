"use client";

import { Loader2, Trash2, X } from "lucide-react";

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmDeleteModal({
  open,
  title = "Delete item?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={loading ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-[380px] rounded-[16px] border border-edge bg-surface p-5 shadow-lg animate-fade-up">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-rose-light text-rose">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-[17px] font-bold tracking-[-0.02em] text-ink">
              {title}
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-mid">
              {description}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="cursor-pointer rounded-[7px] p-1 text-ink-light transition-colors hover:bg-cream hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="cursor-pointer rounded-[8px] border border-edge px-3.5 py-[7px] text-[12px] font-semibold text-ink-mid transition-all hover:bg-cream hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-rose px-3.5 py-[7px] text-[12px] font-semibold text-white transition-all hover:bg-rose/90 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
