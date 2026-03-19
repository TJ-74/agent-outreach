const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastCallTime = 0;

async function braveSearch(query: string, count = 5): Promise<BraveWebResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  // Enforce minimum 1.1s gap between requests to respect rate limits
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 1100) {
    await sleep(1100 - elapsed);
  }

  const url = new URL(BRAVE_API);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));

  for (let attempt = 0; attempt < 3; attempt++) {
    lastCallTime = Date.now();

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 429) {
      // Rate limited — wait and retry
      await sleep(2000 * (attempt + 1));
      continue;
    }

    if (!res.ok) return [];

    const data = (await res.json()) as BraveSearchResponse;
    return data.web?.results ?? [];
  }

  return [];
}

function summarizeResults(results: BraveWebResult[], maxLength = 1500): string {
  const lines: string[] = [];
  for (const r of results) {
    const entry = `- ${r.title}: ${r.description}`;
    lines.push(entry);
  }
  const text = lines.join("\n");
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

export interface ResearchResult {
  personSummary: string;
  companySummary: string;
  combined: string;
}

const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "aol.com", "icloud.com", "live.com", "msn.com", "protonmail.com",
]);

async function searchWithRetries(queries: string[], perQuery = 3): Promise<BraveWebResult[]> {
  for (const q of queries) {
    const results = await braveSearch(q, perQuery);
    if (results.length > 0) return results;
  }
  return [];
}

export async function researchLead(
  name: string,
  email: string,
  company: string | undefined,
): Promise<ResearchResult> {
  const domain = email.split("@")[1] ?? "";
  const isFree = FREE_DOMAINS.has(domain);

  // --- Person search first ---
  const personQueries: string[] = [];
  if (company) {
    personQueries.push(`${name} ${company}`);
  }
  if (domain && !isFree) {
    personQueries.push(`${name} ${domain}`);
  }
  personQueries.push(`"${name}" LinkedIn`);
  personQueries.push(email);

  const personResults = await searchWithRetries(personQueries, 3);

  // --- Then company search ---
  const companyQueries: string[] = [];
  if (company) {
    companyQueries.push(`${company} company`);
    companyQueries.push(`"${company}" about`);
  }
  if (domain && !isFree) {
    companyQueries.push(`${domain}`);
    companyQueries.push(`site:${domain}`);
  }

  const companyResults = await searchWithRetries(companyQueries, 3);

  const personSummary = summarizeResults(personResults);
  const companySummary = summarizeResults(companyResults);

  const parts: string[] = [];
  if (personSummary) parts.push(`About ${name}:\n${personSummary}`);
  if (companySummary) parts.push(`About ${company || "their company"}:\n${companySummary}`);

  return {
    personSummary,
    companySummary,
    combined: parts.join("\n\n") || "No research found.",
  };
}
