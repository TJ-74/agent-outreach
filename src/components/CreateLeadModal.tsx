"use client";

import { useState, type FormEvent } from "react";
import { X, User, Building2, Mail, Linkedin, StickyNote } from "lucide-react";
import { useLeadStore, type LeadStatus } from "@/store/leads";

interface Props {
  open: boolean;
  onClose: () => void;
}

const empty = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  jobTitle: "",
  linkedIn: "",
  status: "new" as LeadStatus,
  notes: "",
  research: "",
};

export default function CreateLeadModal({ open, onClose }: Props) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const addLead = useLeadStore((s) => s.addLead);

  if (!open) return null;

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Invalid email";
    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const result = await addLead(form);
    if (result?.duplicate) {
      setErrors({ email: "A lead with this email already exists" });
      return;
    }
    setForm(empty);
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div className="animate-scale-up relative z-10 w-full max-w-[520px] rounded-[20px] border border-edge bg-surface p-8 shadow-lg">
        <div className="mb-7 flex items-start justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em] text-ink">
              New Lead
            </h2>
            <p className="mt-1 text-[13px] text-ink-mid">
              Add a contact to your outreach pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-[8px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          <Section icon={<User className="h-3.5 w-3.5" />} label="Personal">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="First Name"
                value={form.firstName}
                error={errors.firstName}
                onChange={(v) => set("firstName", v)}
                placeholder="Jane"
                required
              />
              <Field
                label="Last Name"
                value={form.lastName}
                error={errors.lastName}
                onChange={(v) => set("lastName", v)}
                placeholder="Doe"
                required
              />
            </div>
            <Field
              label="Email"
              value={form.email}
              error={errors.email}
              onChange={(v) => set("email", v)}
              placeholder="jane@company.com"
              type="email"
              icon={<Mail className="h-[15px] w-[15px]" />}
              required
            />
          </Section>

          <Section icon={<Building2 className="h-3.5 w-3.5" />} label="Company">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Company"
                value={form.company}
                onChange={(v) => set("company", v)}
                placeholder="Acme Inc."
              />
              <Field
                label="Job Title"
                value={form.jobTitle}
                onChange={(v) => set("jobTitle", v)}
                placeholder="VP of Sales"
              />
            </div>
            <Field
              label="LinkedIn"
              value={form.linkedIn}
              onChange={(v) => set("linkedIn", v)}
              placeholder="linkedin.com/in/janedoe"
              icon={<Linkedin className="h-[15px] w-[15px]" />}
            />
          </Section>

          <Section icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Personalization context for your outreach..."
              rows={3}
              className="w-full resize-none rounded-[10px] border border-edge bg-cream px-4 py-3 text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
            />
          </Section>

          <div className="flex items-center justify-end gap-3 border-t border-edge pt-6">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-[10px] border border-edge px-5 py-[10px] text-[13px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
            >
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-light">
        {icon} {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  icon,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-[6px] block text-[12px] font-medium text-ink-mid">
        {label}
        {required && <span className="ml-0.5 text-rose">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-[10px] border bg-cream px-4 py-[10px] text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light ${
            icon ? "pl-10" : ""
          } ${error ? "border-rose" : "border-edge"}`}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-rose">{error}</p>}
    </div>
  );
}
