import { NUTRIENT_CONFIG, NutrientKey, formatValue } from '@/lib/nutrients';
import type { NutrientTotals } from '@/lib/nutrients';
import type { RdiRecord } from '@/lib/rdi';

export type DashboardTimeframe = 'daily' | 'weekly';

export type SummaryEntry = {
  unit: string;
  value: number | null;
  display: string;
  percent: number | null;
  percentDisplay: string;
  isOverLimit: boolean;
  source: string | null;
  region: string | null;
};

export function buildNutrientSummary(options: {
  totals: NutrientTotals;
  rdi: Record<NutrientKey, RdiRecord>;
  timeframe: DashboardTimeframe;
}): Record<NutrientKey, SummaryEntry> {
  const entries = {} as Record<NutrientKey, SummaryEntry>;

  for (const key of Object.keys(NUTRIENT_CONFIG) as NutrientKey[]) {
    const totalValue = options.totals[key];
    const rdiRecord = options.rdi[key];
    const rdiValue =
      options.timeframe === 'daily' ? rdiRecord.daily : rdiRecord.weekly;
    let percent: number | null = null;
    if (totalValue !== null && rdiValue !== null && rdiValue !== 0) {
      percent = (totalValue / rdiValue) * 100;
    }
    entries[key] = {
      unit: NUTRIENT_CONFIG[key].unit,
      value: totalValue,
      display: formatValue(totalValue),
      percent,
      percentDisplay: formatValue(percent, 1),
      isOverLimit: percent !== null && percent > 120,
      source: rdiRecord.source,
      region: rdiRecord.region,
    };
  }

  return entries;
}

export function respondWithError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
