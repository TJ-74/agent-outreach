import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/outlook";
import { getGoogleUserId } from "@/lib/google";
import { researchLead } from "@/lib/brave-search";

interface TrainingRow {
  brand_voice: string;
  tone: string;
  custom_instructions: string;
  dos: string[];
  donts: string[];
  example_emails: { label: string; subject: string; body: string }[];
  sender_name: string;
  sender_title: string;
  company_name: string;
  company_description: string;
}

function buildSystemPrompt(t: TrainingRow, isGenerate: boolean, research?: string): string {
  const parts: string[] = [
    isGenerate
      ? "You are an AI email writing assistant. Write a personalised outreach email for the given lead."
      : "You are an AI email writing assistant. Rewrite the provided email for the given lead.",
    "Return ONLY a JSON object with two keys: \"subject\" and \"body\". No markdown fences, no extra text.",
  ];

  if (t.sender_name || t.sender_title || t.company_name) {
    const sender = [t.sender_name, t.sender_title, t.company_name].filter(Boolean).join(", ");
    parts.push(`Sender: ${sender}`);
  }
  if (t.company_description) parts.push(`Company: ${t.company_description}`);
  if (t.brand_voice) parts.push(`Brand voice: ${t.brand_voice}`);
  if (t.tone) parts.push(`Tone: ${t.tone}`);
  if (t.dos?.length) parts.push(`DO: ${t.dos.join("; ")}`);
  if (t.donts?.length) parts.push(`DON'T: ${t.donts.join("; ")}`);
  if (t.custom_instructions) parts.push(`Extra instructions: ${t.custom_instructions}`);
  if (t.example_emails?.length) {
    parts.push("Example emails for reference:");
    for (const ex of t.example_emails.slice(0, 3)) {
      parts.push(`- "${ex.label}": Subject: ${ex.subject} | Body: ${ex.body}`);
    }
  }

  if (research) {
    parts.push(
      "",
      "Use the following research about the lead and their company to personalise the email. Reference specific details where relevant:",
      research,
    );
  }

  return parts.join("\n");
}

async function summarizeResearch(
  client: AzureOpenAI,
  model: string,
  rawResearch: string,
  personName: string,
  companyName: string | undefined,
): Promise<string> {
  const prompt = [
    "You are a research analyst. Given raw web search results about a person and/or their company, write a clear, well-structured research brief.",
    "",
    "Format the output as follows:",
    `## ${personName}`,
    "Write 2-4 sentences about who this person is, their role, background, and any notable achievements.",
    "",
    `## ${companyName || "Their Company"}`,
    "Write 2-4 sentences about the company — what they do, their industry, size, notable products/services, recent news.",
    "",
    "## Key Talking Points",
    "List 3-5 bullet points that would be useful when reaching out to this person (shared interests, relevant company initiatives, pain points you can address).",
    "",
    "Rules:",
    "- Only include information you can infer from the search results. Do not fabricate.",
    "- If no useful information was found for a section, write \"No information found.\"",
    "- Keep it concise and actionable.",
    "- Use plain text with ## for headings and - for bullet points.",
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: rawResearch },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() ?? rawResearch;
  } catch {
    return rawResearch;
  }
}

export async function POST(req: NextRequest) {
  const userId = (await getUserId()) ?? (await getGoogleUserId());
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!azureKey || !azureEndpoint) {
    return NextResponse.json(
      { error: "AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT not configured" },
      { status: 503 },
    );
  }

  const {
    sequenceId,
    leadId,
    leadName,
    email,
    company,
    currentSubject,
    currentBody,
    skipResearch,
  } = await req.json();

  if (!sequenceId || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasExisting = !!(currentSubject?.trim() || currentBody?.trim());

  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
  const miniDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_MINI ?? deployment;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

  const client = new AzureOpenAI({
    apiKey: azureKey,
    endpoint: azureEndpoint,
    deployment,
    apiVersion,
  });

  // Look up the sequence's training config
  const { data: seq } = await supabase
    .from("sequences")
    .select("training_config_id")
    .eq("id", sequenceId)
    .single();

  let researchSummary: string | null = null;

  if (skipResearch && leadId) {
    // Reuse existing research from the DB — skip Brave Search entirely
    const { data: lead } = await supabase
      .from("leads")
      .select("research")
      .eq("id", leadId)
      .single();
    researchSummary = lead?.research || null;
  } else {
    // Run Brave Search + AI summary
    const rawResearch = await researchLead(leadName ?? "Unknown", email, company || undefined);
    const hasResearch = rawResearch.combined !== "No research found.";

    if (hasResearch) {
      const miniClient = new AzureOpenAI({
        apiKey: azureKey,
        endpoint: azureEndpoint,
        deployment: miniDeployment,
        apiVersion,
      });
      researchSummary = await summarizeResearch(
        miniClient,
        miniDeployment,
        rawResearch.combined,
        leadName ?? "Unknown",
        company || undefined,
      );

      if (leadId) {
        await supabase
          .from("leads")
          .update({ research: researchSummary })
          .eq("id", leadId);
      }
    }
  }

  let systemPrompt = hasExisting
    ? "You are an AI email writing assistant. Rewrite the provided email to be more personalised and engaging.\nReturn ONLY a JSON object with two keys: \"subject\" and \"body\". No markdown fences, no extra text."
    : "You are an AI email writing assistant. Write a personalised outreach email for the given lead.\nReturn ONLY a JSON object with two keys: \"subject\" and \"body\". No markdown fences, no extra text.";

  if (researchSummary) {
    systemPrompt += "\n\nUse the following research about the lead and their company to personalise the email. Reference specific details where relevant:\n" + researchSummary;
  }

  if (seq?.training_config_id) {
    const { data: training } = await supabase
      .from("ai_training_config")
      .select("*")
      .eq("id", seq.training_config_id)
      .single();

    if (training) {
      systemPrompt = buildSystemPrompt(training as TrainingRow, !hasExisting, researchSummary ?? undefined);
    }
  }

  const userLines: (string | null)[] = [
    `Lead: ${leadName ?? "Unknown"}`,
    `Email: ${email}`,
    company ? `Company: ${company}` : null,
  ];

  if (hasExisting) {
    userLines.push("", "Current email to rewrite:");
    userLines.push(`Subject: ${currentSubject ?? "(none)"}`);
    userLines.push(`Body:\n${currentBody ?? "(none)"}`);
  } else {
    userLines.push("", "Write a new outreach email for this lead. Make it personalised, concise, and compelling.");
  }

  const userMessage = userLines.filter((l) => l !== null).join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: deployment,
      temperature: 0.7,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      subject: parsed.subject ?? currentSubject ?? "",
      body: parsed.body ?? currentBody ?? "",
      research: researchSummary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "AI rewrite failed" }, { status: 500 });
  }
}
