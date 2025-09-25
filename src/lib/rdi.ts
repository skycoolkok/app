import path from 'path';
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { Sex } from '@prisma/client';
import { prisma } from './prisma';
import { NUTRIENT_CONFIG, type NutrientKey } from './nutrients';

export type RdiRecord = {
  nutrientKey: NutrientKey;
  unit: string;
  daily: number | null;
  weekly: number | null;
  source: string | null;
  region: string | null;
};

export async function resolveUserContext(userId?: number) {
  try {
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : await prisma.user.findFirst({ orderBy: { id: 'asc' } });

    if (user) {
      return {
        userId: user.id,
        age: user.age ?? 30,
        sex: user.sex ?? Sex.FEMALE,
        timezone: user.timezone ?? 'Asia/Taipei',
      } as const;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[resolveUserContext] fallback to defaults', error);
    }
  }

  return {
    userId: null,
    age: 30,
    sex: Sex.FEMALE,
    timezone: 'Asia/Taipei',
  } as const;
}

let csvCache: { males: Record<NutrientKey, RdiRecord>; females: Record<NutrientKey, RdiRecord> } | null = null;
let csvPromise: Promise<typeof csvCache> | null = null;

async function loadCsvFallback(): Promise<typeof csvCache> {
  if (csvCache) return csvCache;
  if (csvPromise) return csvPromise;

  csvPromise = (async () => {
    const csvPath = path.join(process.cwd(), 'data', 'rdi.csv');
    const raw = await fs.readFile(csvPath, 'utf8');
    const rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{
      nutrient: string;
      unit: string;
      adult_male: string;
      adult_female: string;
      source?: string;
    }>;

    const keyByName = new Map<string, NutrientKey>();
    for (const key of Object.keys(NUTRIENT_CONFIG) as NutrientKey[]) {
      keyByName.set(NUTRIENT_CONFIG[key].rdiKey, key);
    }

    function build(sex: Sex) {
      const map = {} as Record<NutrientKey, RdiRecord>;
      for (const key of Object.keys(NUTRIENT_CONFIG) as NutrientKey[]) {
        map[key] = {
          nutrientKey: key,
          unit: NUTRIENT_CONFIG[key].unit,
          daily: null,
          weekly: null,
          source: null,
          region: 'CSV',
        };
      }
      for (const row of rows) {
        const key = keyByName.get(row.nutrient);
        if (!key) continue;
        const value = Number(sex === Sex.MALE ? row.adult_male : row.adult_female);
        map[key] = {
          nutrientKey: key,
          unit: row.unit,
          daily: Number.isFinite(value) ? value : null,
          weekly: Number.isFinite(value) ? value * 7 : null,
          source: row.source ?? 'CSV',
          region: 'CSV',
        };
      }
      return map;
    }

    const cacheValue = {
      males: build(Sex.MALE),
      females: build(Sex.FEMALE),
    };
    csvCache = cacheValue;
    return cacheValue;
  })();

  return csvPromise;
}

export async function loadRdiRecords(options: {
  age: number;
  sex: Sex;
}): Promise<Record<NutrientKey, RdiRecord>> {
  const { sex } = options;
  const keyByRdiName = new Map<string, NutrientKey>();
  for (const key of Object.keys(NUTRIENT_CONFIG) as NutrientKey[]) {
    keyByRdiName.set(NUTRIENT_CONFIG[key].rdiKey, key);
  }

  try {
    const standards = await prisma.rdiStandard.findMany();
    if (standards.length > 0) {
      const result: Record<NutrientKey, RdiRecord> = {} as Record<
        NutrientKey,
        RdiRecord
      >;

      for (const key of Object.keys(NUTRIENT_CONFIG) as NutrientKey[]) {
        result[key] = {
          nutrientKey: key,
          unit: NUTRIENT_CONFIG[key].unit,
          daily: null,
          weekly: null,
          source: null,
          region: 'DB',
        };
      }

      for (const row of standards) {
        const nutrientKey = keyByRdiName.get(row.nutrient);
        if (!nutrientKey) continue;
        const selectedValue = sex === Sex.MALE ? row.male_value : row.female_value;
        result[nutrientKey] = {
          nutrientKey,
          unit: row.unit,
          daily: typeof selectedValue === 'number' ? selectedValue : null,
          weekly:
            typeof selectedValue === 'number' ? selectedValue * 7 : null,
          source: row.source ?? 'RdiStandard',
          region: 'DB',
        };
      }

      return result;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[loadRdiRecords] DB lookup failed, fallback to CSV', error);
    }
  }

  const csvData = await loadCsvFallback();
  return sex === Sex.MALE ? csvData.males : csvData.females;
}
