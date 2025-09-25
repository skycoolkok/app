import fs from 'fs/promises';
import path from 'path';

export type RecipeMeta = {
  functional: string[];
  flavor: string[];
};

let cache: Record<number, RecipeMeta> | null = null;
let loadingPromise: Promise<Record<number, RecipeMeta>> | null = null;

async function loadMeta(): Promise<Record<number, RecipeMeta>> {
  if (cache) return cache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const filePath = path.join(process.cwd(), 'data', 'recipe-meta.json');
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, RecipeMeta>;
      cache = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [Number(key), {
          functional: (value.functional ?? []).map((tag) => tag.toUpperCase()),
          flavor: (value.flavor ?? []).map((tag) => tag.toUpperCase()),
        }]),
      );
      return cache;
    } catch (error) {
      console.warn('[recipeMeta] failed to read recipe-meta.json, falling back to empty mapping', error);
      cache = {};
      return cache;
    }
  })();

  return loadingPromise;
}

export async function getRecipeMeta(): Promise<Record<number, RecipeMeta>> {
  return loadMeta();
}

export function clearRecipeMetaCache() {
  cache = null;
  loadingPromise = null;
}

