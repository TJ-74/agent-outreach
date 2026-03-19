import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/outlook";
import { getGoogleUserId } from "@/lib/google";
import { researchLead } from "@/lib/brave-search";

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
    '- If no useful information was found for a section, write "No information found."',
    "- Keep it concise and actionable.",
    "- Use plain text with ## for headings and - for bullet points.",
  ].join("\n");

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

  const { leadId, leadName, email, company } = await req.json();

  if (!leadId || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const rawResearch = await researchLead(leadName ?? "Unknown", email, company || undefined);

    if (rawResearch.combined === "No research found.") {
      return NextResponse.json({ research: null });
    }

    const miniDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_MINI ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

    const client = new AzureOpenAI({
      apiKey: azureKey,
      endpoint: azureEndpoint,
      deployment: miniDeployment,
      apiVersion,
    });

    const summary = await summarizeResearch(
      client,
      miniDeployment,
      rawResearch.combined,
      leadName ?? "Unknown",
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
