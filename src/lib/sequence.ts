import juice from "juice";
import * as cheerio from "cheerio";

interface LeadVars {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
}

const VARIABLE_KEYS: (keyof LeadVars)[] = [
  "firstName",
  "lastName",
  "email",
  "company",
  "jobTitle",
];

export function substituteTemplate(template: string, lead: LeadVars): string {
  let result = template;
  for (const key of VARIABLE_KEYS) {
    result = result.replaceAll(`{{${key}}}`, lead[key] ?? "");
  }
  return result;
}

function getStyleProp(style: string, prop: string): string | null {
  const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
  const match = style.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * After juice inlines CSS, Outlook Desktop (Word renderer) still ignores CSS
 * for backgrounds, alignment, and dimensions — it reads legacy HTML attributes
 * instead. This pass adds those attributes so Outlook renders correctly.
 */
function addOutlookAttributes(html: string): string {
  const $ = cheerio.load(html);

  // bgcolor: Outlook reads this on table elements and body
  $("body, table, tr, td, th").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const bg = getStyleProp(style, "background-color");
    if (bg && !$(el).attr("bgcolor")) $(el).attr("bgcolor", bg);
  });

  // align: Outlook reads this for horizontal alignment
  $("table, td, th, p, div, h1, h2, h3, h4, h5, h6").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const ta = getStyleProp(style, "text-align");
    if (ta && !$(el).attr("align")) $(el).attr("align", ta);
  });

  // valign: Outlook reads this for vertical alignment in cells
  $("td, th, tr").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const va = getStyleProp(style, "vertical-align");
    if (va && !$(el).attr("valign")) $(el).attr("valign", va);
  });

  // width / height: Outlook reads numeric HTML attributes on table cells
  $("table, td, th").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const w = getStyleProp(style, "width");
    if (w && !$(el).attr("width")) $(el).attr("width", w.replace("px", ""));
  });

  $("td, th, tr").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const h = getStyleProp(style, "height");
    if (h && !$(el).attr("height")) $(el).attr("height", h.replace("px", ""));
  });

  // Prevent Outlook from adding unwanted default cell spacing on tables
  $("table").each((_, el) => {
    if (!$(el).attr("cellpadding")) $(el).attr("cellpadding", "0");
    if (!$(el).attr("cellspacing")) $(el).attr("cellspacing", "0");
    if (!$(el).attr("border")) $(el).attr("border", "0");
  });

  return $.html();
}

/**
 * Prepares HTML for email delivery:
 * 1. Inlines <style> CSS into element style attributes (via juice)
 * 2. Adds legacy HTML attributes Outlook needs (bgcolor, align, width, etc.)
 */
export function inlineEmailHtml(html: string): string {
  if (!/<[a-zA-Z][\s\S]*?>/m.test(html.trim())) return html;
  try {
    const inlined = juice(html, {
      removeStyleTags: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
    });
    return addOutlookAttributes(inlined);
  } catch {
    return html;
  }
}

export function dbLeadToVars(row: {
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  job_title?: string;
}): LeadVars {
  return {
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    company: row.company ?? "",
    jobTitle: row.job_title ?? "",
  };
}
