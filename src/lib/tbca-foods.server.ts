import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TbcaFoodSearchResult } from "@/lib/types";

const TBCA_DB_PATH = path.join(process.cwd(), ".data", "tbca-foods.sqlite");

type FoodRow = {
  code: string;
  name: string;
  food_category: string;
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
    database = new DatabaseSync(TBCA_DB_PATH, {
      open: true,
      readOnly: true,
    });
  }

  return database;
}

export function isTbcaDatabaseAvailable() {
  return fs.existsSync(TBCA_DB_PATH);
}

export function searchTbcaFoods(query: string, limit = 12): TbcaFoodSearchResult[] {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const db = getDatabase();
  const safeLimit = Math.max(1, Math.min(24, Math.round(limit) || 12));
  const statement = db.prepare(`
    SELECT
      foods.code,
      foods.name,
      foods.food_category,
      foods.serving_label,
      foods.protein,
      foods.carbs,
      foods.fat,
      foods.fiber,
      foods.sodium,
      foods.calories
    FROM foods_fts
    JOIN foods ON foods.code = foods_fts.code
    WHERE foods_fts MATCH ?
    ORDER BY
      bm25(foods_fts),
      foods.name
    LIMIT ?
  `);

  const rows = statement.all(ftsQuery, safeLimit) as FoodRow[];

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    category: row.food_category || undefined,
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
