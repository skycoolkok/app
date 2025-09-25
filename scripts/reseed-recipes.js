const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();
  try {
    const seedPath = path.join(__dirname, '..', 'data', 'recipes-seed.json');
    const raw = fs.readFileSync(seedPath, 'utf8');
    const seed = JSON.parse(raw);
    const nutritionPath = path.join(__dirname, '..', 'data', 'nutrition-seed.json');
    const nutritionSeed = fs.existsSync(nutritionPath)
      ? JSON.parse(fs.readFileSync(nutritionPath, 'utf8'))
      : [];

    console.log('[reseed] clearing existing recipe data...');
    await prisma.recipeIngredient.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.ingredient.deleteMany();

    const ingredientIds = new Map();
    const ingredientInput = seed.ingredients || [];
    for (const item of ingredientInput) {
      const created = await prisma.ingredient.create({
        data: {
          name: item.name,
          category: item.category ?? null,
          default_unit: item.default_unit ?? null,
          notes: item.notes ?? null,
        },
      });
      ingredientIds.set(item.name, created.id);
    }

    for (const entry of nutritionSeed) {
      const ingredientId = ingredientIds.get(entry.ingredient);
      if (!ingredientId) {
        console.warn(
          `[reseed] nutrition entry for "${entry.ingredient}" skipped (ingredient not found)`
        );
        continue;
      }
      const { ingredient: _ignored, ...rest } = entry;
      await prisma.nutritionFact.create({
        data: {
          ingredient: { connect: { id: ingredientId } },
          per_amount_value: rest.per_amount_value ?? 100,
          per_amount_unit: rest.per_amount_unit ?? 'g',
          calories_kcal: rest.calories_kcal ?? null,
          protein_g: rest.protein_g ?? null,
          fat_g: rest.fat_g ?? null,
          carbs_g: rest.carbs_g ?? null,
          fiber_g: rest.fiber_g ?? null,
          vitamin_c_mg: rest.vitamin_c_mg ?? null,
          vitamin_a_ug: rest.vitamin_a_ug ?? null,
          iron_mg: rest.iron_mg ?? null,
          calcium_mg: rest.calcium_mg ?? null,
          potassium_mg: rest.potassium_mg ?? null,
          sodium_mg: rest.sodium_mg ?? null,
          source: rest.source ?? 'seed',
          notes: rest.notes ?? null,
        },
      });
    }

    const recipeInput = seed.recipes || [];
    for (const recipe of recipeInput) {
      const ingredientsData = (recipe.ingredients || []).map((entry) => {
        const ingredientId = ingredientIds.get(entry.name);
        if (!ingredientId) {
          throw new Error(`Ingredient ${entry.name} not found for recipe ${recipe.name}`);
        }
        return {
          quantity: entry.quantity ?? null,
          unit: entry.unit ?? null,
          ingredient: {
            connect: { id: ingredientId },
          },
        };
      });

      await prisma.recipe.create({
        data: {
          name: recipe.name,
          category: recipe.category ?? null,
          description: recipe.description ?? null,
          servings: recipe.servings ?? null,
          notes: recipe.notes ?? null,
          source: recipe.source ?? null,
          ingredients: {
            create: ingredientsData,
          },
        },
      });
    }

    console.log('[reseed] completed successfully');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[reseed] failed', error);
  process.exit(1);
});
