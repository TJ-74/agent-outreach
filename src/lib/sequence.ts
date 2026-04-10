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
 * 1. Inlines &lt;style&gt; CSS (juice). `webResources.links: false` keeps &lt;a href&gt; as real links
 *    (otherwise web-resource-inliner can strip or replace them).
 * 2. Ensures anchor tags have explicit href + inline styles for email clients.
 * 3. Adds legacy HTML attributes Outlook needs (bgcolor, align, width, etc.).
 */
function ensureEmailAnchors(html: string): string {
  const $ = cheerio.load(html);
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) {
      $(el).replaceWith($(el).contents());
      return;
    }
    $(el).attr("href", href);
    if (!$(el).attr("style")?.includes("text-decoration")) {
      const existing = $(el).attr("style") ?? "";
      $(el).attr(
        "style",
        `${existing ? `${existing}; ` : ""}color: #0563C1; text-decoration: underline;`,
      );
    }
  });
  return $.html();
}

export function inlineEmailHtml(html: string): string {
  if (!/<[a-zA-Z][\s\S]*?>/m.test(html.trim())) return html;
  try {
    const inlined = juice(html, {
      removeStyleTags: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
      webResources: {
        links: false,
        images: true,
      },
    });
    return addOutlookAttributes(ensureEmailAnchors(inlined));
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

/** Detects HTML tags in a message body (matches preview-step / templates) */
export function bodyLooksLikeHtml(body: string): boolean {
  return /<[a-zA-Z][\s\S]*?>/m.test((body ?? "").trim());
}

/** True when TipTap / HTML editor content has no visible text */
export function isEmptyRichHtml(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length === 0;
}

/** Converts a plain-text body into minimal HTML paragraphs, preserving line breaks. */
function plainTextToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .filter((para) => para.trim().length > 0)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/**
 * Remove trailing empty block elements (<p>, <div>, <br>) from HTML so the
 * signature sits immediately after the last real line of content.
 */
function trimTrailingHtml(html: string): string {
  // Repeatedly strip a trailing empty block until nothing more can be removed
  let prev = "";
  let result = html.trimEnd();
  while (result !== prev) {
    prev = result;
    // empty <p> / <div> (may contain only whitespace, &nbsp;, or <br> tags)
    result = result
      .replace(/<(p|div)[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/\1>\s*$/i, "")
      .replace(/(<br\s*\/?>\s*){2,}$/i, "")
      .trimEnd();
  }
  return result;
}

export function appendEmailSignature(
  body: string,
  signature: string | null | undefined,
  isHtml: boolean,
): string {
  const sig = (signature ?? "").trim();
  if (!sig) return body;
  if (isHtml) {
    const cleanBody = trimTrailingHtml(body);
    const sigHtml = bodyLooksLikeHtml(sig) ? sig : sig.split("\n").join("<br/>");
    return `${cleanBody}<br/>${sigHtml}`;
  }
  // Plain-text path: only safe if the signature itself is also plain text
  if (!bodyLooksLikeHtml(sig)) {
    return `${body.replace(/\s+$/, "")}\n\n${sig}`;
  }
  // Signature has HTML (e.g. links) but body is plain — upgrade body to HTML
  const htmlBody = plainTextToHtml(body);
  return `${htmlBody}<br/>${sig}`;
}

/**
 * Merge saved signature into a generated body.
 * If the signature contains HTML (links, formatting) and the body is plain text,
 * the body is automatically upgraded to HTML so links are preserved.
 */
export function applyUserSignatureToGeneratedBody(
  body: string,
  signatureHtml: string | null | undefined,
  signatureEnabled: boolean,
): { body: string; isHtml: boolean } {
  if (!signatureEnabled || isEmptyRichHtml(signatureHtml ?? "")) {
    return { body, isHtml: bodyLooksLikeHtml(body) };
  }

  const bodyIsHtml = bodyLooksLikeHtml(body);
  const sigIsHtml = bodyLooksLikeHtml(signatureHtml ?? "");

  // If neither is HTML, concatenate as plain text
  if (!bodyIsHtml && !sigIsHtml) {
    const merged = `${body.replace(/\s+$/, "")}\n\n${(signatureHtml ?? "").trim()}`;
    return { body: merged, isHtml: false };
  }

  // One or both are HTML — ensure the body is HTML before merging
  const htmlBody = bodyIsHtml ? body : plainTextToHtml(body);
  const cleanBody = trimTrailingHtml(htmlBody);
  const sigContent = bodyLooksLikeHtml(signatureHtml ?? "")
    ? (signatureHtml ?? "").trim()
    : (signatureHtml ?? "").trim().split("\n").join("<br/>");

  const merged = `${cleanBody}<br/>${sigContent}`;
  return { body: merged, isHtml: true };
}
