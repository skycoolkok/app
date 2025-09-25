import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserContext } from '@/lib/rdi';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message, message }, { status });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const recipeId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(recipeId)) {
    return jsonError('Invalid recipe id', 400);
  }

  const context = await resolveUserContext();
  if (context.userId == null) {
    return NextResponse.json({
      ok: false,
      persisted: false,
      reason: 'NO_USER',
    });
  }

  let body: { favorite?: boolean } | null = null;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const desired = body?.favorite ?? true;

  try {
    if (desired) {
      await prisma.favorite.upsert({
        where: {
          user_id_recipe_id: {
            user_id: context.userId,
            recipe_id: recipeId,
          },
        },
        update: {},
        create: {
          user_id: context.userId,
          recipe_id: recipeId,
        },
      });
    } else {
      await prisma.favorite.deleteMany({
        where: {
          user_id: context.userId,
          recipe_id: recipeId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      persisted: true,
      isFavorite: desired,
    });
  } catch (error) {
    console.error('[POST /api/recipes/:id/favorite] failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to update favorite',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const recipeId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(recipeId)) {
    return jsonError('Invalid recipe id', 400);
  }

  const context = await resolveUserContext();
  if (context.userId == null) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      isFavorite: false,
    });
  }

  try {
    const record = await prisma.favorite.findUnique({
      where: {
        user_id_recipe_id: {
          user_id: context.userId,
          recipe_id: recipeId,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      persisted: true,
      isFavorite: Boolean(record),
    });
  } catch (error) {
    console.error('[GET /api/recipes/:id/favorite] failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load favorite state',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}