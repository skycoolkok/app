"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NutrientProgressList, type NutrientProgressEntry } from "@/components/NutrientProgressList";
import { NUTRIENT_META, type NutrientKey } from "@/lib/nutrient-meta";

const TRACKED_KEYS: NutrientKey[] = [
  "calories_kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "fiber_g",
  "vitamin_c_mg",
];

const TODAY = new Date().toISOString().slice(0, 10);

function formatValue(value: number | null, fractionDigits = 1) {
  if (value === null || Number.isNaN(value)) return "NA";
  return Number(value).toFixed(fractionDigits).replace(/\.0+$/, "");
}

type SummaryEntry = {
  value: number | null;
  percent: number | null;
  unit: string;
};

type DashboardPayload = {
  totals?: Record<string, SummaryEntry>;
  rdi?: {
    daily?: Record<string, number | null>;
    weekly?: Record<string, number | null>;
  };
};

type LogItem = {
  id: number;
  recipeId: number | null;
  recipeName: string | null;
  ingredientName: string | null;
  amountValue: number | null;
  amountUnit: string | null;
};

type LogEntry = {
  id: number;
  loggedAt: string;
  items: LogItem[];
};

export default function RdiTrackerPage() {
  const [sex, setSex] = useState<"FEMALE" | "MALE">("FEMALE");
  const [age, setAge] = useState<number>(30);
  const [timezone, setTimezone] = useState<string>("Asia/Taipei");

  const [daily, setDaily] = useState<DashboardPayload | null>(null);
  const [weekly, setWeekly] = useState<DashboardPayload | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadAll = async (next?: { sex?: "FEMALE" | "MALE"; age?: number; timezone?: string }) => {
    const targetSex = next?.sex ?? sex;
    const targetAge = next?.age ?? age;
    const targetTimezone = next?.timezone ?? timezone;

    setLoading(true);
    setError(null);
    try {
      const querySuffix = `sex=${targetSex}&age=${targetAge}`;
      const [profileRes, dailyRes, weeklyRes, logsRes] = await Promise.all([
        fetch(`/api/profile/rdi?${querySuffix}`, { cache: "no-store" }),
        fetch(`/api/dashboard/daily?date=${TODAY}&${querySuffix}`, { cache: "no-store" }),
        fetch(`/api/dashboard/weekly?end=${TODAY}&${querySuffix}`, { cache: "no-store" }),
        fetch(`/api/logs?date=${TODAY}`, { cache: "no-store" }),
      ]);

      if (!profileRes.ok) throw new Error("Unable to load profile recommendations");
      if (!dailyRes.ok) throw new Error("Unable to load daily dashboard");
      if (!weeklyRes.ok) throw new Error("Unable to load weekly dashboard");
      if (!logsRes.ok) throw new Error("Unable to load intake logs");

      const profileJson = await profileRes.json();
      const dailyJson: DashboardPayload = await dailyRes.json();
      const weeklyJson: DashboardPayload = await weeklyRes.json();
      const logsJson = await logsRes.json();

      const resolvedSex = profileJson.context?.selectedSex ?? profileJson.context?.defaultSex;
      if (resolvedSex === "FEMALE" || resolvedSex === "MALE") {
        setSex(resolvedSex);
      } else {
        setSex(targetSex);
      }

      const resolvedAgeRaw = profileJson.context?.age;
      const resolvedAge = Number.isFinite(resolvedAgeRaw) ? Number(resolvedAgeRaw) : targetAge;
      setAge(resolvedAge > 0 ? resolvedAge : targetAge);
      setTimezone(profileJson.context?.timezone ?? targetTimezone);

      setDaily(dailyJson ?? null);
      setWeekly(weeklyJson ?? null);
      setLogs(Array.isArray(logsJson.logs) ? logsJson.logs : []);
    } catch (err) {
      console.error("[GET /rdi-tracker] loadAll", err);
      setError(err instanceof Error ? err.message : "Unable to update dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setStatus(null);
    try {
      const response = await fetch("/api/profile/rdi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sex, age, timezone }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to save profile");
      }
      setStatus("Profile updated. Refreshing dashboard...");
      await loadAll({ sex, age, timezone });
      setStatus("Dashboard refreshed");
    } catch (err) {
      console.error("[PUT /api/profile/rdi]", err);
      setStatus(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemoveLast = async () => {
    setRemoving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/logs?date=${TODAY}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to remove last log entry");
      }
      setStatus("Last log entry removed");
      await loadAll({ sex, age, timezone });
    } catch (err) {
      console.error("[DELETE /api/logs]", err);
      setStatus(err instanceof Error ? err.message : "Failed to remove log entry");
    } finally {
      setRemoving(false);
    }
  };

  const dailyEntries = useMemo<NutrientProgressEntry[]>(() => {
    if (!daily) return [];
    return TRACKED_KEYS.map((key) => ({
      key,
      label: NUTRIENT_META[key].label,
      unit: NUTRIENT_META[key].unit,
      value: daily.totals?.[key]?.value ?? null,
      percent: daily.totals?.[key]?.percent ?? null,
      targetLabel: "RDI",
      targetValue: daily.rdi?.daily?.[key] ?? null,
    }));
  }, [daily]);

  const weeklyEntries = useMemo<NutrientProgressEntry[]>(() => {
    if (!weekly) return [];
    return TRACKED_KEYS.map((key) => ({
      key,
      label: NUTRIENT_META[key].label,
      unit: NUTRIENT_META[key].unit,
      value: weekly.totals?.[key]?.value ?? null,
      percent: weekly.totals?.[key]?.percent ?? null,
      targetLabel: "Weekly RDI",
      targetValue: weekly.rdi?.weekly?.[key] ?? null,
    }));
  }, [weekly]);

  const recentItems = useMemo(() => {
    const collected: { id: string; name: string; amount: string }[] = [];
    const orderedLogs = logs.slice().sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
    for (const log of orderedLogs.reverse()) {
      for (const item of log.items.slice().reverse()) {
        const label = item.recipeName ?? item.ingredientName ?? "Custom item";
        const amount = `${formatValue(item.amountValue, 2)} ${item.amountUnit ?? ""}`.trim();
        collected.push({ id: `${log.id}-${item.id}`, name: label, amount });
        if (collected.length >= 3) break;
      }
      if (collected.length >= 3) break;
    }
    return collected;
  }, [logs]);

  return (
    <div className="flex flex-col gap-12 pb-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-emerald-700">RDI Tracker</h1>
        <p className="text-sm text-slate-600">
          Monitor your daily and rolling 7-day nutrient intake versus the recommended amounts.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-700">Profile</h2>
            <p className="text-xs text-slate-500">Update sex, age, and timezone to personalise recommendations.</p>
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition ${
              savingProfile ? "bg-emerald-300" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-600">Sex</span>
            <select
              value={sex}
              onChange={(event) => setSex(event.target.value === "MALE" ? "MALE" : "FEMALE")}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-600">Age</span>
            <input
              value={age}
              onChange={(event) => setAge(Math.max(1, Number.parseInt(event.target.value || "0", 10)))}
              type="number"
              min={1}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-600">Timezone</span>
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
        {status && <p className="text-xs text-emerald-700">{status}</p>}
      </section>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</p>
      )}

      {loading && !error && (
        <p className="text-sm text-slate-500">Loading dashboard data...</p>
      )}

      {daily && (
        <section className="space-y-4 rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-orange-600">Today</h2>
          <NutrientProgressList
            entries={dailyEntries}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          />
        </section>
      )}

      {weekly && (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-700">Last 7 days</h2>
          <NutrientProgressList
            entries={weeklyEntries}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          />
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">Today&apos;s log items</h2>
            <p className="text-xs text-slate-500">Most recent entries appear first. Remove the last item if needed.</p>
          </div>
          <button
            type="button"
            onClick={handleRemoveLast}
            disabled={removing}
            className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${
              removing ? "border-slate-200 text-slate-400" : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-100"
            }`}
          >
            {removing ? "Removing..." : "Undo last log"}
          </button>
        </div>
        {logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            No items logged yet today. Use &quot;Add to today&quot; on any recipe to get started.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-xs text-emerald-700">
              <span className="font-semibold">Recent highlights:&nbsp;</span>
              {recentItems.length === 0
                ? "No recent entries"
                : recentItems.map((item, index) => (
                    <span key={item.id}>
                      {index > 0 ? " | " : null}
                      {item.name} ({item.amount})
                    </span>
                  ))
              }
            </div>
            <ul className="space-y-3">
              {logs
                .slice()
                .reverse()
                .map((log) => (
                  <li key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Log #{log.id}</span>
                      <span>{new Date(log.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {log.items.map((item) => (
                        <li key={item.id}>
                          {formatValue(item.amountValue, 2)} {item.amountUnit ?? ""} - {item.recipeName ?? item.ingredientName ?? "Custom item"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Ready for another glass? Discover more ideas in the
          <Link href="/recipes" className="text-emerald-600 underline"> recipe catalog</Link>
          or explore personalised suggestions in
          <Link href="/my-kitchen" className="text-emerald-600 underline"> My Kitchen</Link>.
        </p>
      </section>
    </div>
  );
}






