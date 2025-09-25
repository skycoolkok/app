"use client";

import Link from "next/link";

export type RecipeSummary = {
  id: number;
  name: string;
  category: string | null;
  servings: number | null;
  ingredientIds?: number[];
  functionalTags?: string[];
  flavorTags?: string[];
  missingIngredientNames?: string[];
};

type RecipeCardProps = {
  recipe: RecipeSummary;
  href?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (recipe: RecipeSummary) => void;
};

export function RecipeCard({ recipe, href, isFavorite = false, onToggleFavorite }: RecipeCardProps) {
  const body = (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-emerald-700">{recipe.name}</h3>
            <p className="text-xs text-slate-500">
              {recipe.category ?? "Uncategorised"}
              {typeof recipe.servings === "number" && recipe.servings > 0 ? ` · ${recipe.servings} servings` : ""}
            </p>
          </div>
          {onToggleFavorite && (
            <button
              type="button"
              className={`rounded-full border px-2 py-1 text-xs font-medium transition ${
                isFavorite
                  ? "border-orange-500 bg-orange-100 text-orange-600"
                  : "border-slate-200 text-slate-500 hover:border-orange-400 hover:text-orange-500"
              }`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(recipe);
              }}
            >
              {isFavorite ? "Favorited" : "Favorite"}
            </button>
          )}
        </div>
        {(recipe.functionalTags?.length || recipe.flavorTags?.length) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {recipe.functionalTags?.map((tag) => (
              <span key={`func-${tag}`} className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
                {tag}
              </span>
            ))}
            {recipe.flavorTags?.map((tag) => (
              <span key={`flavor-${tag}`} className="rounded-full bg-orange-50 px-3 py-1 text-orange-600">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 text-xs text-slate-400">查看詳情 →</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }

  return body;
}
