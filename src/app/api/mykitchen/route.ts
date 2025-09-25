import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRecipeMeta } from '@/lib/recipeMeta';

function parseList(param: string | null): string[] {
  if (!param) return [];
  const trimmed = param.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch (error) {
      console.warn('[GET /api/mykitchen] Failed to parse JSON supply', error);
    }
  }
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTags(param: string | null): string[] {
  return parseList(param).map((item) => item.toUpperCase());
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const supplyList = parseList(search.get('supply'));
  if (supplyList.length === 0) {
    return NextResponse.json(
      { error: 'supply parameter is required. Example: ?supply=apple,spinach' },
      { status: 400 },
    );
  }

  try {
    const numericIds: number[] = [];
    const nameTokens: string[] = [];
    for (const token of supplyList) {
      const numeric = Number.parseInt(token, 10);
      if (!Number.isNaN(numeric)) {
        numericIds.push(numeric);
      } else {
        nameTokens.push(token);
      }
    }

    const orConditions: Prisma.IngredientWhereInput[] = [];
    if (numericIds.length > 0) {
      orConditions.push({ id: { in: numericIds } });
    }
    for (const name of nameTokens) {
      orConditions.push({ name: { contains: name } });
    }

    const ingredients = await prisma.ingredient.findMany({
      where: orConditions.length ? { OR: orConditions } : undefined,
    });

    const availableIngredientIds = new Set<number>();
    for (const ingredient of ingredients) {
      availableIngredientIds.add(ingredient.id);
    }
    for (const id of numericIds) {
      availableIngredientIds.add(id);
    }

    const functionalTags = normalizeTags(search.get('functional'));
    const flavorTags = normalizeTags(search.get('flavor'));
    const meta = await getRecipeMeta();

    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    type RecipeSuggestion = {
      id: number;
      name: string;
      category: string | null;
      servings: number | null;
      totalIngredients: number;
      matchedIngredients: number;
      missingIngredientIds: number[];
      missingIngredientNames: string[];
      tags: { functional: string[]; flavor: string[] };
    };

    const readyToMake: RecipeSuggestion[] = [];
    const missingOne: RecipeSuggestion[] = [];

    const matchesTagFilter = (id: number): boolean => {
      const tags = meta[id] ?? { functional: [], flavor: [] };
      if (functionalTags.length && !functionalTags.some((tag) => tags.functional.includes(tag))) {
        return false;
      }
      if (flavorTags.length && !flavorTags.some((tag) => tags.flavor.includes(tag))) {
        return false;
      }
      return true;
    };

    for (const recipe of recipes) {
      if (!matchesTagFilter(recipe.id)) continue;

      const requiredIds = recipe.ingredients
        .map((item) => item.ingredient?.id)
        .filter((id): id is number => typeof id === 'number');
      const missingIds = requiredIds.filter((id) => !availableIngredientIds.has(id));
      const missingNames = recipe.ingredients
        .filter((item) => item.ingredient && missingIds.includes(item.ingredient.id))
        .map((item) => item.ingredient!.name);

      const tags = meta[recipe.id] ?? { functional: [], flavor: [] };

      const payload: RecipeSuggestion = {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category ?? null,
        servings: recipe.servings ?? null,
        totalIngredients: requiredIds.length,
        matchedIngredients: requiredIds.length - missingIds.length,
        missingIngredientIds: missingIds,
        missingIngredientNames: missingNames,
        tags,
      };

      if (missingIds.length === 0) {
        readyToMake.push(payload);
      } else if (missingIds.length === 1) {
        missingOne.push(payload);
      }
    }

    return NextResponse.json({
      supply: {
        provided: supplyList,
        resolvedIds: Array.from(availableIngredientIds.values()),
      },
      readyToMake,
      missingOne,
    });
  } catch (error) {
    console.error('[GET /api/mykitchen] failed', error);
    return NextResponse.json(
      {
        error: 'Failed to generate kitchen suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
        readyToMake: [],
        missingOne: [],
      },
      { status: 500 },
    );
  }
}
