import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ensureRecipeTotals,
  type RecipeWithNutrition,
} from '@/lib/recipe-totals';
import { convertToGrams, NUTRIENT_KEYS } from '@/lib/nutrients';
import { getRecipeMeta } from '@/lib/recipeMeta';
import { loadRdiRecords, resolveUserContext } from '@/lib/rdi';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const recipeId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(recipeId)) {
    return NextResponse.json({ error: 'Invalid recipe id' }, { status: 400 });
  }

  try {
    const recipeRecord = await prisma.recipe.findUnique({
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
    });

    if (!recipeRecord) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const { totals, perServing } = await ensureRecipeTotals({
      recipeId,
      recipe: recipeRecord as RecipeWithNutrition,
    });

    const context = await resolveUserContext();
    const canPersistFavorite = context.userId !== null && context.userId !== undefined;
    let isFavorite = false;
    if (canPersistFavorite) {
      const favorite = await prisma.favorite.findUnique({
        where: {
          user_id_recipe_id: {
            user_id: context.userId!,
            recipe_id: recipeRecord.id,
          },
        },
      });
      isFavorite = Boolean(favorite);
    }
    const rdi = await loadRdiRecords({ age: context.age, sex: context.sex });
    const meta = await getRecipeMeta();
    const tags = meta[recipeId] ?? { functional: [], flavor: [] };

    const percentOfDaily = NUTRIENT_KEYS.reduce<Record<string, number | null>>((acc, key) => {
      const perServingValue = perServing?.[key] ?? null;
      const dailyValue = rdi[key]?.daily ?? null;
      if (perServingValue === null || dailyValue === null || dailyValue === 0) {
        acc[key] = null;
      } else {
        acc[key] = (perServingValue / dailyValue) * 100;
      }
      return acc;
    }, {});

    const ingredients = recipeRecord.ingredients.map((item) => {
      const baseUnit = item.unit ?? item.ingredient?.default_unit ?? null;
      const ingredientName = item.ingredient?.name ?? null;
      const normalized = convertToGrams(item.quantity ?? null, baseUnit, ingredientName);
      return {
        ingredientId: item.ingredient?.id ?? null,
        name: item.ingredient?.name ?? 'Unknown ingredient',
        quantity: item.quantity,
        unit: baseUnit,
        quantityInGrams: normalized,
      };
    });

    return NextResponse.json({
      recipe: {
        id: recipeRecord.id,
        name: recipeRecord.name,
        category: recipeRecord.category,
        description: recipeRecord.description,
        notes: recipeRecord.notes,
        servings: recipeRecord.servings,
        source: recipeRecord.source,
      },
      tags,
      ingredients,
      nutrition: {
        totals,
        perServing,
        percentOfDaily,
      },
      favorite: {
        canPersist: canPersistFavorite,
        isFavorite,
      },
      rdi: {
        sex: context.sex,
        age: context.age,
        daily: Object.fromEntries(
          NUTRIENT_KEYS.map((key) => [key, rdi[key]?.daily ?? null]),
        ),
      },
      steps: [] as string[],
    });
  } catch (error) {
    console.error('[GET /api/recipes/:id] failed', error);
    return NextResponse.json(
      {
        error: 'Failed to load recipe detail',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

