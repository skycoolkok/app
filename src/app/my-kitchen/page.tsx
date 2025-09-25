"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { RecipeCard, type RecipeSummary } from "@/components/RecipeCard";

const MAX_SUGGESTIONS = 10;

type IngredientOption = {
  id: number;
  name: string;
  category: string | null;
};
type SelectedIngredient = {
  key: string;
  id: number | null;
  name: string;
  category: string | null;
  isCustom?: boolean;
};


type KitchenResponse = {
  readyToMake: Array<RecipeSummary & { missingIngredientNames?: string[] }>;
  missingOne: Array<RecipeSummary & { missingIngredientNames?: string[] }>;
  error?: string;
};

type KitchenApiRecipe = {
  id: number;
  name: string;
  category?: string | null;
  servings?: number | null;
  tags?: { functional?: string[]; flavor?: string[] };
  missingIngredientNames?: string[];
};

export default function MyKitchenPage() {
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<SelectedIngredient[]>([]);
  const [readyToMake, setReadyToMake] = useState<KitchenResponse["readyToMake"]>([]);
  const [missingOne, setMissingOne] = useState<KitchenResponse["missingOne"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const response = await fetch("/api/ingredients", { cache: "force-cache" });
        if (!response.ok) {
          throw new Error("Failed to load ingredients");
        }
        const data = await response.json();
        setOptions(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        console.error("[ingredients]", err);
      }
    };
    loadIngredients();
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setReadyToMake([]);
      setMissingOne([]);
      return;
    }

    const controller = new AbortController();
    const loadSuggestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = JSON.stringify(selected.map((item) => (item.id !== null ? item.id : item.name)));
        const response = await fetch(`/api/mykitchen?supply=${encodeURIComponent(payload)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const fallback = await response.json().catch(() => null);
          throw new Error(fallback?.error ?? "Failed to load kitchen suggestions");
        }
        const data: KitchenResponse = await response.json();
        const mapRecipe = (recipe: KitchenApiRecipe) => ({
          id: recipe.id,
          name: recipe.name,
          category: recipe.category ?? null,
          servings: recipe.servings ?? null,
          functionalTags: recipe.tags?.functional ?? [],
          flavorTags: recipe.tags?.flavor ?? [],
          missingIngredientNames: recipe.missingIngredientNames ?? [],
        });

        setReadyToMake((data.readyToMake ?? []).map(mapRecipe));
        setMissingOne((data.missingOne ?? []).map(mapRecipe));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[my-kitchen]", err);
        setReadyToMake([]);
        setMissingOne([]);
        setError(err instanceof Error ? err.message : "Unable to fetch suggestions");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadSuggestions();
    return () => controller.abort();
  }, [selected]);

  const selectedNameSet = useMemo(
    () => new Set(selected.map((item) => item.name.toLowerCase())),
    [selected],
  );

  const filteredOptions = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    const selectedIds = new Set(
      selected
        .map((item) => item.id)
        .filter((id): id is number => id !== null),
    );
    return options
      .filter((item) => !selectedIds.has(item.id))
      .filter((item) => !selectedNameSet.has(item.name.toLowerCase()))
      .filter((item) => (lower ? item.name.toLowerCase().includes(lower) : true));
  }, [options, searchTerm, selected, selectedNameSet]);

  const trimmedSearch = searchTerm.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const canAddCustom =
    Boolean(normalizedSearch) &&
    !selectedNameSet.has(normalizedSearch) &&
    !filteredOptions.some((item) => item.name.toLowerCase() === normalizedSearch);

  const createSelectedFromOption = (option: IngredientOption): SelectedIngredient => ({
    key: `ingredient:${option.id}`,
    id: option.id,
    name: option.name,
    category: option.category ?? null,
  });

  const createCustomIngredient = (rawName: string): SelectedIngredient => {
    const name = rawName.trim();
    return {
      key: `custom:${name.toLowerCase()}`,
      id: null,
      name,
      category: null,
      isCustom: true,
    };
  };

  const removeIngredient = (key: string) => {
    setSelected((prev) => prev.filter((item) => item.key !== key));
  };

  const addIngredient = (entry: SelectedIngredient) => {
    setSelected((prev) => {
      const existsById = entry.id !== null && prev.some((item) => item.id === entry.id);
      const existsByName = prev.some((item) => item.name.toLowerCase() === entry.name.toLowerCase());
      if (existsById || existsByName) {
        return prev;
      }
      return [...prev, entry];
    });
    setSearchTerm("");
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (filteredOptions.length > 0) {
        addIngredient(createSelectedFromOption(filteredOptions[0]));
        return;
      }
      if (canAddCustom) {
        addIngredient(createCustomIngredient(trimmedSearch));
      }
    }
  };

  return (
    <div className="flex flex-col gap-10 pb-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-emerald-700">My Kitchen</h1>
        <p className="text-sm text-slate-600">
          Pick the ingredients you have today and we will suggest juice recipes you can make right now or that only need one extra item.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-700">Your ingredients</h2>
            <p className="text-xs text-slate-500">Search by name and add to your basket.</p>
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="relative">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type to search ingredients"
            className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          {trimmedSearch && (filteredOptions.length > 0 || canAddCustom) && (
            <ul className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {filteredOptions.slice(0, MAX_SUGGESTIONS).map((option) => (
                <li key={option.id} className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => addIngredient(createSelectedFromOption(option))}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-slate-600 transition hover:bg-emerald-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded border border-slate-300 px-1 text-xs text-slate-400">+</span>
                      <span>{option.name}</span>
                    </span>
                    <span className="text-xs text-slate-400">{option.category ?? "Uncategorised"}</span>
                  </button>
                </li>
              ))}
              {canAddCustom && (
                <li className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => addIngredient(createCustomIngredient(trimmedSearch))}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-emerald-700 transition hover:bg-emerald-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded border border-emerald-400 px-1 text-xs text-emerald-500">+</span>
                      <span>Add &ldquo;{trimmedSearch}&rdquo;</span>
                    </span>
                    <span className="text-xs text-emerald-500">Custom ingredient</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        {selected.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            Add at least one ingredient to see recipe suggestions.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => removeIngredient(item.key)}
                className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-200"
              >
                {item.name}
                {item.isCustom ? " (custom)" : ""} x
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-emerald-700">Ready to make</h2>
          <span className="text-xs text-slate-500">{readyToMake.length} matches</span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-500">Checking your pantry...</p>
        ) : readyToMake.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No full matches yet. Add more ingredients or explore the missing-one list below.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {readyToMake.map((recipe) => (
              <RecipeCard key={`ready-${recipe.id}`} recipe={recipe} href={`/recipes/${recipe.id}`} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-orange-600">Missing one ingredient</h2>
          <span className="text-xs text-slate-500">{missingOne.length} options</span>
        </div>
        {missingOne.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-sm text-orange-600">
            Keep adding supplies to unlock almost-ready recipes.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {missingOne.map((recipe) => (
              <div key={`missing-${recipe.id}`} className="space-y-2">
                <RecipeCard recipe={recipe} href={`/recipes/${recipe.id}`} />
                {recipe.missingIngredientNames?.length ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-600">
                    <span className="font-semibold">缺少：</span>
                    <span>{recipe.missingIngredientNames.join(", ")}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Want to plan ahead? Browse <Link href="/recipes" className="text-emerald-600 underline">all recipes</Link> or continue logging drinks in the <Link href="/rdi-tracker" className="text-emerald-600 underline">RDI tracker</Link>.
        </p>
      </section>
    </div>
  );
}



















