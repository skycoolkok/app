export const NUTRIENT_META = {
  calories_kcal: { label: 'Calories', unit: 'kcal', rdiKey: 'calories' },
  protein_g: { label: 'Protein', unit: 'g', rdiKey: 'protein' },
  fat_g: { label: 'Fat', unit: 'g', rdiKey: 'fat' },
  carbs_g: { label: 'Carbohydrates', unit: 'g', rdiKey: 'carbohydrate' },
  fiber_g: { label: 'Fiber', unit: 'g', rdiKey: 'fiber' },
  vitamin_c_mg: { label: 'Vitamin C', unit: 'mg', rdiKey: 'vitamin_c' },
  vitamin_a_ug: { label: 'Vitamin A', unit: 'mcg', rdiKey: 'vitamin_a' },
  iron_mg: { label: 'Iron', unit: 'mg', rdiKey: 'iron' },
  calcium_mg: { label: 'Calcium', unit: 'mg', rdiKey: 'calcium' },
  potassium_mg: { label: 'Potassium', unit: 'mg', rdiKey: 'potassium' },
  sodium_mg: { label: 'Sodium', unit: 'mg', rdiKey: 'sodium' },
} as const;

export type NutrientKey = keyof typeof NUTRIENT_META;

export const NUTRIENT_KEYS = Object.keys(NUTRIENT_META) as NutrientKey[];
