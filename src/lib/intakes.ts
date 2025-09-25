import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  NUTRIENT_KEYS,
  type NutrientKey,
  type NutrientTotals,
  addTotals,
  convertToGrams,
  createEmptyTotals,
  createNaTotals,
  normalizeUnit,
  scaleTotals,
} from './nutrients';

import {
  calculateIngredientTotals,
  ensureRecipeTotals,
  parseRecipeTotalsPayload,
  type RecipeTotalsPayload,
  type RecipeWithNutrition,
  type IngredientWithNutrition,
} from './recipe-totals';

export type IntakeItemWithRelations = Prisma.IntakeItemGetPayload<{
  include: {
    ingredient: {
      include: {
        nutrition: {
          orderBy: { created_at: 'desc' },
        },
      },
    },
    recipe: {
      include: {
        nutrition_totals: true,
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
    },
    custom_nutrition: true,
  },
}>;

export type IntakeLogWithRelations = Prisma.IntakeLogGetPayload<{
  include: {
    items: {
      include: {
        ingredient: {
          include: {
            nutrition: {
              orderBy: { created_at: 'desc' },
            },
          },
        },
        recipe: {
          include: {
            nutrition_totals: true,
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
        },
        custom_nutrition: true,
      },
    },
  },
}>;

function calculateCustomTotals(options: {
  baseValue: number;
  baseUnit: string;
  amounts: { value: number | null | undefined; unit: string | null | undefined };
  nutrition: Partial<Record<NutrientKey, number | null>>;
}): NutrientTotals {
  const baseGrams = convertToGrams(options.baseValue, options.baseUnit);
  const loggedGrams = convertToGrams(
    options.amounts.value ?? options.baseValue,
    options.amounts.unit ?? options.baseUnit,
  );
  if (!baseGrams || !loggedGrams) {
    const normalizedBase = normalizeUnit(options.baseUnit);
    const loggedValue = options.amounts.value ?? options.baseValue;
    const normalizedLogged = normalizeUnit(options.amounts.unit ?? options.baseUnit);
    if (
      normalizedBase &&
      normalizedLogged &&
      normalizedBase === normalizedLogged &&
      options.baseValue &&
      loggedValue
    ) {
      const ratio = loggedValue / options.baseValue;
      return NUTRIENT_KEYS.reduce((acc, key) => {
        const nutrientValue = options.nutrition[key];
        acc[key] =
          nutrientValue === null || nutrientValue === undefined
            ? null
            : nutrientValue * ratio;
        return acc;
      }, {} as NutrientTotals);
    }
    return createNaTotals();
  }
  const ratio = loggedGrams / baseGrams;
  return NUTRIENT_KEYS.reduce((acc, key) => {
    const nutrientValue = options.nutrition[key];
    acc[key] =
      nutrientValue === null || nutrientValue === undefined
        ? null
        : nutrientValue * ratio;
    return acc;
  }, {} as NutrientTotals);
}

let customNutritionAvailable = true;

export async function fetchLogsWithinRange(options: {
  userId: number | null;
  start: Date;
  end: Date;
}): Promise<IntakeLogWithRelations[]> {
  const { userId, start, end } = options;

  const baseWhere: Prisma.IntakeLogWhereInput = {
    logged_at: {
      gte: start,
      lt: end,
    },
    ...(userId ? { user_id: userId } : {}),
  };

  const baseInclude = {
    items: {
      include: {
        ingredient: {
          include: {
            nutrition: {
              orderBy: { created_at: 'desc' },
            },
          },
        },
        recipe: {
          include: {
            nutrition_totals: true,
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
        },
      },
    },
  } as const;

  if (customNutritionAvailable) {
    try {
      return await prisma.intakeLog.findMany({
        where: baseWhere,
        include: {
          ...baseInclude,
          items: {
            include: {
              ...baseInclude.items.include,
              custom_nutrition: true,
            },
          },
        },
        orderBy: { logged_at: 'asc' },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        typeof (error.meta?.table) === 'string' &&
        error.meta.table.toLowerCase().includes('custom')
      ) {
        customNutritionAvailable = false;
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[fetchLogsWithinRange] CustomNutrition table missing, disabling include');
        }
      } else {
        throw error;
      }
    }
  }

  const logs = await prisma.intakeLog.findMany({
    where: baseWhere,
    include: baseInclude,
    orderBy: { logged_at: 'asc' },
  });

  return logs as unknown as IntakeLogWithRelations[];
}

async function aggregateItemList(items: IntakeItemWithRelations[]): Promise<NutrientTotals> {
  let totals = createEmptyTotals();
  const recipeCache = new Map<number, RecipeTotalsPayload>();

  for (const item of items) {
    let addition: NutrientTotals = createNaTotals();

    if (item.custom_nutrition) {
      addition = calculateCustomTotals({
        baseValue: item.custom_nutrition.base_amount_value,
        baseUnit: item.custom_nutrition.base_amount_unit,
        amounts: { value: item.amount_value, unit: item.amount_unit },
        nutrition: item.custom_nutrition as Partial<Record<NutrientKey, number | null>>,
      });
    } else if (item.recipe) {
      let recipeTotals = recipeCache.get(item.recipe.id);
      if (!recipeTotals) {
        const cached = parseRecipeTotalsPayload(item.recipe.nutrition_totals?.totals ?? null);
        if (cached) {
          recipeTotals = cached;
        } else {
          recipeTotals = await ensureRecipeTotals({
            recipeId: item.recipe.id,
            recipe: item.recipe as unknown as RecipeWithNutrition,
          });
        }
        recipeCache.set(item.recipe.id, recipeTotals);
      }
      const multiplier = item.amount_value ?? 1;
      const isServing = (item.amount_unit ?? '').toLowerCase().includes('serv');
      if (recipeTotals.perServing && isServing) {
        addition = scaleTotals(recipeTotals.perServing, multiplier);
      } else {
        addition = scaleTotals(recipeTotals.totals, multiplier);
      }
    } else if (item.ingredient) {
      addition = calculateIngredientTotals({
        ingredient: item.ingredient as IngredientWithNutrition,
        quantity: item.amount_value ?? null,
        unit: item.amount_unit ?? item.ingredient.default_unit ?? null,
      });
    }

    totals = addTotals(totals, addition);
  }

  return totals;
}

export async function aggregateIntakeItems(options: {
  userId: number | null;
  start: Date;
  end: Date;
}): Promise<NutrientTotals> {
  const logs = await fetchLogsWithinRange(options);
  let totals = createEmptyTotals();
  for (const log of logs) {
    const addition = await aggregateItemList(log.items as IntakeItemWithRelations[]);
    totals = addTotals(totals, addition);
  }
  return totals;
}

export async function calculateIntakeTotals(options: {
  userId: number | null;
  start: Date;
  end: Date;
}): Promise<NutrientTotals> {
  return aggregateIntakeItems(options);
}
