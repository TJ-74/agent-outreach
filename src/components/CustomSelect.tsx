"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-[8px] border px-3 py-[8px] text-left text-[13px] outline-none transition-all",
          open
            ? "border-copper ring-[3px] ring-copper-light bg-surface"
            : "border-edge bg-surface hover:border-edge-strong",
          selected ? "text-ink" : "text-ink-light"
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 shrink-0 text-ink-light transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[240px] w-full overflow-y-auto rounded-[10px] border border-edge bg-surface py-1 shadow-lg animate-fade-up">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-2 px-3 py-[7px] text-left text-[13px] transition-colors",
                  active
                    ? "bg-copper-light/50 text-copper font-medium"
                    : "text-ink hover:bg-cream"
                )}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-copper" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-3 py-2 text-[12px] text-ink-light">No options available</p>
          )}
        </div>
      )}
    </div>
  );
}
