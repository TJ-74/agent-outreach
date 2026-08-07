"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Trash2, Pencil, Users, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useGroupStore, type Group } from "@/store/groups";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import clsx from "clsx";

const GROUPS_PAGE_SIZE = 12;

export default function GroupsPage() {
  const router = useRouter();
  const { groups, loading, fetchGroups, deleteGroup } = useGroupStore();
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PAGE_SIZE));
  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * GROUPS_PAGE_SIZE;
    return groups.slice(start, start + GROUPS_PAGE_SIZE);
  }, [groups, page]);
  const rangeStart = groups.length === 0 ? 0 : (page - 1) * GROUPS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * GROUPS_PAGE_SIZE, groups.length);
  const totalMembers = groups.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const openNew = () => router.push("/groups/new");
  const openEdit = (group: Group) => router.push(`/groups/${group.id}`);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const ok = await deleteGroup(deleteTarget.id);
    setDeleting(false);
    if (!ok) {
      setActionError(`Could not delete “${deleteTarget.name}”. Try again.`);
      return;
    }
    setDeleteTarget(null);
  };

  if (loading && groups.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading groups…</p>
      </div>
    );
  }

  const renderGroupCard = (group: Group, i: number, compact?: boolean) => (
    <div
      key={group.id}
      onClick={() => openEdit(group)}
      className={clsx(
        "animate-fade-up cursor-pointer rounded-[14px] border border-edge bg-surface shadow-xs transition-all duration-200 hover:border-edge-strong hover:shadow-sm",
        compact ? "p-4" : "p-5",
      )}
      style={{ animationDelay: `${i * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-copper-light">
          <FolderOpen className="h-5 w-5 text-copper" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
            {group.name}
          </p>
          {group.description && (
            <p className={clsx("mt-0.5 text-[12px] text-ink-mid", compact ? "line-clamp-1" : "line-clamp-2")}>
              {group.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-mid">
            <Users className="h-3 w-3 text-ink-light" />
            {group.memberCount ?? 0} member{(group.memberCount ?? 0) !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-edge pt-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => openEdit(group)}
          className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
          aria-label="Edit group"
        >
          <Pencil className="h-[15px] w-[15px]" />
        </button>
        <button
          onClick={() => setDeleteTarget(group)}
          className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
          aria-label="Delete group"
        >
          <Trash2 className="h-[15px] w-[15px]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden sm:block">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Groups
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Organize leads into groups for sequence enrollment.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] sm:w-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Group
        </button>
      </div>

      {actionError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-rose/30 bg-rose-light/40 px-3.5 py-2.5">
          <p className="text-[12px] text-ink-mid">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="cursor-pointer text-[11px] font-semibold text-ink-light hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {groups.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2.5 animate-fade-up sm:mb-6 sm:gap-4">
          <div className="rounded-[12px] border border-edge bg-surface px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <FolderOpen className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-light sm:text-[10px]">Groups</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-ink sm:text-[24px]">{groups.length}</p>
          </div>
          <div className="rounded-[12px] border border-copper/20 bg-copper-light/30 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Users className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-copper/70 sm:text-[10px]">Members</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-copper sm:text-[24px]">{totalMembers}</p>
          </div>
        </div>
      )}

      {groups.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {paginatedGroups.map((group, i) => renderGroupCard(group, i, true))}
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
            {paginatedGroups.map((group, i) => renderGroupCard(group, i))}
          </div>
        </>
      ) : null}

      {groups.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[12px] text-ink-mid">
            Showing <span className="font-semibold text-ink">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-semibold text-ink">{groups.length}</span> group{groups.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e${idx}`} className="px-1 text-[12px] text-ink-light">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    className={clsx(
                      "cursor-pointer rounded-[8px] px-2.5 py-[5px] text-[12px] font-semibold transition-colors",
                      page === item
                        ? "bg-copper text-white shadow-xs"
                        : "text-ink-mid hover:bg-cream hover:text-ink"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface px-4 py-16 sm:py-20">
          <div className="rounded-[14px] bg-copper-light p-5">
            <FolderOpen className="h-7 w-7 text-copper" strokeWidth={1.6} />
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
            No groups yet
          </h3>
          <p className="mt-1.5 max-w-[300px] text-center text-[13px] text-ink-mid">
            Create groups to organize leads and easily enroll them into sequences.
          </p>
          <button
            onClick={openNew}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create First Group
          </button>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete group?"
        description={`Delete "${deleteTarget?.name ?? "this group"}" and remove its memberships? This cannot be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
