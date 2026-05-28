import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/outlook";
import { getGoogleUserId } from "@/lib/google";
import { researchLead } from "@/lib/brave-search";
import { normalizeEmailLlmModel } from "@/lib/email-llm-models";

async function summarizeResearch(
  client: AzureOpenAI,
  model: string,
  rawResearch: string,
  personName: string,
  email: string,
  companyName: string | undefined,
): Promise<string> {
  const domain = email.split("@")[1] ?? "";
  const identity = [
    companyName ? `company: ${companyName}` : null,
    domain ? `email domain: ${domain}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = [
    "You are a research analyst. Given raw web search results about a person and/or their company, write a clear, well-structured research brief.",
    "",
    `The person you are researching is: ${personName}${identity ? ` (${identity})` : ""}.`,
    "",
    "IMPORTANT — disambiguation rule: Some search results may be about a DIFFERENT person who happens to share the same name.",
    "Before using any result, check whether it is consistent with the known identity above (matching company name, email domain, or the same professional context).",
    "If a result is clearly about someone else (different company, different industry, mismatched location, etc.), IGNORE it entirely.",
    "If you are uncertain whether a result belongs to this person, omit it rather than include potentially wrong information.",
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
    "- Only include information you can verify from the (correctly attributed) search results. Do not fabricate.",
    '- If no useful information was found for a section, write "No information found."',
    "- Keep it concise and actionable.",
    "- Use plain text with ## for headings and - for bullet points.",
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 1,
    max_completion_tokens: 800,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: rawResearch },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? rawResearch;
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

  const { leadId, leadName, email, company, model } = await req.json();

  if (!leadId || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const rawResearch = await researchLead(leadName ?? "Unknown", email, company || undefined);

    if (rawResearch.combined === "No research found.") {
      return NextResponse.json({ research: null });
    }

    const deployment = normalizeEmailLlmModel(model);
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

    const client = new AzureOpenAI({
      apiKey: azureKey,
      endpoint: azureEndpoint,
      deployment,
      apiVersion,
    });

    const summary = await summarizeResearch(
      client,
      deployment,
      rawResearch.combined,
      leadName ?? "Unknown",
      email,
      company || undefined,
    );

    await supabase
      .from("leads")
      .update({ research: summary })
      .eq("id", leadId);

    return NextResponse.json({ research: summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Research failed" }, { status: 500 });
  }
}
