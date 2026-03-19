"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Clock,
  Mail,
  Save,
  Eye,
  PenLine,
  Users,
  FolderOpen,
  UserMinus,
  Send,
  Play,
  Pause,
  Code2,
  AlignLeft,
  AlertTriangle,
  Brain,
} from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import {
  useSequenceStore,
  type Sequence,
  type SequenceStep,
  type SequenceStatus,
} from "@/store/sequences";
import { useGroupStore } from "@/store/groups";
import { useLeadStore } from "@/store/leads";
import { useTrainingStore, getToneOption } from "@/store/training";
import { clusterByDomain } from "@/lib/domain";

interface Props {
  sequence: Sequence | null;
  isNew?: boolean;
  onClose: () => void;
}

const VARIABLES = [
  { key: "firstName", label: "First Name", sample: "Jane" },
  { key: "lastName", label: "Last Name", sample: "Doe" },
  { key: "email", label: "Email", sample: "jane@acme.com" },
  { key: "company", label: "Company", sample: "Acme Corp" },
  { key: "jobTitle", label: "Job Title", sample: "VP of Sales" },
];


function renderPreview(template: string): string {
  let result = template;
  for (const v of VARIABLES) {
    result = result.replaceAll(`{{${v.key}}}`, v.sample);
  }
  return result;
}

function looksLikeHtml(content: string): boolean {
  return /<[a-zA-Z][\s\S]*?>/m.test(content.trim());
}

const IFRAME_FONT_STYLE = `<style>*{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif!important}body{margin:0;padding:0;font-size:13px;line-height:1.7;color:#2C2925}</style>`;

function HtmlPreview({ html, className }: { html: string; className?: string }) {
  return (
    <iframe
      srcDoc={IFRAME_FONT_STYLE + html}
      sandbox="allow-same-origin"
      className={className}
      style={{ border: "none", width: "100%", display: "block" }}
      onLoad={(e) => {
        const iframe = e.currentTarget;
        const doc = iframe.contentDocument;
        if (doc) {
          iframe.style.height = doc.documentElement.scrollHeight + "px";
        }
      }}
    />
  );
}

export default function SequenceBuilder({ sequence, isNew, onClose }: Props) {
  const {
    steps,
    enrollments,
    fetchSteps,
    fetchEnrollments,
    addStep,
    updateStep,
    removeStep,
    reorderSteps,
    createSequence,
    updateSequence,
    unenrollLead,
    bulkEnroll,
  } = useSequenceStore();

  const { groups, fetchGroups } = useGroupStore();
  const { members, fetchMembers } = useGroupStore();
  const leads = useLeadStore((s) => s.leads);
  const fetchLeads = useLeadStore((s) => s.fetchLeads);
  const { configs: trainingConfigs, fetchConfigs: fetchTrainingConfigs } = useTrainingStore();

  const [name, setName] = useState(sequence?.name ?? "");
  const [description, setDescription] = useState(sequence?.description ?? "");
  const [status, setStatus] = useState<SequenceStatus>(sequence?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [seqId, setSeqId] = useState<string | null>(sequence?.id ?? null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(sequence?.groupId ?? null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(sequence?.trainingConfigId ?? null);
  const [assigning, setAssigning] = useState(false);
  const [enrollTab, setEnrollTab] = useState<"sent" | "pending">("pending");
  const [mainTab, setMainTab] = useState<"audience" | "steps">("audience");

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [previewStepId, setPreviewStepId] = useState<string | null>(null);

  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [stepDelay, setStepDelay] = useState(0);
  const [stepBodyIsHtml, setStepBodyIsHtml] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedRef = useRef<"subject" | "body">("body");

  useEffect(() => {
    fetchGroups();
    fetchLeads();
    fetchTrainingConfigs();
  }, [fetchGroups, fetchLeads, fetchTrainingConfigs]);

  useEffect(() => {
    if (sequence?.id) {
      fetchSteps(sequence.id);
      fetchEnrollments(sequence.id);
    }
  }, [sequence?.id, fetchSteps, fetchEnrollments]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchMembers(selectedGroupId);
    }
  }, [selectedGroupId, fetchMembers]);

  const handleSaveSequence = async () => {
    if (!name.trim()) return;
    setSaving(true);

    if (isNew && !seqId) {
      const created = await createSequence(name, description);
      if (created) {
        setSeqId(created.id);
        if (status !== "draft") {
          await updateSequence(created.id, { status });
        }
      }
    } else if (seqId) {
      await updateSequence(seqId, { name, description, status });
    }

    setSaving(false);
    onClose();
  };

  const router = useRouter();
  const [executing, setExecuting] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const handlePlayPause = async () => {
    if (!seqId) return;

    if (status === "active") {
      setStatus("paused");
      await updateSequence(seqId, { status: "paused" });
    } else {
      setStatus("active");
      await updateSequence(seqId, { status: "active" });

      if (steps.length >= 1 && enrollments.length > 0) {
        const pendingCount = enrollments.filter(
          (e) => e.currentStep <= 1 && e.status !== "completed"
        ).length;
        if (pendingCount > 0) {
          router.push(`/sequences/${seqId}/approve`);
          return;
        }
        setSendResult("No pending leads to send");
      }
    }
  };

  const handleAssignGroup = async () => {
    if (!seqId || !selectedGroupId) return;
    setAssigning(true);
    setSendResult(null);

    await updateSequence(seqId, { groupId: selectedGroupId });

    await fetchMembers(selectedGroupId);
    const memberLeadIds = useGroupStore.getState().members.map((m) => m.leadId);
    if (memberLeadIds.length > 0) {
      await bulkEnroll(seqId, memberLeadIds);

      if (status === "active" && steps.length >= 1) {
        router.push(`/sequences/${seqId}/approve`);
        await fetchEnrollments(seqId);
      }
    }

    setAssigning(false);
  };

  const handleRemoveGroup = async () => {
    if (!seqId) return;
    await updateSequence(seqId, { groupId: null });
    setSelectedGroupId(null);
  };

  const domainClusters = useMemo(
    () => clusterByDomain(members, (m) => m.leadEmail).filter((c) => !c.isFree),
    [members],
  );

  const enrolledLeadMap = new Map(
    leads.map((l) => [l.id, l])
  );

  const handleAddStep = async () => {
    const id = seqId;
    if (!id) return;

    await addStep(id, {
      stepOrder: steps.length + 1,
      delayDays: steps.length === 0 ? 0 : 3,
      subjectTemplate: "",
      bodyTemplate: "",
    });
  };

  const startEditStep = (step: SequenceStep) => {
    setEditingStepId(step.id);
    setStepSubject(step.subjectTemplate);
    setStepBody(step.bodyTemplate);
    setStepDelay(step.delayDays);
    setStepBodyIsHtml(looksLikeHtml(step.bodyTemplate));
    setPreviewStepId(null);
  };

  const handleSaveStep = async () => {
    if (!editingStepId) return;
    await updateStep(editingStepId, {
      subjectTemplate: stepSubject,
      bodyTemplate: stepBody,
      delayDays: stepDelay,
    });
    setEditingStepId(null);
  };

  const handleMoveStep = async (stepId: string, direction: "up" | "down") => {
    if (!seqId) return;
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= steps.length) return;

    const newOrder = steps.map((s) => s.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await reorderSteps(seqId, newOrder);
  };

  const insertVariable = useCallback((varKey: string) => {
    const tag = `{{${varKey}}}`;
    if (lastFocusedRef.current === "subject") {
      const el = subjectRef.current;
      if (el) {
        const start = el.selectionStart ?? stepSubject.length;
        const end = el.selectionEnd ?? start;
        const next = stepSubject.slice(0, start) + tag + stepSubject.slice(end);
        setStepSubject(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + tag.length, start + tag.length);
        });
      }
    } else {
      const el = bodyRef.current;
      if (el) {
        const start = el.selectionStart ?? stepBody.length;
        const end = el.selectionEnd ?? start;
        const next = stepBody.slice(0, start) + tag + stepBody.slice(end);
        setStepBody(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + tag.length, start + tag.length);
        });
      }
    }
  }, [stepSubject, stepBody]);

  const cumulativeDay = (index: number) => {
    let total = 0;
    for (let i = 0; i <= index; i++) total += steps[i].delayDays;
    return total;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/10 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 flex h-full w-[75vw] min-w-[540px] flex-col bg-surface shadow-lg animate-slide-in">
        {/* Header */}
        <div className="border-b border-edge px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sequence name..."
                className="w-full bg-transparent font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em] text-ink placeholder:text-ink-light outline-none"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="mt-1.5 w-full bg-transparent text-[13px] text-ink-mid placeholder:text-ink-light outline-none"
              />
            </div>
            <div className="flex items-center gap-2 ml-4">
              {seqId && status !== "completed" && (
                <button
                  onClick={handlePlayPause}
                  disabled={executing || !seqId}
                  title={status === "active" ? "Pause sequence" : "Activate & send"}
                  className={`cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-[7px] text-[12px] font-semibold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 ${
                    status === "active"
                      ? "bg-amber text-white hover:bg-amber/90"
                      : "bg-sage text-white hover:bg-sage/90"
                  }`}
                >
                  {executing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : status === "active" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {status === "active" ? "Pause" : "Start"}
                </button>
              )}
              {status === "completed" && (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-copper-light px-3.5 py-[7px] text-[12px] font-semibold text-copper">
                  Completed
                </span>
              )}
              <button
                onClick={handleSaveSequence}
                disabled={saving || !name.trim()}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3.5 py-[7px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
              <button onClick={onClose} className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          {seqId && (
            <div className="mt-5 flex gap-1 rounded-[10px] border border-edge bg-cream p-[3px]">
              <button
                onClick={() => setMainTab("audience")}
                className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[7px] text-[12px] font-semibold transition-all ${
                  mainTab === "audience"
                    ? "bg-surface text-copper shadow-xs"
                    : "text-ink-mid hover:text-ink"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Audience & Training
              </button>
              <button
                onClick={() => setMainTab("steps")}
                className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[7px] text-[12px] font-semibold transition-all ${
                  mainTab === "steps"
                    ? "bg-surface text-copper shadow-xs"
                    : "text-ink-mid hover:text-ink"
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Email Steps
                {steps.length > 0 && (
                  <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-bold ${
                    mainTab === "steps" ? "bg-copper-light text-copper" : "bg-cream-deep text-ink-light"
                  }`}>
                    {steps.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ══ Audience & Training tab ══ */}
        {seqId && mainTab === "audience" && (
          <div className="flex-1 overflow-y-auto">
            {/* Group Selector */}
            <div className="border-b border-edge px-8 py-5">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                Assign Group
              </p>

              <div className="flex items-center gap-2">
                <CustomSelect
                  value={selectedGroupId ?? ""}
                  onChange={(val) => setSelectedGroupId(val || null)}
                  placeholder="Select a group..."
                  className="flex-1"
                  options={[
                    { value: "", label: "Select a group..." },
                    ...groups.map((g) => ({
                      value: g.id,
                      label: `${g.name} (${g.memberCount ?? 0} members)`,
                    })),
                  ]}
                />

                <button
                  onClick={handleAssignGroup}
                  disabled={!selectedGroupId || assigning}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-sage px-3.5 py-[8px] text-[12px] font-semibold text-white transition-all hover:bg-sage/90 disabled:opacity-40"
                >
                  {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                  Assign
                </button>

                {sequence?.groupId && (
                  <button
                    onClick={handleRemoveGroup}
                    className="cursor-pointer rounded-[8px] p-[8px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                    title="Remove group"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {sequence?.groupId && (
                <div className="mt-2 flex items-center gap-1.5">
                  <FolderOpen className="h-3 w-3 text-copper" />
                  <span className="text-[11px] font-medium text-copper">
                    {groups.find((g) => g.id === sequence.groupId)?.name ?? "Group"}
                  </span>
                </div>
              )}

              {domainClusters.length > 0 && (selectedGroupId || sequence?.groupId) && (
                <div className="mt-2.5 flex items-start gap-2 rounded-[8px] border border-amber/30 bg-amber-light/30 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber">
                      Multiple contacts at the same organization
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {domainClusters.map((c) => (
                        <span
                          key={c.domain}
                          className="inline-flex items-center gap-1 rounded-full border border-amber/25 bg-surface px-1.5 py-[1px] text-[10px] font-medium text-ink-mid"
                        >
                          <span className="font-semibold text-amber">{c.count}</span>
                          @{c.domain}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-ink-light">
                      Review emails individually in the approval step to avoid looking templated.
                    </p>
                  </div>
                </div>
              )}

              {sendResult && (
                <div className="mt-2 rounded-[8px] bg-sage-light px-3 py-2 text-[12px] font-medium text-sage">
                  {sendResult}
                </div>
              )}

              {/* Enrolled leads -- tabbed sent / pending */}
              {enrollments.length > 0 && (() => {
                const groupLeadIds = new Set(members.map((m) => m.leadId));
                const groupEnrollments = selectedGroupId || sequence?.groupId
                  ? enrollments.filter((e) => groupLeadIds.has(e.leadId))
                  : enrollments;

                const sentEnrollments = groupEnrollments.filter((e) => e.currentStep > 1 || e.status === "completed");
                const pendingEnrollments = groupEnrollments.filter((e) => e.currentStep <= 1 && e.status !== "completed");
                const stepByOrder = new Map(steps.map((s) => [s.stepOrder, s]));

                const activeList = enrollTab === "sent" ? sentEnrollments : pendingEnrollments;

                const renderRow = (enrollment: typeof enrollments[number]) => {
                  const lead = enrolledLeadMap.get(enrollment.leadId);
                  const isSent = enrollment.currentStep > 1 || enrollment.status === "completed";

                  let stepLabel = "";
                  if (isSent) {
                    const lastSentStep = stepByOrder.get(enrollment.currentStep - 1);
                    stepLabel = enrollment.status === "completed"
                      ? `Step ${enrollment.currentStep - 1}: ${lastSentStep?.subjectTemplate || "Completed"}`
                      : `Step ${enrollment.currentStep - 1}: ${lastSentStep?.subjectTemplate || "(No subject)"}`;
                  } else {
                    const nextStep = stepByOrder.get(enrollment.currentStep);
                    stepLabel = `Step ${enrollment.currentStep}: ${nextStep?.subjectTemplate || "(No subject)"}`;
                  }

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between border-b border-edge px-3 py-2.5 last:border-b-0 transition-colors hover:bg-cream/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-ink">
                          {lead ? `${lead.firstName} ${lead.lastName}` : "Unknown Lead"}
                        </p>
                        <p className="truncate text-[11px] text-ink-mid">
                          {lead?.email ?? enrollment.leadId}
                        </p>
                        <p className={`mt-0.5 truncate text-[10px] font-medium ${isSent ? "text-sage" : "text-amber"}`}>
                          {stepLabel}{enrollment.status === "completed" ? " (done)" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => unenrollLead(enrollment.id)}
                        className="ml-2 cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                        title="Unenroll"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                };

                return (
                  <div className="mt-4">
                    <div className="flex rounded-[8px] border border-edge bg-cream p-[3px]">
                      <button
                        onClick={() => setEnrollTab("sent")}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] py-[6px] text-[12px] font-semibold transition-all ${
                          enrollTab === "sent"
                            ? "bg-surface text-sage shadow-xs"
                            : "text-ink-mid hover:text-ink"
                        }`}
                      >
                        <Send className="h-3 w-3" />
                        Sent ({sentEnrollments.length})
                      </button>
                      <button
                        onClick={() => setEnrollTab("pending")}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] py-[6px] text-[12px] font-semibold transition-all ${
                          enrollTab === "pending"
                            ? "bg-surface text-amber shadow-xs"
                            : "text-ink-mid hover:text-ink"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        Pending ({pendingEnrollments.length})
                      </button>
                    </div>

                    {activeList.length > 0 ? (
                      <div className={`mt-2 max-h-[200px] overflow-y-auto rounded-[10px] border ${
                        enrollTab === "sent" ? "border-sage/20 bg-sage-light/20" : "border-amber/20 bg-amber-light/20"
                      }`}>
                        {activeList.map(renderRow)}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-[10px] border border-dashed border-edge-strong py-6 text-center">
                        <p className="text-[12px] text-ink-mid">
                          {enrollTab === "sent" ? "No emails sent yet" : "All caught up -- nothing pending"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* AI Training Config Selector */}
            <div className="border-b border-edge px-8 py-5">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                AI Training Profile
              </p>

              <div className="flex items-center gap-2">
                <CustomSelect
                  value={selectedTrainingId ?? ""}
                  onChange={(val) => {
                    const v = val || null;
                    setSelectedTrainingId(v);
                    if (seqId) updateSequence(seqId, { trainingConfigId: v });
                  }}
                  placeholder="No training profile"
                  className="flex-1"
                  options={[
                    { value: "", label: "No training profile" },
                    ...trainingConfigs.map((tc) => {
                      const tone = getToneOption(tc.tone);
                      return {
                        value: tc.id,
                        label: `${tc.name} (${tone.label})`,
                      };
                    }),
                  ]}
                />

                {selectedTrainingId && (
                  <button
                    onClick={() => {
                      setSelectedTrainingId(null);
                      if (seqId) updateSequence(seqId, { trainingConfigId: null });
                    }}
                    className="cursor-pointer rounded-[8px] p-[8px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                    title="Remove training"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {selectedTrainingId && (() => {
                const tc = trainingConfigs.find((c) => c.id === selectedTrainingId);
                if (!tc) return null;
                const tone = getToneOption(tc.tone);
                return (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Brain className="h-3 w-3 text-copper" />
                    <span className="text-[11px] font-medium text-copper">
                      {tc.name}
                    </span>
                    <span className="text-[11px] text-ink-light">
                      · {tone.label}
                      {tc.dos.length + tc.donts.length > 0 && ` · ${tc.dos.length + tc.donts.length} rules`}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ══ Email Steps tab ══ */}
        {seqId && mainTab === "steps" && (
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="rounded-[14px] bg-cream-deep p-5">
                <Mail className="h-7 w-7 text-ink-light" />
              </div>
              <p className="mt-5 font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                No steps yet
              </p>
              <p className="mt-1 text-center text-[13px] text-ink-mid">
                Add the first email step to your sequence.
              </p>
              <button
                onClick={handleAddStep}
                className="mt-5 cursor-pointer inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-[9px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add First Step
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {steps.map((step, idx) => {
                const isEditing = editingStepId === step.id;
                const isPreviewing = previewStepId === step.id;
                const day = cumulativeDay(idx);

                return (
                  <div key={step.id} className="relative">
                    {/* Timeline connector */}
                    {idx > 0 && (
                      <div className="ml-[19px] h-8 w-[2px] bg-edge" />
                    )}

                    <div className="flex gap-4">
                      {/* Timeline dot + day */}
                      <div className="flex flex-col items-center pt-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold ${
                          isEditing ? "border-copper bg-copper-light text-copper" : "border-edge bg-surface text-ink-mid"
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="mt-1 whitespace-nowrap text-[10px] font-semibold text-ink-light">
                          Day {day}
                        </span>
                      </div>

                      {/* Step card */}
                      <div className={`flex-1 rounded-[12px] border bg-surface shadow-xs transition-colors ${
                        isEditing ? "border-copper/40" : "border-edge"
                      }`}>
                        {isEditing ? (
                          /* ── Edit mode ── */
                          <div className="p-4 space-y-3">
                            {/* Delay */}
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-ink-light" />
                              <span className="text-[11px] font-semibold text-ink-mid">Wait</span>
                              <input
                                type="number"
                                min={0}
                                value={stepDelay}
                                onChange={(e) => setStepDelay(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 rounded-[6px] border border-edge bg-cream px-2 py-1 text-center text-[12px] text-ink outline-none focus:border-copper"
                              />
                              <span className="text-[11px] text-ink-mid">days before sending</span>
                            </div>

                            {/* Subject */}
                            <input
                              ref={subjectRef}
                              type="text"
                              value={stepSubject}
                              onChange={(e) => setStepSubject(e.target.value)}
                              onFocus={() => { lastFocusedRef.current = "subject"; }}
                              placeholder="Subject line..."
                              className="w-full rounded-[8px] border border-edge bg-surface px-3.5 py-[8px] text-[13px] font-semibold text-ink placeholder:text-ink-light outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light"
                            />

                            {/* Body */}
                            <div>
                              {/* Mode toggle */}
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                                  Body
                                </span>
                                <div className="flex items-center rounded-[6px] border border-edge bg-cream p-[2px] gap-[2px]">
                                  <button
                                    type="button"
                                    onClick={() => setStepBodyIsHtml(false)}
                                    className={`cursor-pointer inline-flex items-center gap-1 rounded-[4px] px-2 py-[3px] text-[11px] font-medium transition-all ${
                                      !stepBodyIsHtml
                                        ? "bg-surface text-ink shadow-xs"
                                        : "text-ink-light hover:text-ink-mid"
                                    }`}
                                  >
                                    <AlignLeft className="h-3 w-3" />
                                    Plain Text
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setStepBodyIsHtml(true)}
                                    className={`cursor-pointer inline-flex items-center gap-1 rounded-[4px] px-2 py-[3px] text-[11px] font-medium transition-all ${
                                      stepBodyIsHtml
                                        ? "bg-surface text-copper shadow-xs"
                                        : "text-ink-light hover:text-ink-mid"
                                    }`}
                                  >
                                    <Code2 className="h-3 w-3" />
                                    HTML
                                  </button>
                                </div>
                              </div>
                              <textarea
                                ref={bodyRef}
                                value={stepBody}
                                onChange={(e) => setStepBody(e.target.value)}
                                onFocus={() => { lastFocusedRef.current = "body"; }}
                                placeholder={stepBodyIsHtml ? "Paste or write your HTML template here..." : "Email body..."}
                                rows={stepBodyIsHtml ? 10 : 6}
                                className={`w-full resize-y rounded-[8px] border border-edge bg-surface px-3.5 py-2.5 text-[13px] leading-[1.65] text-ink placeholder:text-ink-light outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light ${
                                  stepBodyIsHtml ? "font-mono text-[12px]" : ""
                                }`}
                              />
                            </div>

                            {/* Variable pills */}
                            <div>
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                                Insert Variable
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {VARIABLES.map((v) => (
                                  <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => insertVariable(v.key)}
                                    className="cursor-pointer rounded-full border border-edge bg-cream px-2.5 py-[4px] text-[11px] font-medium text-ink-mid transition-all hover:border-copper hover:bg-copper-light hover:text-copper"
                                  >
                                    {`{{${v.key}}}`}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Preview toggle */}
                            {(stepSubject || stepBody) && (
                              <div className="rounded-[8px] border border-dashed border-edge bg-cream/50 p-3">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                                  Live Preview
                                </p>
                                {stepSubject && (
                                  <p className="text-[12px] font-semibold text-ink">
                                    {renderPreview(stepSubject)}
                                  </p>
                                )}
                                {stepBody && (
                                  stepBodyIsHtml ? (
                                    <div className="mt-2 overflow-hidden rounded-[6px] border border-edge bg-white">
                                      <HtmlPreview html={renderPreview(stepBody)} />
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-[12px] leading-[1.6] text-ink-mid whitespace-pre-wrap">
                                      {renderPreview(stepBody)}
                                    </p>
                                  )
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingStepId(null)}
                                className="cursor-pointer rounded-[8px] px-3 py-[5px] text-[12px] font-medium text-ink-mid hover:bg-cream"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveStep}
                                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-ink px-3.5 py-[5px] text-[12px] font-semibold text-white transition-all hover:bg-ink/90"
                              >
                                Save Step
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── Read mode ── */
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1 overflow-hidden">
                                {step.delayDays > 0 && (
                                  <div className="mb-2 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-ink-light" />
                                    <span className="text-[11px] text-ink-light">
                                      {step.delayDays} day{step.delayDays !== 1 ? "s" : ""} after previous
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-[13px] font-semibold text-ink">
                                    {step.subjectTemplate || "(No subject)"}
                                  </p>
                                  {looksLikeHtml(step.bodyTemplate) && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-copper/30 bg-copper-light px-1.5 py-[1px] text-[10px] font-semibold text-copper">
                                      <Code2 className="h-2.5 w-2.5" />
                                      HTML
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[12px] leading-[1.5] text-ink-mid line-clamp-2 break-words overflow-hidden">
                                  {looksLikeHtml(step.bodyTemplate)
                                    ? (step.bodyTemplate
                                        .replace(/<style[\s\S]*?<\/style>/gi, "")
                                        .replace(/<[^>]+>/g, " ")
                                        .replace(/&[a-z]+;/gi, " ")
                                        .replace(/\s+/g, " ")
                                        .trim()
                                        .slice(0, 200)) || "(HTML template)"
                                    : step.bodyTemplate || "(No body)"}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5 ml-3">
                                {steps.length > 1 && (
                                  <>
                                    <button
                                      onClick={() => handleMoveStep(step.id, "up")}
                                      disabled={idx === 0}
                                      className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid disabled:opacity-30"
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveStep(step.id, "down")}
                                      disabled={idx === steps.length - 1}
                                      className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid disabled:opacity-30"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setPreviewStepId(isPreviewing ? null : step.id)}
                                  className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => startEditStep(step)}
                                  className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
                                >
                                  <PenLine className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => removeStep(step.id)}
                                  className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Inline preview */}
                            {isPreviewing && (step.subjectTemplate || step.bodyTemplate) && (
                              <div className="mt-3 rounded-[8px] border border-dashed border-edge bg-cream/50 p-3">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                                  Preview with sample data
                                </p>
                                {step.subjectTemplate && (
                                  <p className="text-[12px] font-semibold text-ink">
                                    {renderPreview(step.subjectTemplate)}
                                  </p>
                                )}
                                {step.bodyTemplate && (
                                  looksLikeHtml(step.bodyTemplate) ? (
                                    <div className="mt-2 overflow-hidden rounded-[6px] border border-edge bg-white">
                                      <HtmlPreview html={renderPreview(step.bodyTemplate)} />
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-[12px] leading-[1.6] text-ink-mid whitespace-pre-wrap">
                                      {renderPreview(step.bodyTemplate)}
                                    </p>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add step button */}
              {seqId && (
                <div className="relative">
                  <div className="ml-[19px] h-8 w-[2px] bg-edge" />
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <button
                        onClick={handleAddStep}
                        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-edge-strong text-ink-light transition-all hover:border-copper hover:bg-copper-light hover:text-copper"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={handleAddStep}
                      className="cursor-pointer self-center text-[13px] font-medium text-ink-mid transition-colors hover:text-copper"
                    >
                      Add another step
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Pre-save empty state (no tabs yet) */}
        {!seqId && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="rounded-[14px] bg-cream-deep p-5">
                <Mail className="h-7 w-7 text-ink-light" />
              </div>
              <p className="mt-5 font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                Save to get started
              </p>
              <p className="mt-1 text-center text-[13px] text-ink-mid">
                Enter a name and save the sequence first, then configure audience and email steps.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
