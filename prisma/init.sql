-- CreateTable
CREATE TABLE "Ingredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "default_unit" TEXT,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "servings" REAL,
    "description" TEXT,
    "notes" TEXT,
    "source" TEXT
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "recipe_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity" REAL,
    "unit" TEXT,
    "preparation_notes" TEXT,

    PRIMARY KEY ("recipe_id", "ingredient_id"),
    CONSTRAINT "RecipeIngredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NutritionFact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ingredient_id" INTEGER NOT NULL,
    "per_amount_value" REAL NOT NULL,
    "per_amount_unit" TEXT NOT NULL,
    "calories_kcal" REAL,
    "protein_g" REAL,
    "fat_g" REAL,
    "carbs_g" REAL,
    "fiber_g" REAL,
    "vitamin_c_mg" REAL,
    "vitamin_a_ug" REAL,
    "iron_mg" REAL,
    "calcium_mg" REAL,
    "potassium_mg" REAL,
    "sodium_mg" REAL,
    "source" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NutritionFact_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "anon_id" TEXT,
    "age" INTEGER,
    "sex" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IntakeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "logged_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "IntakeLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntakeItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "intake_log_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER,
    "recipe_id" INTEGER,
    "amount_value" REAL,
    "amount_unit" TEXT,
    "notes" TEXT,
    CONSTRAINT "IntakeItem_intake_log_id_fkey" FOREIGN KEY ("intake_log_id") REFERENCES "IntakeLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntakeItem_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntakeItem_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "user_id" INTEGER NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("user_id", "recipe_id"),
    CONSTRAINT "Favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RecipeTag" (
    "recipe_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    PRIMARY KEY ("recipe_id", "tag_id"),
    CONSTRAINT "RecipeTag_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ingredient_id" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    CONSTRAINT "IngredientAlias_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomNutrition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "intake_item_id" INTEGER NOT NULL,
    "base_amount_value" REAL NOT NULL,
    "base_amount_unit" TEXT NOT NULL,
    "calories_kcal" REAL,
    "protein_g" REAL,
    "fat_g" REAL,
    "carbs_g" REAL,
    "fiber_g" REAL,
    "vitamin_c_mg" REAL,
    "vitamin_a_ug" REAL,
    "iron_mg" REAL,
    "calcium_mg" REAL,
    "potassium_mg" REAL,
    "sodium_mg" REAL,
    "source" TEXT,
    "notes" TEXT,
    CONSTRAINT "CustomNutrition_intake_item_id_fkey" FOREIGN KEY ("intake_item_id") REFERENCES "IntakeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RDIStandard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nutrient" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sex" TEXT,
    "age_min" INTEGER,
    "age_max" INTEGER,
    "value_per_day" REAL NOT NULL,
    "region" TEXT,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_name_key" ON "Recipe"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_anon_id_key" ON "User"("anon_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_type_key" ON "Tag"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_alias_key" ON "IngredientAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "CustomNutrition_intake_item_id_key" ON "CustomNutrition"("intake_item_id");

-- CreateIndex
CREATE INDEX "RDIStandard_nutrient_sex_age_min_age_max_region_idx" ON "RDIStandard"("nutrient", "sex", "age_min", "age_max", "region");
