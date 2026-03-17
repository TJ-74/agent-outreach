"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useSequenceStore } from "@/store/sequences";
import SequenceApprovalPanel from "@/components/SequenceApprovalPanel";
import type { LeadPreview } from "@/app/api/sequences/preview-step/route";

export default function SequenceApprovePage() {
  const params = useParams();
  const router = useRouter();
  const sequenceId = typeof params.sequenceId === "string" ? params.sequenceId : null;

  const { fetchEnrollments, enrollments } = useSequenceStore();
  const [sequenceName, setSequenceName] = useState<string | null>(null);
  const [previews, setPreviews] = useState<LeadPreview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sequenceId) {
      setLoading(false);
      setError("Invalid sequence");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [seqRes, _] = await Promise.all([
          fetch(`/api/sequences/${sequenceId}`),
          fetchEnrollments(sequenceId),
        ]);

        if (cancelled) return;
        if (!seqRes.ok) {
          setError("Sequence not found");
          setLoading(false);
          return;
        }

        const seq = await seqRes.json();
        setSequenceName(seq.name ?? "Sequence");

        const pendingLeadIds = useSequenceStore
          .getState()
          .enrollments.filter(
            (e) => e.currentStep <= 1 && e.status !== "completed"
          )
          .map((e) => e.leadId);

        if (pendingLeadIds.length === 0) {
          setPreviews([]);
          setLoading(false);
          return;
        }

        const previewRes = await fetch("/api/sequences/preview-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequenceId, leadIds: pendingLeadIds }),
        });

        if (cancelled) return;
        const data = await previewRes.json();

        if (!previewRes.ok) {
          setError(data.error ?? "Failed to load previews");
          setLoading(false);
          return;
        }

        setPreviews(data.previews ?? []);
      } catch {
        if (!cancelled) setError("Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sequenceId, fetchEnrollments]);

  if (!sequenceId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-ink-mid">Invalid sequence.</p>
        <Link
          href="/sequences"
          className="inline-flex items-center gap-2 rounded-[10px] bg-copper px-4 py-2 text-[13px] font-semibold text-white hover:bg-copper-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sequences
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading approval queue…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-ink-mid">{error}</p>
        <Link
          href="/sequences"
          className="inline-flex items-center gap-2 rounded-[10px] bg-copper px-4 py-2 text-[13px] font-semibold text-white hover:bg-copper-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sequences
        </Link>
      </div>
    );
  }

  if (!previews || previews.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-deep">
          <Mail className="h-8 w-8 text-ink-light" />
        </div>
        <p className="font-[family-name:var(--font-display)] text-[18px] font-bold text-ink">
          No pending leads
        </p>
        <p className="text-center text-[13px] text-ink-mid">
          There are no leads waiting for step 1 of this sequence.
        </p>
        <Link
          href="/sequences"
          className="inline-flex items-center gap-2 rounded-[10px] bg-copper px-4 py-2 text-[13px] font-semibold text-white hover:bg-copper-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sequences
        </Link>
      </div>
    );
  }

  return (
    <SequenceApprovalPanel
      sequenceId={sequenceId}
      sequenceName={sequenceName ?? "Sequence"}
      previews={previews}
      onClose={() => router.push("/sequences")}
      onSequenceCompleted={() => router.push("/sequences")}
      standalone
    />
  );
}
