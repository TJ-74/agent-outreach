"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import SequenceApprovalPanel from "@/components/SequenceApprovalPanel";
import type { LeadPreview } from "@/app/api/sequences/preview-step/route";

const APPROVAL_PAGE_SIZE = 25;

export default function SequenceApprovePage() {
  const params = useParams();
  const router = useRouter();
  const sequenceId = typeof params.sequenceId === "string" ? params.sequenceId : null;

  const [sequenceName, setSequenceName] = useState<string | null>(null);
  const [previews, setPreviews] = useState<LeadPreview[] | null>(null);
  const [approvalPage, setApprovalPage] = useState(1);
  const [totalPreviews, setTotalPreviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
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
        const seqRes = await fetch(`/api/sequences/${sequenceId}`);

        if (cancelled) return;
        if (!seqRes.ok) {
          setError("Sequence not found");
          setLoading(false);
          return;
        }

        const seq = await seqRes.json();
        setSequenceName(seq.name ?? "Sequence");
      } catch {
        if (!cancelled) setError("Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sequenceId]);

  useEffect(() => {
    if (!sequenceId) return;

    let cancelled = false;

    (async () => {
      setLoadingPage(true);
      setError(null);
      try {

        const previewRes = await fetch("/api/sequences/preview-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sequenceId,
            page: approvalPage,
            pageSize: APPROVAL_PAGE_SIZE,
          }),
        });

        if (cancelled) return;
        const data = await previewRes.json();

        if (!previewRes.ok) {
          setError(data.error ?? "Failed to load previews");
          setLoading(false);
          return;
        }

        const nextPreviews = data.previews ?? [];
        const total = data.pagination?.total ?? nextPreviews.length;
        const maxPage = Math.max(1, Math.ceil(total / APPROVAL_PAGE_SIZE));

        if (approvalPage > maxPage) {
          setApprovalPage(maxPage);
          return;
        }

        setTotalPreviews(total);
        setPreviews(nextPreviews);
      } catch {
        if (!cancelled) setError("Failed to load");
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sequenceId, approvalPage]);

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

  if (loading || (loadingPage && previews === null)) {
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

  if (!previews || (previews.length === 0 && totalPreviews === 0)) {
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
    <div className="fixed inset-x-0 top-[52px] bottom-16 overflow-hidden md:static md:h-[100dvh] md:max-h-[100dvh]">
      <SequenceApprovalPanel
        sequenceId={sequenceId}
        sequenceName={sequenceName ?? "Sequence"}
        previews={previews}
        totalPreviews={totalPreviews}
        page={approvalPage}
        pageSize={APPROVAL_PAGE_SIZE}
        loadingPage={loadingPage}
        onPageChange={setApprovalPage}
        onClose={() => router.push("/sequences")}
        onSequenceCompleted={() => router.push("/sequences")}
        standalone
      />
    </div>
  );
}
