"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecipeCard, type RecipeSummary } from "@/components/RecipeCard";
import tagsConfig from "../../../data/tags.json";

type RecipeResponse = {
  items: RecipeSummary[];
  error?: string;
};

const FUNCTIONAL_TAGS: string[] = Array.isArray(tagsConfig.functional)
  ? (tagsConfig.functional as string[])
  : [];
const FLAVOR_TAGS: string[] = Array.isArray(tagsConfig.flavor)
  ? (tagsConfig.flavor as string[])
  : [];

export default function RecipesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [queryInput, setQueryInput] = useState(searchParams.get("query") ?? "");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get("query") ?? "";
  const functional = searchParams.get("tag") ?? searchParams.get("functional") ?? "";
  const flavor = searchParams.get("flavor") ?? "";

  const activeFunctionalTag = functional.toUpperCase();
  const activeFlavorTag = flavor.toUpperCase();

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  const fetchRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (activeFunctionalTag) params.set("tag", activeFunctionalTag);
      if (activeFlavorTag) params.set("flavor", activeFlavorTag);
      const response = await fetch(`/api/recipes?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load recipes");
      }
      const data: RecipeResponse = await response.json();
      setRecipes(data.items ?? []);
    } catch (err) {
      console.error("[/recipes]", err);
      setRecipes([]);
      setError(err instanceof Error ? err.message : "Unable to load recipes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeFunctionalTag, activeFlavorTag]);

  const updateParam = (key: string, value: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (value && value.trim()) {
      nextParams.set(key, value.trim());
    } else {
      nextParams.delete(key);
    }
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParam("query", queryInput);
  };

  const clearFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const resultCountLabel = useMemo(() => {
    if (loading) return "Loading...";
    if (recipes.length === 0) return "No recipes";
    return `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`;
  }, [loading, recipes]);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-emerald-700">Recipes</h1>
        <p className="text-sm text-slate-600">
          Filter by functional benefits or flavour moods, then open a recipe for full nutrition details.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-white/80 p-4 shadow-sm sm:flex-row"
      >
        <input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search recipes or ingredients"
          className="flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Functional tags</h2>
        <div className="flex flex-wrap gap-2">
          {FUNCTIONAL_TAGS.map((tag) => {
            const active = activeFunctionalTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => updateParam('tag', active ? null : tag)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow'
                    : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50'
                }`}
              >
                {tag.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Flavour tags</h2>
        <div className="flex flex-wrap gap-2">
          {FLAVOR_TAGS.map((tag) => {
            const active = activeFlavorTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => updateParam('flavor', active ? null : tag)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  active
                    ? 'border-orange-500 bg-orange-500 text-white shadow'
                    : 'border-orange-200 bg-white text-orange-600 hover:border-orange-400 hover:bg-orange-50'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">{resultCountLabel}</p>
          <Link
            href="/rdi-tracker"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            Check today&apos;s intake ??          </Link>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-500">Loading recipes...</p>
        ) : recipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No recipes match the selected filters. Try clearing the filters or using a different keyword.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} href={`/recipes/${recipe.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

