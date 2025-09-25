import { NextRequest, NextResponse } from 'next/server';
import { Sex } from '@prisma/client';
import { calculateIntakeTotals } from '@/lib/intakes';
import { getSevenDayRange } from '@/lib/datetime';
import { loadRdiRecords, resolveUserContext } from '@/lib/rdi';
import { buildNutrientSummary } from '@/app/api/dashboard/helpers';
import { NUTRIENT_KEYS, type NutrientKey } from '@/lib/nutrients';

function resolveSex(raw: string | null, fallback: Sex): Sex {
  if (!raw) return fallback;
  const upper = raw.toUpperCase();
  return upper === 'MALE' ? Sex.MALE : upper === 'FEMALE' ? Sex.FEMALE : fallback;
}

function resolveAge(raw: string | null, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const context = await resolveUserContext();
    const { start, end, endIsoDate, startIsoDate } = getSevenDayRange(
      search.get('end') ?? undefined,
      context.timezone,
    );

    const targetSex = resolveSex(search.get('sex'), context.sex);
    const targetAge = resolveAge(search.get('age'), context.age);

    const totals = await calculateIntakeTotals({
      userId: context.userId,
      start,
      end,
    });
    const rdi = await loadRdiRecords({ age: targetAge, sex: targetSex });
    const summary = buildNutrientSummary({ totals, rdi, timeframe: 'weekly' });

    const intakeValues: Record<NutrientKey, number | null> = {} as Record<
      NutrientKey,
      number | null
    >;
    const percentValues: Record<NutrientKey, number | null> = {} as Record<
      NutrientKey,
      number | null
    >;
    const rdiDailyValues: Record<NutrientKey, number | null> = {} as Record<
      NutrientKey,
      number | null
    >;
    const rdiWeeklyValues: Record<NutrientKey, number | null> = {} as Record<
      NutrientKey,
      number | null
    >;

    for (const key of NUTRIENT_KEYS) {
      intakeValues[key] = totals[key] ?? null;
      percentValues[key] = summary[key]?.percent ?? null;
      rdiDailyValues[key] = rdi[key]?.daily ?? null;
      rdiWeeklyValues[key] = rdi[key]?.weekly ?? null;
    }

    return NextResponse.json({
      startDate: startIsoDate,
      endDate: endIsoDate,
      timezone: context.timezone,
      sex: targetSex,
      age: targetAge,
      totals: summary,
      intake: intakeValues,
      percent: percentValues,
      rdi: {
        daily: rdiDailyValues,
        weekly: rdiWeeklyValues,
      },
    });
  } catch (error) {
    console.error('[GET /api/dashboard/weekly] failed', error);
    return NextResponse.json(
      {
        error: 'Failed to build weekly dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
        totals: {},
      },
      { status: 500 },
    );
  }
}

