"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useGroupStore, type Group } from "@/store/groups";
import GroupDetailPanel from "@/components/GroupDetailPanel";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { groups, fetchGroup } = useGroupStore();
  const [group, setGroup] = useState<Group | null>(() => groups.find((g) => g.id === id) ?? null);
  const [loading, setLoading] = useState(!group);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cached = useGroupStore.getState().groups.find((g) => g.id === id);
      if (cached) {
        if (!cancelled) {
          setGroup(cached);
          setLoading(false);
          setNotFound(false);
        }
        return;
      }

      if (!cancelled) setLoading(true);
      const fetched = await fetchGroup(id);
      if (cancelled) return;

      if (fetched) {
        setGroup(fetched);
        setNotFound(false);
      } else {
        setGroup(null);
        setNotFound(true);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, fetchGroup]);

  // Keep local group in sync when store updates (e.g. after save / member count)
  useEffect(() => {
    const fromStore = groups.find((g) => g.id === id);
    if (fromStore) setGroup(fromStore);
  }, [groups, id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading group…</p>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <p className="font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
          Group not found
        </p>
        <p className="text-center text-[13px] text-ink-mid">
          It may have been deleted, or you don’t have access.
        </p>
        <Link
          href="/groups"
          className="mt-2 text-[13px] font-semibold text-copper hover:text-copper-hover"
        >
          Back to groups
        </Link>
      </div>
    );
  }

  return (
    <GroupDetailPanel
      group={group}
      variant="page"
      onClose={() => router.push("/groups")}
    />
  );
}
