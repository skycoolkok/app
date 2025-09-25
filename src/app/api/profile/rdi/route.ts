import { NextRequest, NextResponse } from 'next/server';
import { Sex } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatValue } from '@/lib/nutrients';
import { loadRdiRecords, resolveUserContext } from '@/lib/rdi';

function mapSex(input: string | null | undefined, fallback: Sex): Sex {
  if (!input) return fallback;
  const upper = input.toUpperCase();
  return upper === 'MALE' ? Sex.MALE : upper === 'FEMALE' ? Sex.FEMALE : fallback;
}

function safeAge(value: string | null | undefined, fallback: number) {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type DailyRecommendation = {
  unit: string;
  value: number | null;
  display: string;
  weeklyValue: number | null;
  weeklyDisplay: string;
  source: string | null;
  region: string | null;
};

type WeeklyRecommendation = {
  unit: string;
  value: number | null;
  display: string;
  source: string | null;
  region: string | null;
};

type RecommendationPack = {
  daily: Record<string, DailyRecommendation>;
  weekly: Record<string, WeeklyRecommendation>;
};

function createEmptyPack(): RecommendationPack {
  return {
    daily: {},
    weekly: {},
  };
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const context = await resolveUserContext();
    const age = safeAge(search.get('age'), context.age);

    const recommendations: Record<Sex, RecommendationPack> = {
      [Sex.MALE]: createEmptyPack(),
      [Sex.FEMALE]: createEmptyPack(),
    };

    for (const sex of [Sex.MALE, Sex.FEMALE]) {
      const rdi = await loadRdiRecords({ age, sex });
      const pack = recommendations[sex];
      for (const [key, record] of Object.entries(rdi)) {
        pack.daily[key] = {
          unit: record.unit,
          value: record.daily,
          display: formatValue(record.daily),
          weeklyValue: record.weekly,
          weeklyDisplay: formatValue(record.weekly),
          source: record.source,
          region: record.region,
        };
        pack.weekly[key] = {
          unit: record.unit,
          value: record.weekly,
          display: formatValue(record.weekly),
          source: record.source,
          region: record.region,
        };
      }
    }

    const selectedSex = mapSex(search.get('sex'), context.sex);

    return NextResponse.json({
      context: {
        defaultSex: context.sex,
        selectedSex,
        age,
        timezone: context.timezone,
      },
      recommendations,
    });
  } catch (error) {
    console.error('[GET /api/profile/rdi]', error);
    return NextResponse.json(
      {
        error: 'Failed to load profile recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const context = await resolveUserContext();
    const targetSex = mapSex(body?.sex ?? null, context.sex);
    const targetAge = safeAge(body?.age ?? null, context.age);
    const timezone = typeof body?.timezone === 'string' && body.timezone.trim()
      ? body.timezone.trim()
      : context.timezone ?? 'Asia/Taipei';

    let userId = context.userId ?? null;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          sex: targetSex,
          age: targetAge,
          timezone,
        },
      });
    } else {
      const created = await prisma.user.create({
        data: {
          sex: targetSex,
          age: targetAge,
          timezone,
        },
      });
      userId = created.id;
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        sex: targetSex,
        age: targetAge,
        timezone,
      },
    });
  } catch (error) {
    console.error('[PUT /api/profile/rdi]', error);
    return NextResponse.json(
      {
        error: 'Failed to save profile settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
