import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRecipeMeta } from '@/lib/recipeMeta';
import { resolveUserContext } from '@/lib/rdi';

const DEFAULT_LIMIT = 20;

type RecipeResponseItem = {
  id: number;
  name: string;
  category: string | null;
  servings: number | null;
  ingredientIds: number[];
  functionalTags: string[];
  flavorTags: string[];
};

function parseList(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toUpperCase());
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const query = search.get('query');
  const functionalFilterRaw = parseList(search.get('functional'));
  const tagFilter = parseList(search.get('tag'));
  const functionalFilter = Array.from(
    new Set([...functionalFilterRaw, ...tagFilter]),
  );
  const flavorFilter = parseList(search.get('flavor'));
  const favoriteOnly = (search.get('favorite') ?? '').toLowerCase() === 'true';
  const limit = Number.parseInt(search.get('limit') ?? '', 10);
  const page = Number.parseInt(search.get('page') ?? '1', 10);
  const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : DEFAULT_LIMIT;
  const skip = Math.max(page - 1, 0) * take;
  const sort = (search.get('sort') ?? '').toLowerCase();
  const orderBy = sort === 'new' ? { id: 'desc' } : { name: 'asc' as const };

  try {
    const context = await resolveUserContext();
    const favoriteIds = favoriteOnly && context.userId
      ? await prisma.favorite
          .findMany({
            where: { user_id: context.userId },
            select: { recipe_id: true },
          })
          .then((rows) => rows.map((row) => row.recipe_id))
      : [];

    const meta = await getRecipeMeta();

    const recipes = await prisma.recipe.findMany({
      where: {
        ...(query
          ? {
            OR: [
              { name: { contains: query } },
              {
                ingredients: {
                  some: {
                    ingredient: {
                      name: { contains: query },
                    },
                  },
                },
              },
            ],
          }
          : {}),
        ...(favoriteOnly
          ? {
              id: {
                in: favoriteIds.length > 0 ? favoriteIds : [-1],
              },
            }
          : {}),
      },
      include: {
        ingredients: {
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy,
      take,
      skip,
    });

    const items: RecipeResponseItem[] = recipes
      .map((recipe) => {
        const tags = meta[recipe.id] ?? { functional: [], flavor: [] };
        return {
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          servings: recipe.servings,
          ingredientIds: recipe.ingredients
            .map((item) => item.ingredient?.id)
            .filter((id): id is number => typeof id === 'number'),
          functionalTags: tags.functional,
          flavorTags: tags.flavor,
        };
      })
      .filter((recipe) => {
        if (functionalFilter.length && !functionalFilter.some((tag) => recipe.functionalTags.includes(tag))) {
          return false;
        }
        if (flavorFilter.length && !flavorFilter.some((tag) => recipe.flavorTags.includes(tag))) {
          return false;
        }
        return true;
      });

    return NextResponse.json({
      items,
      pagination: {
        page: Math.max(page, 1),
        limit: take,
        count: items.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/recipes] failed', error);
    return NextResponse.json(
      {
        items: [] as RecipeResponseItem[],
        error: 'Failed to load recipes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

