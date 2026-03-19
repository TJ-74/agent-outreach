export function extractDomain(email: string | undefined | null): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

const FREE_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "live.com",
  "msn.com",
  "ymail.com",
  "zoho.com",
  "gmx.com",
  "fastmail.com",
]);

export function isFreeProvider(domain: string): boolean {
  return FREE_EMAIL_PROVIDERS.has(domain.toLowerCase());
}

export interface DomainCluster {
  domain: string;
  count: number;
  isFree: boolean;
}

/**
 * Groups items by their email domain and returns clusters with count >= minSize,
 * sorted by count descending. Free providers (gmail, yahoo, etc.) are flagged but
 * still included so the caller can decide how to display them.
 */
export function clusterByDomain<T>(
  items: T[],
  getEmail: (item: T) => string | undefined | null,
  minSize = 2,
): DomainCluster[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const domain = extractDomain(getEmail(item));
    if (domain) {
      map.set(domain, (map.get(domain) ?? 0) + 1);
    }
  }

  const clusters: DomainCluster[] = [];
  for (const [domain, count] of map) {
    if (count >= minSize) {
      clusters.push({ domain, count, isFree: isFreeProvider(domain) });
    }
  }

  return clusters.sort((a, b) => b.count - a.count);
}
