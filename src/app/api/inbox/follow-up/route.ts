import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/outlook";
import { getGoogleUserId } from "@/lib/google";
import { normalizeEmailLlmModel } from "@/lib/email-llm-models";

interface TrainingRow {
  brand_voice: string;
  tone: string;
  custom_instructions: string;
  dos: string[];
  donts: string[];
  follow_up_example: { subject: string; body: string } | null;
  sender_name: string;
  sender_title: string;
  company_name: string;
  company_description: string;
}

function buildFollowUpSystemPrompt(training: TrainingRow | null, research: string | null): string {
  const parts: string[] = [
    "You are an expert SDR writing a follow-up to an outbound email that received no response.",
    "Return ONLY a JSON object with two keys: \"subject\" and \"body\". No markdown fences, no extra text.",
    "",
    "STRICT RULES:",
    "- NEVER use: \"I wanted to follow up\", \"just checking in\", \"bumping this\", \"hope this finds you well\", \"per my last email\", \"circling back\"",
    "- Reference the original email's specific value prop or question — don't be vague",
    "- Add a NEW angle, insight, or reason to respond (not just repeating the first email)",
    "- Body: under 80 words",
    "- Subject: keep as \"Re: {original subject}\" to maintain the thread",
    "- ONE clear, low-friction CTA — a question, not a demand",
    "- Tone: direct, warm, human — never salesy or desperate",
  ];

  if (training) {
    if (training.sender_name || training.sender_title || training.company_name) {
      const sender = [training.sender_name, training.sender_title, training.company_name].filter(Boolean).join(", ");
      parts.push(`Sender: ${sender}`);
    }
    if (training.company_description) parts.push(`Company: ${training.company_description}`);
    if (training.brand_voice) parts.push(`Brand voice: ${training.brand_voice}`);
    if (training.tone) parts.push(`Tone: ${training.tone}`);
    if (training.dos?.length) parts.push(`DO: ${training.dos.join("; ")}`);
    if (training.donts?.length) parts.push(`DON'T: ${training.donts.join("; ")}`);
    if (training.custom_instructions) parts.push(`Extra instructions: ${training.custom_instructions}`);
    if (training.follow_up_example?.body) {
      parts.push(
        "",
        "Follow-up style example (match this tone and structure — do NOT copy it verbatim):",
        training.follow_up_example.subject
          ? `Subject: ${training.follow_up_example.subject}`
          : "",
        `Body:\n${training.follow_up_example.body}`,
      );
    }
  }

  if (research) {
    parts.push("", "Lead research (use to add a specific, relevant hook):", research);
  }

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const userId = (await getUserId()) ?? (await getGoogleUserId());
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!azureKey || !azureEndpoint) {
    return NextResponse.json({ error: "Azure OpenAI not configured" }, { status: 503 });
  }

  const { sequenceId, leadName, leadEmail, company, originalSubject, originalBody, research, model } = await req.json();

  if (!leadEmail || !originalSubject) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const deployment = normalizeEmailLlmModel(model);
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

  const client = new AzureOpenAI({ apiKey: azureKey, endpoint: azureEndpoint, deployment, apiVersion });

  // Fetch training config from sequence if available
  let training: TrainingRow | null = null;
  if (sequenceId) {
    const { data: seq } = await supabase
      .from("sequences")
      .select("training_config_id")
      .eq("id", sequenceId)
      .single();

    if (seq?.training_config_id) {
      const { data } = await supabase
        .from("ai_training_config")
        .select("brand_voice, tone, custom_instructions, dos, donts, follow_up_example, sender_name, sender_title, company_name, company_description")
        .eq("id", seq.training_config_id)
        .single();
      training = data as TrainingRow | null;
    }
  }

  const systemPrompt = buildFollowUpSystemPrompt(training, research || null);

  const userMessage = [
    `Lead: ${leadName ?? "Unknown"}`,
    `Email: ${leadEmail}`,
    company ? `Company: ${company}` : null,
    "",
    "Original email that received no reply:",
    `Subject: ${originalSubject}`,
    `Body:\n${originalBody}`,
    "",
    "Write a follow-up email that picks up this thread with a fresh angle.",
  ].filter((l) => l !== null).join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: deployment,
      temperature: 1,
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const subject = parsed.subject ?? `Re: ${originalSubject}`;
    const body = parsed.body ?? "";

    return NextResponse.json({ subject, body });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Follow-up generation failed" }, { status: 500 });
  }
}
