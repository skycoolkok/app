import type { NutritionFact } from '@prisma/client';
import {
  NUTRIENT_META,
  NUTRIENT_KEYS,
  type NutrientKey,
} from './nutrient-meta';
import { convertUsingUnitMap } from './unit-conversions';

export { NUTRIENT_META as NUTRIENT_CONFIG, NUTRIENT_KEYS };
export type { NutrientKey };

export type NutrientTotals = Record<NutrientKey, number | null>;

const UNIT_NORMALIZATION_OVERRIDES: Record<string, string> = {
  '\u516c\u514b': 'g',
  '\u514b': 'g',
  '\u516c\u65a4': 'kg',
  '\u6beb\u514b': 'mg',
  '\u5fae\u514b': '\u03bcg',
  '\u03bcg': '\u03bcg',
  '\u516c\u5347': 'l',
  '\u6beb\u5347': 'ml',
  '\u7acb\u65b9\u516c\u5206': 'ml',
};

const MASS_UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  piece: 1,
  pieces: 1,
  '\u9846': 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  '\u03bcg': 0.000001,
  ug: 0.000001,
  ounce: 28.3495,
  oz: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const VOLUME_UNIT_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  cc: 1,
  cm3: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  '\u676f': 240,
};

const DIMENSIONLESS_UNITS = new Set([
  'serving',
  'servings',
  'portion',
  'portions',
  '\u4efd',
]);

const MASS_UNITS = new Set(Object.keys(MASS_UNIT_TO_GRAMS));
const VOLUME_UNITS = new Set(Object.keys(VOLUME_UNIT_TO_ML));

export function createEmptyTotals(): NutrientTotals {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as NutrientTotals);
}

export function createNaTotals(): NutrientTotals {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as NutrientTotals);
}

export function cloneTotals(totals: NutrientTotals): NutrientTotals {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    acc[key] = totals[key];
    return acc;
  }, {} as NutrientTotals);
}

export function addTotals(
  target: NutrientTotals,
  addition: NutrientTotals
): NutrientTotals {
  const next = cloneTotals(target);
  for (const key of NUTRIENT_KEYS) {
    const current = target[key];
    const valueToAdd = addition[key];
    if (current === null || valueToAdd === null) {
      next[key] = null;
    } else {
      next[key] = current + valueToAdd;
    }
  }
  return next;
}

export function scaleTotals(
  totals: NutrientTotals,
  factor: number
): NutrientTotals {
  return NUTRIENT_KEYS.reduce((acc, key) => {
    const value = totals[key];
    acc[key] = value === null ? null : value * factor;
    return acc;
  }, {} as NutrientTotals);
}

export function divideTotals(
  totals: NutrientTotals,
  divisor: number
): NutrientTotals {
  if (divisor === 0) {
    return createNaTotals();
  }
  return NUTRIENT_KEYS.reduce((acc, key) => {
    const value = totals[key];
    acc[key] = value === null ? null : value / divisor;
    return acc;
  }, {} as NutrientTotals);
}

export function normalizeUnit(unit?: string | null): string | null {
  if (!unit) return null;
  const trimmed = unit.trim().toLowerCase();
  if (!trimmed) return null;
  return UNIT_NORMALIZATION_OVERRIDES[trimmed] ?? trimmed;
}

function convertMassToGrams(
  value: number,
  unit: string,
  ingredientName?: string | null,
): number | null {
  const fromMap = convertUsingUnitMap(value, {
    unit,
    targetUnit: 'g',
    ingredientName: ingredientName ?? null,
  });
  if (fromMap !== null) {
    return fromMap;
  }
  const factor = MASS_UNIT_TO_GRAMS[unit];
  if (typeof factor === 'number') {
    return value * factor;
  }
  return null;
}

function convertVolumeToMl(
  value: number,
  unit: string,
  ingredientName?: string | null,
): number | null {
  const fromMap = convertUsingUnitMap(value, {
    unit,
    targetUnit: 'ml',
    ingredientName: ingredientName ?? null,
  });
  if (fromMap !== null) {
    return fromMap;
  }
  const factor = VOLUME_UNIT_TO_ML[unit];
  if (typeof factor === 'number') {
    return value * factor;
  }
  return null;
}

function convertGramsToTargetUnit(grams: number, targetUnit: string): number | null {
  switch (targetUnit) {
    case 'g':
    case 'gram':
    case 'grams':
      return grams;
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return grams / 1000;
    case 'mg':
    case 'milligram':
    case 'milligrams':
      return grams * 1000;
    case '\u03bcg':
    case 'ug':
      return grams * 1_000_000;
    case 'ounce':
    case 'oz':
    case 'ounces':
      return grams / 28.3495;
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      return grams / 453.592;
    default:
      return null;
  }
}

function convertMlToTargetUnit(ml: number, targetUnit: string): number | null {
  switch (targetUnit) {
    case 'ml':
    case 'milliliter':
    case 'milliliters':
    case 'cc':
    case 'cm3':
      return ml;
    case 'l':
    case 'liter':
    case 'liters':
      return ml / 1000;
    case 'cup':
    case 'cups':
      return ml / 240;
    case 'tbsp':
    case 'tablespoon':
    case 'tablespoons':
      return ml / 15;
    case 'tsp':
    case 'teaspoon':
    case 'teaspoons':
      return ml / 5;
    case '\u676f':
      return ml / 240;
    default:
      return null;
  }
}

export function convertToBase(
  value?: number | null,
  fromUnit?: string | null,
  targetUnit?: string | null,
  options: { ingredientName?: string | null } = {},
): number | null {
  if (value === null || value === undefined) return null;
  const normalizedTarget = normalizeUnit(targetUnit ?? 'g');
  const normalizedFrom = normalizeUnit(fromUnit ?? normalizedTarget);
  if (!normalizedTarget || !normalizedFrom) {
    return null;
  }

  if (normalizedFrom === normalizedTarget) {
    return value;
  }

  if (DIMENSIONLESS_UNITS.has(normalizedFrom) && DIMENSIONLESS_UNITS.has(normalizedTarget)) {
    return value;
  }

  if (MASS_UNITS.has(normalizedTarget)) {
    const grams = convertMassToGrams(value, normalizedFrom, options.ingredientName ?? null);
    if (grams === null) {
      return null;
    }
    return convertGramsToTargetUnit(grams, normalizedTarget) ?? grams;
  }

  if (VOLUME_UNITS.has(normalizedTarget) || normalizedTarget === 'ml') {
    const ml = convertVolumeToMl(value, normalizedFrom, options.ingredientName ?? null);
    if (ml === null) {
      return null;
    }
    return convertMlToTargetUnit(ml, normalizedTarget) ?? ml;
  }

  const viaMap = convertUsingUnitMap(value, {
    unit: normalizedFrom,
    targetUnit: normalizedTarget,
    ingredientName: options.ingredientName ?? null,
  });
  if (viaMap !== null) {
    return viaMap;
  }

  if (DIMENSIONLESS_UNITS.has(normalizedFrom) && (normalizedTarget === 'g' || normalizedTarget === 'ml')) {
    return value;
  }

  return null;
}

export function convertToGrams(
  value?: number | null,
  unit?: string | null,
  ingredientName?: string | null,
): number | null {
  return convertToBase(value, unit, 'g', { ingredientName: ingredientName ?? null });
}

export function computeContribution(
  nutrition: NutritionFact | null,
  amountInGrams: number | null
): NutrientTotals {
  if (!nutrition) {
    return createNaTotals();
  }
  const baseGrams = convertToGrams(
    nutrition.per_amount_value,
    nutrition.per_amount_unit
  );
  if (!baseGrams || !amountInGrams) {
    return createNaTotals();
  }
  const ratio = amountInGrams / baseGrams;
  return NUTRIENT_KEYS.reduce((acc, key) => {
    const nutrientValue = nutrition[key];
    acc[key] =
      nutrientValue === null || nutrientValue === undefined
        ? null
        : nutrientValue * ratio;
    return acc;
  }, {} as NutrientTotals);
}

export function formatValue(value: number | null, fractionDigits = 2): string {
  if (value === null || Number.isNaN(value)) {
    return 'NA';
  }
  return Number(value.toFixed(fractionDigits)).toString();
}