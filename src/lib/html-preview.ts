export function sanitizeHtmlForPreview(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, "");
}

export function buildPreviewSrcDoc(style: string, html: string): string {
  return style + sanitizeHtmlForPreview(html);
}
