"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RecipeCard, type RecipeSummary } from "@/components/RecipeCard";

const FLAVOR_OPTIONS = [
  { label: "酸", value: "SOUR" },
  { label: "甜", value: "SWEET" },
  { label: "苦", value: "BITTER" },
  { label: "草本", value: "HERBAL" },
  { label: "清爽", value: "FRESH" },
  { label: "濃烈", value: "STRONG" },
] as const;

const LOCAL_FAVORITES_KEY = "juice:favorites";
const SEARCH_DEBOUNCE = 300;
const MAX_NEW_RECIPES = 6;
const MAX_FAVORITES = 6;

type RecipeResponse = {
  items: RecipeSummary[];
  error?: string;
};

type FetchState<T> = {
  loading: boolean;
  error: string | null;
  items: T;
};

function readLocalFavorites(): RecipeSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item?.id === "number" ? item : null))
        .filter(Boolean) as RecipeSummary[];
    }
  } catch (error) {
    console.warn("[home:favorites] failed to parse local storage", error);
  }
  return [];
}

function persistLocalFavorites(items: RecipeSummary[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(items.slice(0, MAX_FAVORITES)));
  } catch (error) {
    console.warn("[home:favorites] failed to write local storage", error);
  }
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [searchState, setSearchState] = useState<FetchState<RecipeSummary[]>>({
    loading: false,
    error: null,
    items: [],
  });

  const [newState, setNewState] = useState<FetchState<RecipeSummary[]>>({
    loading: true,
    error: null,
    items: [],
  });

  const [favorites, setFavorites] = useState<RecipeSummary[]>([]);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setSearchState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set("query", debouncedQuery);
        params.set("limit", "9");
        const response = await fetch(`/api/recipes?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to load recipes");
        }
        const data: RecipeResponse = await response.json();
        setSearchState({ loading: false, error: null, items: data.items ?? [] });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[home] GET /api/recipes (search)", error);
        setSearchState({ loading: false, error: error instanceof Error ? error.message : "Unable to load recipes", items: [] });
      }
    };

    run();
    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const loadNew = async () => {
      try {
        const params = new URLSearchParams({ limit: String(MAX_NEW_RECIPES), sort: "new" });
        const response = await fetch(`/api/recipes?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to load new recipes");
        }
        const data: RecipeResponse = await response.json();
        setNewState({ loading: false, error: null, items: data.items ?? [] });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[home] GET /api/recipes (new)", error);
        setNewState({ loading: false, error: error instanceof Error ? error.message : "Unable to load new recipes", items: [] });
      }
    };

    loadNew();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await fetch("/api/recipes?favorite=true&limit=12", { cache: "no-store" });
        if (response.ok) {
          const data: RecipeResponse = await response.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            setFavorites(data.items.slice(0, MAX_FAVORITES));
            persistLocalFavorites(data.items);
            return;
          }
        }
      } catch (error) {
        console.warn("[home] GET /api/recipes?favorite fallback", error);
      }
      setFavorites(readLocalFavorites());
    };
    loadFavorites();
  }, []);

  const handleFavoriteToggle = (recipe: RecipeSummary) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.id === recipe.id);
      const next = exists ? prev.filter((item) => item.id !== recipe.id) : [recipe, ...prev];
      persistLocalFavorites(next);
      return next.slice(0, MAX_FAVORITES);
    });
  };

  return (
    <div className="flex flex-col gap-12 pb-16">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-orange-50 px-6 py-10 shadow-sm sm:px-10">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold text-emerald-700 sm:text-4xl">Juice Health &amp; Slimming</h1>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Discover homemade juice ideas, keep track of daily nutrients, and stay on top of your recommended intake.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-sm sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋食譜或食材"
            className="flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <div className="flex items-center gap-2 text-xs text-slate-500 sm:w-auto">
            <span>Results:</span>
            {searchState.loading ? <span className="text-emerald-600">Loading...</span> : <span>{searchState.items.length}</span>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {FLAVOR_OPTIONS.map((flavor) => (
            <Link
              key={flavor.value}
              href={`/recipes?flavor=${encodeURIComponent(flavor.value)}`}
              className="rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-medium text-orange-600 transition hover:border-orange-400 hover:bg-orange-50"
            >
              {flavor.label}
            </Link>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Quick links:</span>
          <Link href="/recipes" className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 transition hover:bg-emerald-200">
            Browse all recipes
          </Link>
          <Link
            href="/rdi-tracker"
            className="rounded-full bg-orange-100 px-3 py-1 text-orange-600 transition hover:bg-orange-200"
          >
            View today&apos;s dashboard
          </Link>
          <Link
            href="/my-kitchen"
            className="rounded-full bg-white px-3 py-1 text-emerald-600 transition hover:bg-emerald-100"
          >
            Open My Kitchen
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-emerald-700">Search results</h2>
            <p className="text-sm text-slate-500">Live results based on your keywords.</p>
          </div>
          <span className="text-xs text-slate-400">{debouncedQuery ? `Query: "${debouncedQuery}"` : "Showing recent entries"}</span>
        </header>
        {searchState.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{searchState.error}</p>
        ) : searchState.loading ? (
          <p className="text-sm text-slate-500">Loading recipes...</p>
        ) : searchState.items.length === 0 ? (
          <p className="text-sm text-slate-500">No recipes matched your search. Try another term or explore flavors.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {searchState.items.map((recipe) => (
              <RecipeCard
                key={`search-${recipe.id}`}
                recipe={recipe}
                href={`/recipes/${recipe.id}`}
                isFavorite={favoriteIds.has(recipe.id)}
                onToggleFavorite={handleFavoriteToggle}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-orange-600">New recipes</h2>
            <p className="text-sm text-slate-500">Freshly added juices to kick-start your day.</p>
          </div>
          <Link
            href="/recipes?sort=new"
            className="rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-orange-600 transition hover:border-orange-300 hover:bg-orange-50"
          >
            See more
          </Link>
        </header>
        {newState.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{newState.error}</p>
        ) : newState.loading ? (
          <p className="text-sm text-slate-500">Loading new recipes...</p>
        ) : newState.items.length === 0 ? (
          <p className="text-sm text-slate-500">No new recipes yet. Seed the database to see latest additions.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {newState.items.map((recipe) => (
              <RecipeCard
                key={`new-${recipe.id}`}
                recipe={recipe}
                href={`/recipes/${recipe.id}`}
                isFavorite={favoriteIds.has(recipe.id)}
                onToggleFavorite={handleFavoriteToggle}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-emerald-700">Favorites</h2>
            <p className="text-sm text-slate-500">Synced with your account when available; otherwise saved on this device.</p>
          </div>
        </header>
        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6 text-sm text-emerald-700">
            Tap the star on any recipe to add it to your favourites list.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.slice(0, MAX_FAVORITES).map((recipe) => (
              <RecipeCard
                key={`favorite-${recipe.id}`}
                recipe={recipe}
                href={`/recipes/${recipe.id}`}
                isFavorite
                onToggleFavorite={handleFavoriteToggle}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

