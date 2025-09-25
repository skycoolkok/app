import fs from 'fs';
import path from 'path';
import { normalizeUnit } from './nutrients';

type ConversionEntry = {
  to: string;
  factor: number;
};

type ConversionMap = Record<string, ConversionEntry>;

let cachedConversions: ConversionMap | null = null;

function normalizeKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_\u4e00-\u9fff]+/g, '');
}

function loadConversionMap(): ConversionMap {
  if (cachedConversions) {
    return cachedConversions;
  }
  const conversionsPath = path.join(process.cwd(), 'data', 'unit-conversions.json');
  try {
    const raw = fs.readFileSync(conversionsPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, ConversionEntry | number>;
    const map: ConversionMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normalizedKey = normalizeKeyPart(key);
      if (!normalizedKey) continue;
      if (typeof value === 'number') {
        const parts = normalizedKey.split('_');
        const target = parts.pop() ?? '';
        if (!target) continue;
        map[normalizedKey] = { to: target, factor: value };
      } else if (typeof value === 'object' && typeof value.factor === 'number' && typeof value.to === 'string') {
        map[normalizedKey] = {
          to: normalizeUnit(value.to) ?? normalizeKeyPart(value.to),
          factor: value.factor,
        };
      }
    }
    cachedConversions = map;
    return map;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[unit-conversions] failed to load unit-conversions.json', error);
    }
    cachedConversions = {};
    return cachedConversions;
  }
}

type LookupOptions = {
  unit: string;
  targetUnit?: string | null;
  ingredientName?: string | null;
};

function buildLookupKeys(options: LookupOptions): string[] {
  const unit = normalizeKeyPart(options.unit);
  const target = options.targetUnit ? normalizeKeyPart(options.targetUnit) : null;
  const ingredient = options.ingredientName ? normalizeKeyPart(options.ingredientName) : null;

  const keys: string[] = [];
  if (ingredient) {
    if (target) keys.push(`${ingredient}_${unit}_${target}`);
    keys.push(`${ingredient}_${unit}`);
  }
  if (target) keys.push(`${unit}_${target}`);
  keys.push(unit);
  return keys;
}

export function resolveUnitConversion(options: LookupOptions): ConversionEntry | null {
  const map = loadConversionMap();
  const keys = buildLookupKeys(options);
  const target = options.targetUnit ? normalizeKeyPart(options.targetUnit) : null;

  for (const key of keys) {
    const entry = map[key];
    if (!entry) continue;
    if (target) {
      const entryTarget = normalizeKeyPart(entry.to);
      if (entryTarget !== target) continue;
    }
    return entry;
  }
  return null;
}

export function convertUsingUnitMap(
  value: number,
  options: LookupOptions,
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const entry = resolveUnitConversion(options);
  if (!entry) {
    return null;
  }
  return value * entry.factor;
}