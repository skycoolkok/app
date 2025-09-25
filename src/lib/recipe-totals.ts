import { Prisma, type NutritionFact } from '@prisma/client';
import { prisma } from './prisma';
import {
  NUTRIENT_KEYS,
  type NutrientTotals,
  addTotals,
  convertToBase,
  createEmptyTotals,
  createNaTotals,
  divideTotals,
  normalizeUnit,
} from './nutrients';

export type IngredientWithNutrition = Prisma.IngredientGetPayload<{
  include: {
    nutrition: {
      orderBy: { created_at: 'desc' };
    };
  };
}>;

export type RecipeWithNutrition = Prisma.RecipeGetPayload<{
  include: {
    ingredients: {
      include: {
        ingredient: {
          include: {
            nutrition: {
              orderBy: { created_at: 'desc' };
            };
          };
        };
      };
    };
  };
}>;

export type RecipeTotalsPayload = {
  totals: NutrientTotals;
  perServing: NutrientTotals | null;
  servings: number | null;
};

function getPrimaryNutrition(
  entity: { nutrition?: NutritionFact[] } | null | undefined,
): NutritionFact | null {
  if (!entity || !Array.isArray(entity.nutrition) || entity.nutrition.length === 0) {
    return null;
  }
  return entity.nutrition[0] ?? null;
}

export function calculateIngredientTotals(options: {
  ingredient: IngredientWithNutrition | null;
  quantity: number | null | undefined;
  unit: string | null | undefined;
}): NutrientTotals {
  const nutrition = getPrimaryNutrition(options.ingredient);
  if (!nutrition) {
    return createNaTotals();
  }

  const ingredientName = options.ingredient?.name ?? null;
  const baseUnit = normalizeUnit(nutrition.per_amount_unit) ?? 'g';
  const baseAmount = convertToBase(
    nutrition.per_amount_value,
    nutrition.per_amount_unit,
    baseUnit,
    { ingredientName },
  );
  const usedAmount = convertToBase(
    options.quantity ?? null,
    options.unit ?? options.ingredient?.default_unit ?? null,
    baseUnit,
    { ingredientName },
  );

  if (!baseAmount || baseAmount === 0 || usedAmount === null) {
    return createNaTotals();
  }

  const ratio = usedAmount / baseAmount;
  const totals = createNaTotals();
  for (const key of NUTRIENT_KEYS) {
    const nutrientValue = nutrition[key];
    totals[key] =
      nutrientValue === null || nutrientValue === undefined
        ? null
        : nutrientValue * ratio;
  }
  return totals;
}

export function calculateRecipeTotals(recipe: RecipeWithNutrition): RecipeTotalsPayload {
  let totals = createEmptyTotals();
  for (const item of recipe.ingredients) {
    const ingredientTotals = calculateIngredientTotals({
      ingredient: item.ingredient,
      quantity: item.quantity ?? null,
      unit: item.unit ?? item.ingredient?.default_unit ?? null,
    });
    totals = addTotals(totals, ingredientTotals);
  }

  const servings = typeof recipe.servings === 'number' && Number.isFinite(recipe.servings)
    ? recipe.servings
    : null;
  const perServing = servings && servings > 0 ? divideTotals(totals, servings) : null;

  return {
    totals,
    perServing,
    servings,
  };
}

function parseTotalsObject(value: unknown): NutrientTotals | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const totals = createNaTotals();
  for (const key of NUTRIENT_KEYS) {
    const candidate = source[key];
    if (candidate === null || candidate === undefined) {
      totals[key] = null;
    } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      totals[key] = candidate;
    } else {
      return null;
    }
  }
  return totals;
}

export function parseRecipeTotalsPayload(value: Prisma.JsonValue | null): RecipeTotalsPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const totals = parseTotalsObject(record.totals);
  if (!totals) {
    return null;
  }
  const perServing = record.perServing ? parseTotalsObject(record.perServing) : null;
  const servingsRaw = record.servings;
  const servings = typeof servingsRaw === 'number' && Number.isFinite(servingsRaw)
    ? servingsRaw
    : null;
  return {
    totals,
    perServing,
    servings,
  };
}

export async function getCachedRecipeTotals(recipeId: number): Promise<RecipeTotalsPayload | null> {
  const record = await prisma.recipeTotals.findUnique({ where: { recipe_id: recipeId } });
  if (!record) {
    return null;
  }
  return parseRecipeTotalsPayload(record.totals);
}

export async function ensureRecipeTotals(options: {
  recipeId: number;
  recipe?: RecipeWithNutrition | null;
  force?: boolean;
}): Promise<RecipeTotalsPayload> {
  const { recipeId, recipe, force = false } = options;

  if (!force) {
    const existing = await prisma.recipeTotals.findUnique({ where: { recipe_id: recipeId } });
    if (existing) {
      const parsed = parseRecipeTotalsPayload(existing.totals);
      if (parsed) {
        return parsed;
      }
    }
  }

  const recipeRecord = recipe
    ?? (await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                nutrition: {
                  orderBy: { created_at: 'desc' },
                },
              },
            },
          },
        },
      },
    }));

  if (!recipeRecord) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  const computed = calculateRecipeTotals(recipeRecord as RecipeWithNutrition);
  await prisma.recipeTotals.upsert({
    where: { recipe_id: recipeId },
    update: { totals: computed },
    create: {
      recipe_id: recipeId,
      totals: computed,
    },
  });
  return computed;
}

export async function invalidateRecipeTotals(recipeId: number): Promise<void> {
  try {
    await prisma.recipeTotals.delete({ where: { recipe_id: recipeId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return;
    }
    throw error;
  }
}