export const SUPABASE_PAGE_SIZE = 1000;
export const SUPABASE_IN_FILTER_CHUNK_SIZE = 500;
export const SUPABASE_WRITE_CHUNK_SIZE = 500;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
