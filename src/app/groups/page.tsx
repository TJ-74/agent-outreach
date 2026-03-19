"use client";

import { useState, useEffect } from "react";
import { Plus, FolderOpen, Trash2, Pencil, Users, Loader2 } from "lucide-react";
import { useGroupStore, type Group } from "@/store/groups";
import GroupDetailPanel from "@/components/GroupDetailPanel";

export default function GroupsPage() {
  const { groups, loading, fetchGroups, deleteGroup } = useGroupStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const openNew = () => {
    setEditingGroup(null);
    setIsNew(true);
    setPanelOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setIsNew(false);
    setPanelOpen(true);
  };

  const handleClose = () => {
    setPanelOpen(false);
    setEditingGroup(null);
    setIsNew(false);
    fetchGroups();
  };

  if (loading && groups.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading groups…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-10 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Groups
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Organize leads into groups for sequence enrollment.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Group
        </button>
      </div>

      {/* Grid */}
      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => (
            <div
              key={group.id}
              onClick={() => openEdit(group)}
              className="animate-fade-up cursor-pointer rounded-[16px] border border-edge bg-surface p-5 shadow-xs transition-all duration-200 hover:border-edge-strong hover:shadow-sm"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                    {group.name}
                  </p>
                  {group.description && (
                    <p className="mt-1 text-[12px] text-ink-mid line-clamp-2">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-mid">
                  <Users className="h-3 w-3 text-ink-light" />
                  {group.memberCount ?? 0} member{(group.memberCount ?? 0) !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-1 border-t border-edge pt-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEdit(group)}
                  className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
                >
                  <Pencil className="h-[15px] w-[15px]" />
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                >
                  <Trash2 className="h-[15px] w-[15px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-20">
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
      )}

      {/* Detail panel */}
      {panelOpen && (
        <GroupDetailPanel
          group={editingGroup}
          isNew={isNew}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
