import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserContext } from "@/lib/rdi";
import { getDayRange } from "@/lib/datetime";
import { ensureRecipeTotals, type RecipeWithNutrition } from "@/lib/recipe-totals";
import { NUTRIENT_KEYS } from "@/lib/nutrients";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveUserContext();
    const timezone = context.timezone ?? "Asia/Taipei";
    const search = request.nextUrl.searchParams;
    const { start, end, isoDate } = getDayRange(
      search.get("date") ?? undefined,
      timezone,
    );

    const logs = await prisma.intakeLog.findMany({
      where: {
        logged_at: {
          gte: start,
          lt: end,
        },
        ...(context.userId ? { user_id: context.userId } : {}),
      },
      orderBy: { logged_at: "asc" },
      include: {
        items: {
          include: {
            recipe: { select: { id: true, name: true } },
            ingredient: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      date: isoDate,
      timezone,
      logs: logs.map((log) => ({
        id: log.id,
        loggedAt: log.logged_at,
        items: log.items.map((item) => ({
          id: item.id,
          recipeId: item.recipe_id,
          recipeName: item.recipe?.name ?? null,
          ingredientName: item.ingredient?.name ?? null,
          amountValue: item.amount_value,
          amountUnit: item.amount_unit,
        })),
      })),
    });
  } catch (error) {
    console.error("[GET /api/logs]", error);
    return NextResponse.json(
      {
        error: "Failed to load intake logs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const recipeId = body?.recipeId ?? body?.recipe_id;
    const multiplier = Number(body?.multiplier ?? 1);
    const dateInput = body?.date ?? body?.loggedAt ?? body?.logged_at;

    if (!recipeId || Number.isNaN(Number(recipeId))) {
      return NextResponse.json(
        { error: "recipeId is required" },
        { status: 400 },
      );
    }

    const context = await resolveUserContext();
    const timezone = context.timezone ?? "Asia/Taipei";
    const loggedAt = dateInput
      ? getDayRange(dateInput, timezone).start
      : new Date();

    const recipe = await prisma.recipe.findUnique({
      where: { id: Number(recipeId) },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                nutrition: {
                  orderBy: { created_at: "desc" },
                },
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 },
      );
    }

    const { totals, perServing } = await ensureRecipeTotals({
      recipeId: Number(recipeId),
      recipe: recipe as RecipeWithNutrition,
    });
    const baseNutrition = perServing ?? totals;

    const customNutritionPayload: Record<string, number | null> = {};
    for (const key of NUTRIENT_KEYS) {
      const value = baseNutrition[key];
      customNutritionPayload[key] = value === null ? null : value;
    }

    const log = await prisma.intakeLog.create({
      data: {
        user_id: context.userId,
        logged_at: loggedAt,
        items: {
          create: {
            recipe_id: Number(recipeId),
            amount_value: Number.isFinite(multiplier) ? multiplier : 1,
            amount_unit: "serving",
            custom_nutrition: {
              create: {
                base_amount_value: 1,
                base_amount_unit: "serving",
                ...customNutritionPayload,
              },
            },
          },
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    console.error("[POST /api/logs]", error);
    return NextResponse.json(
      {
        error: "Failed to create intake log",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await resolveUserContext();
    const timezone = context.timezone ?? "Asia/Taipei";
    const search = request.nextUrl.searchParams;
    const idParam = search.get("id");
    const dateParam = search.get("date") ?? undefined;
    let targetId = idParam ? Number.parseInt(idParam, 10) : Number.NaN;

    if (Number.isNaN(targetId)) {
      const { start, end } = getDayRange(dateParam, timezone);
      const latest = await prisma.intakeLog.findFirst({
        where: {
          logged_at: {
            gte: start,
            lt: end,
          },
          ...(context.userId ? { user_id: context.userId } : {}),
        },
        orderBy: { logged_at: "desc" },
      });

      if (!latest) {
        return NextResponse.json(
          { error: "No intake logs to delete" },
          { status: 404 },
        );
      }

      targetId = latest.id;
    }

    await prisma.intakeLog.delete({ where: { id: targetId } });

    return NextResponse.json({ ok: true, deletedId: targetId });
  } catch (error) {
    console.error("[DELETE /api/logs]", error);
    return NextResponse.json(
      {
        error: "Failed to delete intake log",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

