import Link from "next/link";
import {
  Zap,
  GitBranch,
  Users,
  CheckCircle,
  Mail,
  Brain,
  ArrowRight,
  TrendingUp,
  Shield,
  Inbox,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  {
    icon: Brain,
    color: "text-copper",
    bg: "bg-copper-light",
    title: "AI-Powered Sequences",
    desc: "Claude writes personalized, research-backed emails for every prospect — automatically.",
  },
  {
    icon: Users,
    color: "text-sage",
    bg: "bg-sage-light",
    title: "Lead Management",
    desc: "Track your pipeline from first touch to closed deal with a clean, focused CRM.",
  },
  {
    icon: CheckCircle,
    color: "text-amber",
    bg: "bg-amber-light",
    title: "Human Approval Loop",
    desc: "Review and approve AI-drafted emails before they send. You stay in control.",
  },
  {
    icon: Inbox,
    color: "text-sage",
    bg: "bg-sage-light",
    title: "Unified Inbox",
    desc: "Gmail and Outlook replies land in one place. Respond without switching tabs.",
  },
  {
    icon: TrendingUp,
    color: "text-copper",
    bg: "bg-copper-light",
    title: "Pipeline Analytics",
    desc: "See exactly where leads stand and how your outreach is performing over time.",
  },
  {
    icon: Shield,
    color: "text-ink-mid",
    bg: "bg-cream-deep",
    title: "Built for Trust",
    desc: "Your data never trains models. Emails go out only when you say so.",
  },
];

const steps = [
  { num: "01", title: "Add your leads", desc: "Import via CSV or add contacts one by one." },
  { num: "02", title: "Build a sequence", desc: "Define the steps — the AI drafts each email." },
  { num: "03", title: "Review & approve", desc: "Check every message before it hits inboxes." },
  { num: "04", title: "Watch replies roll in", desc: "Track opens, replies, and next actions in one view." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream">

      {/* ── Nav ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-edge bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-copper shadow-copper">
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[-0.01em] text-ink">
              Agent Outreach
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[10px] bg-copper px-4 py-2 text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
            >
              Open App
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-24 px-6">
        {/* Subtle background gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-copper/5 blur-3xl" />
          <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-sage/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center animate-fade-up">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-copper-muted bg-copper-light px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-copper" />
            <span className="text-[12px] font-semibold text-copper">AI-Assisted Sales Outreach</span>
          </div>

          <h1 className="font-[family-name:var(--font-display)] text-[52px] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink md:text-[64px]">
            Outreach that sounds
            <br />
            <span className="text-copper">like you, at scale.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-mid">
            Agent Outreach uses AI to research your prospects and write personalized email sequences — with you in the approval seat the whole way.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-[12px] bg-copper px-7 py-3.5 text-[15px] font-bold text-white shadow-copper transition-all hover:bg-copper-hover hover:shadow-lg active:scale-[0.98]"
            >
              <GitBranch className="h-5 w-5" />
              Build Your Sequence
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[12px] border border-edge bg-surface px-7 py-3.5 text-[15px] font-semibold text-ink shadow-xs transition-all hover:border-edge-strong hover:shadow-sm active:scale-[0.98]"
            >
              Enter App
            </Link>
          </div>

          {/* Trust line */}
          <p className="mt-5 text-[12px] text-ink-light">
            No credit card · Connects with Gmail &amp; Outlook
          </p>
        </div>
      </section>

      {/* ── Product preview card ── */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-4xl animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="overflow-hidden rounded-[20px] border border-edge bg-surface shadow-lg">
            {/* Mock top bar */}
            <div className="flex items-center gap-2 border-b border-edge bg-cream px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-sage/50" />
              <span className="ml-3 text-[11px] font-medium text-ink-light">agent-outreach — Dashboard</span>
            </div>
            {/* Mock content */}
            <div className="grid grid-cols-3 gap-px bg-edge p-px sm:grid-cols-5">
              {[
                { label: "Total Leads", value: "247", color: "text-copper" },
                { label: "Sequences", value: "12", color: "text-copper" },
                { label: "Emails Sent", value: "1,840", color: "text-sage" },
                { label: "Pending", value: "3", color: "text-amber" },
                { label: "Needs Action", value: "7", color: "text-rose" },
              ].map((s) => (
                <div key={s.label} className="bg-surface p-4">
                  <p className="text-[10px] font-medium text-ink-light">{s.label}</p>
                  <p className={`font-[family-name:var(--font-display)] text-[22px] font-extrabold tracking-[-0.04em] ${s.color}`}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-px bg-edge p-px sm:grid-cols-2">
              {/* Fake pipeline bar */}
              <div className="bg-surface p-5">
                <p className="mb-3 text-[12px] font-bold text-ink">Lead Pipeline</p>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-cream-deep">
                  <div className="h-full bg-copper/70" style={{ width: "22%" }} />
                  <div className="h-full bg-amber/60" style={{ width: "28%" }} />
                  <div className="h-full bg-sage/60" style={{ width: "18%" }} />
                  <div className="h-full bg-sage" style={{ width: "20%" }} />
                  <div className="h-full bg-copper" style={{ width: "12%" }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {["New", "Contacted", "Replied", "Engaged", "Qualified"].map((l, i) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-ink-faint" />
                      <span className="text-[11px] text-ink-mid">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Fake chart */}
              <div className="bg-surface p-5">
                <p className="mb-3 text-[12px] font-bold text-ink">Emails Sent — Last 7 Days</p>
                <div className="flex items-end gap-2" style={{ height: 60 }}>
                  {[12, 8, 22, 15, 30, 18, 24].map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center justify-end">
                      <div
                        className={`w-full max-w-[28px] rounded-t-[5px] ${i === 6 ? "bg-copper" : "bg-sage/35"}`}
                        style={{ height: (h / 30) * 52 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 bg-surface border-y border-edge">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center animate-fade-up">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-copper">What's inside</p>
            <h2 className="font-[family-name:var(--font-display)] text-[34px] font-extrabold tracking-[-0.03em] text-ink">
              Everything your outreach needs
            </h2>
            <p className="mt-3 text-[15px] text-ink-mid">Built around a simple idea: great emails + human judgment = better replies.</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-[16px] border border-edge bg-cream p-6 transition-all hover:border-edge-strong hover:shadow-sm"
              >
                <div className={`mb-4 inline-flex rounded-[10px] p-2.5 ${f.bg}`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} strokeWidth={1.8} />
                </div>
                <h3 className="mb-1.5 text-[14px] font-bold text-ink">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-ink-mid">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center animate-fade-up">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sage">How it works</p>
            <h2 className="font-[family-name:var(--font-display)] text-[34px] font-extrabold tracking-[-0.03em] text-ink">
              From zero to personalized in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up" style={{ animationDelay: "60ms" }}>
            {steps.map((s, i) => (
              <div key={s.num} className="relative rounded-[16px] border border-edge bg-surface p-6 shadow-xs">
                <div className="mb-4 font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.04em] text-copper/20">
                  {s.num}
                </div>
                <h3 className="mb-1.5 text-[14px] font-bold text-ink">{s.title}</h3>
                <p className="text-[12px] leading-relaxed text-ink-mid">{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-4 w-4 text-ink-faint" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl animate-fade-up">
          <div className="relative overflow-hidden rounded-[24px] bg-charcoal px-10 py-14 text-center shadow-lg">
            {/* Glow */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-copper/20 blur-3xl" />
            </div>

            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] bg-copper shadow-copper">
              <GitBranch className="h-7 w-7 text-white" strokeWidth={2} />
            </div>

            <h2 className="font-[family-name:var(--font-display)] text-[32px] font-extrabold tracking-[-0.03em] text-white">
              Ready to start?
            </h2>
            <p className="mt-3 text-[15px] text-white/60">
              Jump into the app and build your first sequence in under five minutes.
            </p>

            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2.5 rounded-[12px] bg-copper px-8 py-3.5 text-[15px] font-bold text-white shadow-copper transition-all hover:bg-copper-hover hover:shadow-lg active:scale-[0.98]"
            >
              <Mail className="h-5 w-5" />
              Enter App &amp; Build Your Sequence
              <ArrowRight className="h-4 w-4" />
            </Link>

            <p className="mt-4 text-[12px] text-white/30">
              Connects with Gmail &amp; Outlook · No setup fee
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-edge px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-copper">
              <Zap className="h-3 w-3 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-semibold text-ink">Agent Outreach</span>
          </div>
          <p className="text-[12px] text-ink-light">v0.1.0 · AI-assisted outreach platform</p>
        </div>
      </footer>

    </div>
  );
}
