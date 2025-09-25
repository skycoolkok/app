import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true, default_unit: true },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[GET /api/ingredients] failed', error);
    return NextResponse.json(
      {
        items: [],
        error: 'Failed to load ingredients',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

