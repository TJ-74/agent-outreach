import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface ExampleEmail {
  label: string;
  subject: string;
  body: string;
}

export type Tone =
  | "professional"
  | "casual"
  | "friendly"
  | "authoritative"
  | "witty"
  | "empathetic";

export const TONE_OPTIONS: {
  value: Tone;
  label: string;
  description: string;
}[] = [
  { value: "professional", label: "Professional", description: "Polished and business-appropriate" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "authoritative", label: "Authoritative", description: "Confident and expert" },
  { value: "witty", label: "Witty", description: "Clever with a light touch of humour" },
  { value: "empathetic", label: "Empathetic", description: "Understanding and people-first" },
];

export function getToneOption(tone: Tone) {
  return TONE_OPTIONS.find((t) => t.value === tone) ?? TONE_OPTIONS[0];
}

export interface TrainingConfig {
  id: string;
  userId: string;
  name: string;
  description: string;
  brandVoice: string;
  tone: Tone;
  customInstructions: string;
  dos: string[];
  donts: string[];
  exampleEmails: ExampleEmail[];
  senderName: string;
  senderTitle: string;
  companyName: string;
  companyDescription: string;
  createdAt: string;
  updatedAt: string;
}

interface TrainingRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  brand_voice: string;
  tone: string;
  custom_instructions: string;
  dos: string[];
  donts: string[];
  example_emails: ExampleEmail[];
  sender_name: string;
  sender_title: string;
  company_name: string;
  company_description: string;
  created_at: string;
  updated_at: string;
}

function rowToConfig(row: TrainingRow): TrainingConfig {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? "",
    description: row.description ?? "",
    brandVoice: row.brand_voice ?? "",
    tone: (row.tone as Tone) ?? "professional",
    customInstructions: row.custom_instructions ?? "",
    dos: row.dos ?? [],
    donts: row.donts ?? [],
    exampleEmails: row.example_emails ?? [],
    senderName: row.sender_name ?? "",
    senderTitle: row.sender_title ?? "",
    companyName: row.company_name ?? "",
    companyDescription: row.company_description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const olMatch = document.cookie.match(/(?:^|;\s*)ol_uid=([^;]*)/);
  if (olMatch) return decodeURIComponent(olMatch[1]);
  const ggMatch = document.cookie.match(/(?:^|;\s*)gg_uid=([^;]*)/);
  return ggMatch ? decodeURIComponent(ggMatch[1]) : null;
}

export type ConfigUpdates = Partial<
  Pick<
    TrainingConfig,
    | "name"
    | "description"
    | "brandVoice"
    | "tone"
    | "customInstructions"
    | "dos"
    | "donts"
    | "exampleEmails"
    | "senderName"
    | "senderTitle"
    | "companyName"
    | "companyDescription"
  >
>;

/** Score from 0–100 indicating how "filled in" a config is. */
export function completenessScore(c: TrainingConfig): number {
  let score = 0;
  if (c.name.trim()) score += 10;
  if (c.senderName.trim()) score += 10;
  if (c.companyName.trim()) score += 10;
  if (c.companyDescription.trim()) score += 10;
  if (c.brandVoice.trim()) score += 15;
  if (c.tone !== "professional") score += 5;
  if (c.dos.length > 0) score += 10;
  if (c.donts.length > 0) score += 10;
  if (c.customInstructions.trim()) score += 10;
  if (c.exampleEmails.length > 0) score += 10;
  return Math.min(100, score);
}

interface TrainingState {
  configs: TrainingConfig[];
  loading: boolean;
  saving: boolean;

  fetchConfigs: () => Promise<void>;
  createConfig: (name: string, description?: string) => Promise<TrainingConfig | null>;
  updateConfig: (id: string, updates: ConfigUpdates) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  duplicateConfig: (id: string) => Promise<TrainingConfig | null>;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  configs: [],
  loading: false,
  saving: false,

  fetchConfigs: async () => {
    const uid = getUserId();
    if (!uid) { set({ configs: [], loading: false }); return; }

    set({ loading: true });

    const { data, error } = await supabase
      .from("ai_training_config")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      set({ configs: (data as TrainingRow[]).map(rowToConfig), loading: false });
    } else {
      set({ loading: false });
    }
  },

  createConfig: async (name, description = "") => {
    const uid = getUserId();
    if (!uid) return null;

    const { data, error } = await supabase
      .from("ai_training_config")
      .insert({ user_id: uid, name, description })
      .select()
      .single();

    if (!error && data) {
      const config = rowToConfig(data as TrainingRow);
      set((s) => ({ configs: [config, ...s.configs] }));
      return config;
    }
    return null;
  },

  updateConfig: async (id, updates) => {
    set({ saving: true });

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.brandVoice !== undefined) dbUpdates.brand_voice = updates.brandVoice;
    if (updates.tone !== undefined) dbUpdates.tone = updates.tone;
    if (updates.customInstructions !== undefined) dbUpdates.custom_instructions = updates.customInstructions;
    if (updates.dos !== undefined) dbUpdates.dos = updates.dos;
    if (updates.donts !== undefined) dbUpdates.donts = updates.donts;
    if (updates.exampleEmails !== undefined) dbUpdates.example_emails = updates.exampleEmails;
    if (updates.senderName !== undefined) dbUpdates.sender_name = updates.senderName;
    if (updates.senderTitle !== undefined) dbUpdates.sender_title = updates.senderTitle;
    if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName;
    if (updates.companyDescription !== undefined) dbUpdates.company_description = updates.companyDescription;

    const { error } = await supabase
      .from("ai_training_config")
      .update(dbUpdates)
      .eq("id", id);

    if (!error) {
      set((s) => ({
        configs: s.configs.map((c) =>
          c.id === id
            ? { ...c, ...updates, updatedAt: dbUpdates.updated_at as string }
            : c,
        ),
        saving: false,
      }));
    } else {
      set({ saving: false });
    }
  },

  deleteConfig: async (id) => {
    const { error } = await supabase
      .from("ai_training_config")
      .delete()
      .eq("id", id);

    if (!error) {
      set((s) => ({ configs: s.configs.filter((c) => c.id !== id) }));
    }
  },

  duplicateConfig: async (id) => {
    const uid = getUserId();
    const original = get().configs.find((c) => c.id === id);
    if (!uid || !original) return null;

    const { data, error } = await supabase
      .from("ai_training_config")
      .insert({
        user_id: uid,
        name: `${original.name} (Copy)`,
        description: original.description,
        brand_voice: original.brandVoice,
        tone: original.tone,
        custom_instructions: original.customInstructions,
        dos: original.dos,
        donts: original.donts,
        example_emails: original.exampleEmails,
        sender_name: original.senderName,
        sender_title: original.senderTitle,
        company_name: original.companyName,
        company_description: original.companyDescription,
      })
      .select()
      .single();

    if (!error && data) {
      const config = rowToConfig(data as TrainingRow);
      set((s) => ({ configs: [config, ...s.configs] }));
      return config;
    }
    return null;
  },
}));
