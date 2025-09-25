"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { NutrientProgressList, type NutrientProgressEntry } from "@/components/NutrientProgressList";
import { NUTRIENT_META, type NutrientKey } from "@/lib/nutrient-meta";

const PRESET_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;
const LOCAL_FAVORITES_KEY = "juice:favorites";

type IngredientEntry = {
  ingredientId: number | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  quantityInGrams: number | null;
};

type RecipeDetailResponse = {
  recipe: {
    id: number;
    name: string;
    category: string | null;
    description: string | null;
    notes: string | null;
    servings: number | null;
    source: string | null;
  };
  tags: {
    functional: string[];
    flavor: string[];
  };
  ingredients: IngredientEntry[];
  nutrition: {
    totals: Record<string, number | null>;
    perServing: Record<string, number | null> | null;
    percentOfDaily: Record<string, number | null>;
  };
  favorite: {
    canPersist: boolean;
    isFavorite: boolean;
  };
  rdi: {
    sex: string;
    age: number;
    daily: Record<string, number | null>;
  };
  steps: string[];
  error?: string;
};

const DISPLAY_KEYS: NutrientKey[] = [
  "calories_kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "fiber_g",
  "vitamin_c_mg",
];

function formatNumber(value: number | null, fractionDigits = 1) {
  if (value === null || Number.isNaN(value)) return "NA";
  return Number(value).toFixed(fractionDigits).replace(/\.0+$/, "");
}

function loadLocalFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
  } catch (error) {
    console.warn("[favorites] failed to read local storage", error);
  }
  return [];
}

function persistLocalFavorite(recipeId: number, nextState: boolean) {
  if (typeof window === "undefined") return;
  const current = new Set(loadLocalFavorites());
  if (nextState) {
    current.add(recipeId);
  } else {
    current.delete(recipeId);
  }
  try {
    window.localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(Array.from(current.values())));
  } catch (error) {
    console.warn("[favorites] failed to persist local storage", error);
  }
}

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const recipeId = Number.parseInt(params?.id ?? "", 10);

  const [detail, setDetail] = useState<RecipeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingLog, setSavingLog] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [canPersistFavorite, setCanPersistFavorite] = useState(false);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [customMultiplier, setCustomMultiplier] = useState<string>("1");

  useEffect(() => {
    if (!Number.isFinite(recipeId)) {
      setError("Invalid recipe id");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/recipes/${recipeId}`, { cache: "no-store" });
        if (!response.ok) {
          const fallback = await response.json().catch(() => null);
          throw new Error(fallback?.error ?? `Failed to fetch recipe ${recipeId}`);
        }
        const data: RecipeDetailResponse = await response.json();
        if (!cancelled) {
          setDetail(data);
          setMultiplier(1);
          setCustomMultiplier("1");
          setCanPersistFavorite(Boolean(data.favorite?.canPersist));
          if (data.favorite?.canPersist) {
            setIsFavorite(Boolean(data.favorite?.isFavorite));
          } else {
            const locals = new Set(loadLocalFavorites());
            setIsFavorite(locals.has(data.recipe.id));
          }
        }
      } catch (err) {
        console.error("[recipe detail]", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load recipe");
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const perServing = detail?.nutrition.perServing ?? null;
  const totals = detail?.nutrition.totals ?? null;
  const effectiveMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;

  const nutrientEntries = useMemo<NutrientProgressEntry[]>(() => {
    return DISPLAY_KEYS.map((key) => {
      const meta = NUTRIENT_META[key];
      const base = perServing?.[key] ?? totals?.[key] ?? null;
      const value = base === null ? null : base * effectiveMultiplier;
      const daily = detail?.rdi.daily[key] ?? null;
      const percent =
        value === null || daily === null || daily === 0 ? null : (value / daily) * 100;
      return {
        key,
        label: meta.label,
        unit: meta.unit,
        value,
        percent,
        targetLabel: "RDI",
        targetValue: daily,
      };
    });
  }, [detail?.rdi.daily, effectiveMultiplier, perServing, totals]);

  const ingredientRows = useMemo(
    () =>
      detail
        ? detail.ingredients.map((item, index) => ({
            key: `${item.ingredientId ?? index}-${index}`,
            ingredientId: item.ingredientId,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            quantityInGrams: item.quantityInGrams,
            scaledQuantity:
              item.quantity === null ? null : item.quantity * effectiveMultiplier,
            scaledQuantityInGrams:
              item.quantityInGrams === null
                ? null
                : item.quantityInGrams * effectiveMultiplier,
          }))
        : [],
    [detail, effectiveMultiplier],
  );

  const handlePresetClick = useCallback((value: number) => {
    setMultiplier(value);
    setCustomMultiplier(value.toString());
  }, []);

  const handleCustomMultiplierChange = useCallback((next: string) => {
    setCustomMultiplier(next);
    const parsed = Number.parseFloat(next);
    if (Number.isFinite(parsed) && parsed > 0) {
      setMultiplier(parsed);
    }
  }, []);

  const handleAddToToday = useCallback(async () => {
    if (!detail) return;
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      setStatus("Enter a valid multiplier (e.g. 0.5, 1, 1.5)");
      return;
    }

    setSavingLog(true);
    setStatus(null);
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: detail.recipe.id, multiplier }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to add to today's log");
      }
      setStatus("Added to today's log!");
    } catch (err) {
      console.error("[recipe:addToToday]", err);
      setStatus(err instanceof Error ? err.message : "Failed to add to today's log");
    } finally {
      setSavingLog(false);
    }
  }, [detail, multiplier]);

  const toggleFavorite = useCallback(async () => {
    if (!detail) return;
    const nextState = !isFavorite;
    setIsFavorite(nextState);

    if (!canPersistFavorite) {
      persistLocalFavorite(detail.recipe.id, nextState);
      return;
    }

    setFavoriteBusy(true);
    try {
      const response = await fetch(`/api/recipes/${detail.recipe.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: nextState }),
      });
      if (!response.ok) {
        throw new Error("Failed to update favorite");
      }
      const body = await response.json().catch(() => null);
      if (!body?.ok) {
        throw new Error(body?.error ?? "Failed to update favorite");
      }
    } catch (err) {
      console.error("[favorite]", err);
      setIsFavorite(!nextState);
      setStatus(err instanceof Error ? err.message : "Failed to update favorite");
    } finally {
      setFavoriteBusy(false);
    }
  }, [canPersistFavorite, detail, isFavorite]);

  if (!Number.isFinite(recipeId)) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">Recipe id is invalid.</div>;
  }

  if (loading) {
    return <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-sm text-emerald-700">Loading recipe...</div>;
  }

  if (error || !detail) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error ?? "Recipe not found"}</div>;
  }

  const { recipe, tags } = detail;

  return (
    <div className="flex flex-col gap-10 pb-16">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-emerald-700">{recipe.name}</h1>
            <p className="text-sm text-slate-500">
              {recipe.category ?? "Uncategorised"}
              {recipe.servings ? ` · ${recipe.servings} servings` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={favoriteBusy}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isFavorite
                ? "border-orange-300 bg-orange-100 text-orange-600 hover:border-orange-400"
                : "border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300"
            } ${favoriteBusy ? "opacity-80" : ""}`}
          >
            <span>{isFavorite ? "★" : "☆"}</span>
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>
        </div>
        {(tags.functional.length > 0 || tags.flavor.length > 0) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {tags.functional.map((tag) => (
              <span key={`func-${tag}`} className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
                {tag}
              </span>
            ))}
            {tags.flavor.map((tag) => (
              <span key={`flavor-${tag}`} className="rounded-full bg-orange-50 px-3 py-1 text-orange-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        {recipe.description && <p className="max-w-2xl text-sm text-slate-600">{recipe.description}</p>}
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-emerald-700">Ingredients</h2>
          <ul className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {ingredientRows.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{item.name}</span>
                <span className="text-right text-sm text-slate-500">
                  <span className="font-medium text-slate-600">
                    {item.scaledQuantity === null
                      ? "NA"
                      : `${formatNumber(item.scaledQuantity)} ${item.unit ?? ""}`.trim()}
                  </span>
                  {item.scaledQuantityInGrams !== null ? (
                    <span className="ml-1 text-xs text-slate-400">
                      ({formatNumber(item.scaledQuantityInGrams)} g eq.)
                    </span>
                  ) : null}
                  {effectiveMultiplier !== 1 && item.quantity !== null ? (
                    <span className="block text-xs text-slate-400">
                      Base {formatNumber(item.quantity)} {item.unit ?? ""}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-lg font-semibold text-emerald-700">Nutrition for selected servings</h3>
                <p className="text-xs text-slate-500">
                  Current multiplier: {formatNumber(multiplier, 2)} x {perServing ? "(based on per-serving data)" : "(based on total recipe data)"}
                </p>
              </div>
            </div>
            <NutrientProgressList entries={nutrientEntries} />

          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-700">Log to today</h2>
          <div className="space-y-3">
            <span className="text-xs font-medium text-slate-500">Quick multiplier presets</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_MULTIPLIERS.map((value) => {
                const active = multiplier === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handlePresetClick(value)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "bg-emerald-500 text-white shadow"
                        : "border border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300"
                    }`}
                  >
                    {value}x
                  </button>
                );
              })}
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-slate-600">Custom multiplier</span>
              <input
                value={customMultiplier}
                onChange={(event) => handleCustomMultiplierChange(event.target.value)}
                type="number"
                min="0.1"
                step="0.1"
                className="rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={savingLog}
            onClick={handleAddToToday}
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition ${
              savingLog ? "bg-emerald-300" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {savingLog ? "Adding..." : "Add to today"}
          </button>
          {status && <p className="text-xs text-slate-600">{status}</p>}
          <Link
            href="/rdi-tracker"
            className="block text-center text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            Open dashboard →
          </Link>
        </aside>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-emerald-700">Preparation notes</h2>
        {detail.steps.length > 0 ? (
          <ol className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {detail.steps.map((step, index) => (
              <li key={index} className="text-sm text-slate-600">
                <span className="font-semibold text-emerald-600">Step {index + 1}:</span> {step}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No method recorded yet. Add your own notes in the description once editing is available.
          </p>
        )}
      </section>
    </div>
  );
}










