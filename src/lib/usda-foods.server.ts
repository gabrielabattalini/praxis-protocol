import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { UsdaFoodSearchResult } from "@/lib/types";

const USDA_DB_PATH = path.join(process.cwd(), ".data", "usda-foods.sqlite");

type FoodRow = {
  fdc_id: number;
  name: string;
  brand_name: string;
  brand_owner: string;
  food_category: string;
  data_type: string;
  serving_label: string;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  calories: number;
};

let database: DatabaseSync | null = null;

function normalizeSearchTokens(query: string) {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}

function buildFtsQuery(query: string) {
  const tokens = normalizeSearchTokens(query);
  if (!tokens.length) return "";
  return tokens.map((token) => `${token.replace(/"/g, '""')}*`).join(" AND ");
}

function getDatabase() {
  if (!database) {
    database = new DatabaseSync(USDA_DB_PATH, {
      open: true,
      readOnly: true,
    });
  }

  return database;
}

export function isUsdaDatabaseAvailable() {
  return fs.existsSync(USDA_DB_PATH);
}

export function searchUsdaFoods(query: string, limit = 12): UsdaFoodSearchResult[] {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const db = getDatabase();
  const safeLimit = Math.max(1, Math.min(24, Math.round(limit) || 12));
  const statement = db.prepare(`
    SELECT
      foods.fdc_id,
      foods.name,
      foods.brand_name,
      foods.brand_owner,
      foods.food_category,
      foods.data_type,
      foods.serving_label,
      foods.protein,
      foods.carbs,
      foods.fat,
      foods.fiber,
      foods.sodium,
      foods.calories
    FROM foods_fts
    JOIN foods ON foods.fdc_id = foods_fts.fdc_id
    WHERE foods_fts MATCH ?
    ORDER BY
      bm25(foods_fts),
      CASE foods.data_type
        WHEN 'foundation_food' THEN 0
        WHEN 'sr_legacy_food' THEN 1
        WHEN 'survey_fndds_food' THEN 2
        ELSE 3
      END,
      foods.name
    LIMIT ?
  `);

  const rows = statement.all(ftsQuery, safeLimit) as FoodRow[];

  return rows.map((row) => ({
    fdcId: row.fdc_id,
    name: row.name,
    brandName: row.brand_name || undefined,
    brandOwner: row.brand_owner || undefined,
    category: row.food_category || undefined,
    dataType: row.data_type,
    servingLabel: row.serving_label,
    macros: {
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      fiber: row.fiber,
      sodium: row.sodium,
      calories: row.calories,
    },
  }));
}
