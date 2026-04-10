/**
 * Azure OpenAI deployment names. Each must exist in your Azure resource
 * (create deployments with these exact names, or change this list to match yours).
 */
export const EMAIL_LLM_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Fastest" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", hint: "Fast, GPT-5 family" },
  { id: "gpt-4o", label: "GPT-4o", hint: "Balanced" },
  { id: "gpt-5.3-chat", label: "GPT-5.3 Chat", hint: "Highest quality, slower" },
] as const;

export type EmailLlmModelId = (typeof EMAIL_LLM_MODELS)[number]["id"];

export const DEFAULT_EMAIL_LLM_MODEL: EmailLlmModelId = "gpt-4o";

const ALLOWED = new Set<string>(EMAIL_LLM_MODELS.map((m) => m.id));

export function isAllowedEmailLlmModel(id: string): id is EmailLlmModelId {
  return ALLOWED.has(id);
}

export function normalizeEmailLlmModel(id: unknown): EmailLlmModelId {
  if (typeof id === "string") {
    const t = id.trim();
    if (isAllowedEmailLlmModel(t)) return t;
  }
  return DEFAULT_EMAIL_LLM_MODEL;
}
