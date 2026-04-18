import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const PROJECT_ROOT = process.cwd();
const OUTPUT_DB_PATH = path.join(PROJECT_ROOT, ".data", "usda-foods.sqlite");
const INCLUDED_DATA_TYPES = new Set([
  "branded_food",
  "foundation_food",
  "sr_legacy_food",
  "survey_fndds_food",
]);
const NUTRIENT_COLUMNS = {
  "1003": "protein",
  "1004": "fat",
  "1005": "carbs",
  "1079": "fiber",
  "1093": "sodium",
  "1008": "calories",
};

function resolveSourceDir() {
  const candidates = [];
  const sourceRoots = [PROJECT_ROOT, path.join(PROJECT_ROOT, ".sources")];
  if (process.env.USDA_FOOD_DATA_DIR) {
    candidates.push(process.env.USDA_FOOD_DATA_DIR);
  }

  for (const sourceRoot of sourceRoots) {
    if (!fs.existsSync(sourceRoot)) {
      continue;
    }

    for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("FoodData_Central_csv_")) {
        continue;
      }

      candidates.push(path.join(sourceRoot, entry.name, entry.name));
      candidates.push(path.join(sourceRoot, entry.name));
    }
  }

  const requiredFiles = ["food.csv", "food_nutrient.csv", "branded_food.csv"];
  const sourceDir = candidates.find((candidate) =>
    requiredFiles.every((fileName) => fs.existsSync(path.join(candidate, fileName))),
  );

  if (!sourceDir) {
    throw new Error(
      "Nao encontrei a pasta do FoodData Central. Defina USDA_FOOD_DATA_DIR ou mantenha o dump dentro do projeto.",
    );
  }

  return sourceDir;
}

async function* parseCsvRows(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  let row = [];
  let field = "";
  let inQuotes = false;
  let pendingQuote = false;

  for await (const chunk of stream) {
    let index = 0;

    if (pendingQuote) {
      if (chunk[index] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
      pendingQuote = false;
    }

    for (; index < chunk.length; index += 1) {
      const char = chunk[index];

      if (char === '"') {
        if (inQuotes) {
          if (index + 1 < chunk.length) {
            if (chunk[index + 1] === '"') {
              field += '"';
              index += 1;
            } else {
              inQuotes = false;
            }
          } else {
            pendingQuote = true;
          }
        } else {
          inQuotes = true;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && chunk[index + 1] === "\n") {
          index += 1;
        }
        row.push(field);
        field = "";
        yield row;
        row = [];
        continue;
      }

      field += char;
    }
  }

  if (pendingQuote) {
    inQuotes = false;
  }

  if (field.length || row.length) {
    row.push(field);
    yield row;
  }
}

function toHeaderIndex(headerRow) {
  return Object.fromEntries(headerRow.map((column, index) => [column, index]));
}

function trimNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function normalizeBrandedUnit(unit) {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "g" || normalized === "grm" || normalized === "gm") return "g";
  if (normalized === "ml" || normalized === "mlt") return "ml";
  if (normalized === "mg") return "mg";
  return null;
}

function resolveBrandedServing(servingSizeRaw, servingUnitRaw) {
  const servingSize = Number(servingSizeRaw);
  const normalizedUnit = normalizeBrandedUnit(servingUnitRaw);

  if (!Number.isFinite(servingSize) || servingSize <= 0 || !normalizedUnit) {
    return {
      servingLabel: "100 g",
      servingFactor: 1,
    };
  }

  const gramEquivalent =
    normalizedUnit === "mg" ? servingSize * 0.001 : servingSize;

  return {
    servingLabel: `${trimNumber(servingSize)} ${normalizedUnit}`,
    servingFactor: gramEquivalent / 100,
  };
}

function buildPortionLabel(amountRaw, measureName, portionDescription, modifier) {
  const amount = Number(amountRaw);
  const descriptor =
    modifier.trim() || portionDescription.trim() || measureName.trim() || "serving";

  if (!Number.isFinite(amount) || amount === 1) {
    return descriptor;
  }

  return `${trimNumber(amount)} ${descriptor}`.trim();
}

function createDatabase(db) {
  db.exec(`
    PRAGMA journal_mode = MEMORY;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;

    DROP TABLE IF EXISTS foods;
    DROP TABLE IF EXISTS foods_fts;
    DROP TABLE IF EXISTS import_meta;

    CREATE TABLE foods (
      fdc_id INTEGER PRIMARY KEY,
      data_type TEXT NOT NULL,
      name TEXT NOT NULL,
      brand_name TEXT NOT NULL DEFAULT '',
      brand_owner TEXT NOT NULL DEFAULT '',
      food_category TEXT NOT NULL DEFAULT '',
      serving_label TEXT NOT NULL,
      serving_factor REAL NOT NULL DEFAULT 1,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      fiber REAL NOT NULL DEFAULT 0,
      sodium REAL NOT NULL DEFAULT 0,
      calories REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE import_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function runInTransaction(db, callback) {
  db.exec("BEGIN");
  try {
    callback();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function loadMeasureUnits(sourceDir) {
  const measureUnits = new Map();
  const filePath = path.join(sourceDir, "measure_unit.csv");
  let headerIndex = null;

  for await (const row of parseCsvRows(filePath)) {
    if (!headerIndex) {
      headerIndex = toHeaderIndex(row);
      continue;
    }

    measureUnits.set(row[headerIndex.id], row[headerIndex.name] ?? "");
  }

  return measureUnits;
}

async function loadFoodPortions(sourceDir, measureUnits) {
  const portions = new Map();
  const filePath = path.join(sourceDir, "food_portion.csv");
  let headerIndex = null;

  for await (const row of parseCsvRows(filePath)) {
    if (!headerIndex) {
      headerIndex = toHeaderIndex(row);
      continue;
    }

    const fdcId = Number(row[headerIndex.fdc_id]);
    const gramWeight = Number(row[headerIndex.gram_weight]);
    if (!Number.isFinite(fdcId) || !Number.isFinite(gramWeight) || gramWeight <= 0) {
      continue;
    }
    if (portions.has(fdcId)) continue;

    const measureName = measureUnits.get(row[headerIndex.measure_unit_id]) ?? "";
    const servingLabel = buildPortionLabel(
      row[headerIndex.amount],
      measureName,
      row[headerIndex.portion_description] ?? "",
      row[headerIndex.modifier] ?? "",
    );

    portions.set(fdcId, {
      servingLabel,
      servingFactor: gramWeight / 100,
    });
  }

  return portions;
}

async function importFoods(db, sourceDir, portions) {
  const filePath = path.join(sourceDir, "food.csv");
  const candidateFoodIds = new Set();
  const insertFood = db.prepare(`
    INSERT INTO foods (
      fdc_id,
      data_type,
      name,
      food_category,
      serving_label,
      serving_factor
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertBatch = (rows) =>
    runInTransaction(db, () => {
      for (const row of rows) {
        insertFood.run(
          row.fdcId,
          row.dataType,
          row.name,
          row.foodCategory,
          row.servingLabel,
          row.servingFactor,
        );
      }
    });

  let headerIndex = null;
  let processed = 0;
  let inserted = 0;
  let batch = [];

  for await (const row of parseCsvRows(filePath)) {
    if (!headerIndex) {
      headerIndex = toHeaderIndex(row);
      continue;
    }

    processed += 1;
    const dataType = row[headerIndex.data_type];
    if (!INCLUDED_DATA_TYPES.has(dataType)) {
      continue;
    }

    const fdcId = Number(row[headerIndex.fdc_id]);
    if (!Number.isFinite(fdcId)) continue;

    const portion = portions.get(fdcId);
    batch.push({
      fdcId,
      dataType,
      name: row[headerIndex.description]?.trim() || `Food ${fdcId}`,
      foodCategory: row[headerIndex.food_category_id]?.trim() || "",
      servingLabel: portion?.servingLabel ?? "100 g",
      servingFactor: portion?.servingFactor ?? 1,
    });
    candidateFoodIds.add(fdcId);
    inserted += 1;

    if (batch.length >= 5000) {
      insertBatch(batch);
      batch = [];
      if (inserted % 100000 === 0) {
        console.log(`foods: ${inserted.toLocaleString()} importados`);
      }
    }
  }

  if (batch.length) {
    insertBatch(batch);
  }

  console.log(`foods.csv processado: ${processed.toLocaleString()} linhas`);
  console.log(`foods incluídos: ${inserted.toLocaleString()}`);
  return candidateFoodIds;
}

async function importBrandedFoods(db, sourceDir) {
  const filePath = path.join(sourceDir, "branded_food.csv");
  const updateFood = db.prepare(`
    UPDATE foods
    SET
      brand_name = ?,
      brand_owner = ?,
      food_category = ?,
      serving_label = ?,
      serving_factor = ?
    WHERE fdc_id = ?
  `);
  const updateBatch = (rows) =>
    runInTransaction(db, () => {
      for (const row of rows) {
        updateFood.run(
          row.brandName,
          row.brandOwner,
          row.foodCategory,
          row.servingLabel,
          row.servingFactor,
          row.fdcId,
        );
      }
    });

  let headerIndex = null;
  let updated = 0;
  let batch = [];

  for await (const row of parseCsvRows(filePath)) {
    if (!headerIndex) {
      headerIndex = toHeaderIndex(row);
      continue;
    }

    const fdcId = Number(row[headerIndex.fdc_id]);
    if (!Number.isFinite(fdcId)) continue;

    const { servingLabel, servingFactor } = resolveBrandedServing(
      row[headerIndex.serving_size],
      row[headerIndex.serving_size_unit],
    );

    batch.push({
      fdcId,
      brandName: row[headerIndex.brand_name]?.trim() || "",
      brandOwner: row[headerIndex.brand_owner]?.trim() || "",
      foodCategory: row[headerIndex.branded_food_category]?.trim() || "",
      servingLabel,
      servingFactor,
    });
    updated += 1;

    if (batch.length >= 5000) {
      updateBatch(batch);
      batch = [];
      if (updated % 100000 === 0) {
        console.log(`branded_food: ${updated.toLocaleString()} atualizados`);
      }
    }
  }

  if (batch.length) {
    updateBatch(batch);
  }

  console.log(`branded_food.csv processado: ${updated.toLocaleString()} linhas`);
}

async function importFoodNutrients(db, sourceDir, candidateFoodIds) {
  const filePath = path.join(sourceDir, "food_nutrient.csv");
  const updateFood = db.prepare(`
    UPDATE foods
    SET
      protein = ROUND(? * serving_factor, 1),
      carbs = ROUND(? * serving_factor, 1),
      fat = ROUND(? * serving_factor, 1),
      fiber = ROUND(? * serving_factor, 1),
      sodium = ROUND(? * serving_factor, 0),
      calories = ROUND(? * serving_factor, 0)
    WHERE fdc_id = ?
  `);
  const updateBatch = (rows) =>
    runInTransaction(db, () => {
      for (const row of rows) {
        updateFood.run(
          row.protein ?? 0,
          row.carbs ?? 0,
          row.fat ?? 0,
          row.fiber ?? 0,
          row.sodium ?? 0,
          row.calories ?? 0,
          row.fdcId,
        );
      }
    });

  let headerIndex = null;
  let currentFdcId = null;
  let currentTotals = null;
  let batch = [];
  let processed = 0;
  let updated = 0;

  function flushCurrent() {
    if (!currentFdcId || !currentTotals) return;
    batch.push({
      fdcId: currentFdcId,
      ...currentTotals,
    });
    updated += 1;

    if (batch.length >= 5000) {
      updateBatch(batch);
      batch = [];
      if (updated % 100000 === 0) {
        console.log(`food_nutrient: ${updated.toLocaleString()} alimentos agregados`);
      }
    }
  }

  for await (const row of parseCsvRows(filePath)) {
    if (!headerIndex) {
      headerIndex = toHeaderIndex(row);
      continue;
    }

    processed += 1;
    const fdcId = Number(row[headerIndex.fdc_id]);
    if (!Number.isFinite(fdcId) || !candidateFoodIds.has(fdcId)) {
      continue;
    }

    if (currentFdcId !== null && fdcId !== currentFdcId) {
      flushCurrent();
      currentTotals = null;
    }

    if (fdcId !== currentFdcId) {
      currentFdcId = fdcId;
      currentTotals = {
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sodium: 0,
        calories: 0,
      };
    }

    const nutrientId = row[headerIndex.nutrient_id];
    const column = NUTRIENT_COLUMNS[nutrientId];
    if (!column || !currentTotals) {
      continue;
    }

    const amount = Number(row[headerIndex.amount]);
    if (Number.isFinite(amount)) {
      currentTotals[column] = amount;
    }
  }

  flushCurrent();
  if (batch.length) {
    updateBatch(batch);
  }

  console.log(`food_nutrient.csv lido: ${processed.toLocaleString()} linhas`);
  console.log(`nutrientes agregados para ${updated.toLocaleString()} alimentos`);
}

function rebuildSearchIndex(db) {
  db.exec(`
    DROP TABLE IF EXISTS foods_fts;
    CREATE VIRTUAL TABLE foods_fts USING fts5(
      fdc_id UNINDEXED,
      name,
      brand_name,
      brand_owner,
      food_category,
      tokenize = 'unicode61 remove_diacritics 2'
    );

    INSERT INTO foods_fts (fdc_id, name, brand_name, brand_owner, food_category)
    SELECT fdc_id, name, brand_name, brand_owner, food_category
    FROM foods;

    CREATE INDEX IF NOT EXISTS idx_foods_data_type ON foods (data_type);
    CREATE INDEX IF NOT EXISTS idx_foods_name ON foods (name);
  `);
}

function writeImportMeta(db, sourceDir) {
  const totalFoods = db.prepare("SELECT COUNT(*) AS total FROM foods").get().total;
  const insertMeta = db.prepare(`
    INSERT INTO import_meta (key, value)
    VALUES (?, ?)
  `);
  const insertMetaBatch = (rows) =>
    runInTransaction(db, () => {
      db.exec("DELETE FROM import_meta");
      for (const row of rows) {
        insertMeta.run(row.key, row.value);
      }
    });

  insertMetaBatch([
    { key: "source_dir", value: sourceDir },
    { key: "imported_at", value: new Date().toISOString() },
    { key: "total_foods", value: String(totalFoods) },
  ]);
}

async function main() {
  const sourceDir = resolveSourceDir();
  fs.mkdirSync(path.dirname(OUTPUT_DB_PATH), { recursive: true });
  fs.rmSync(OUTPUT_DB_PATH, { force: true });

  console.log(`Origem USDA: ${sourceDir}`);
  console.log(`Saida SQLite: ${OUTPUT_DB_PATH}`);

  const db = new DatabaseSync(OUTPUT_DB_PATH);
  createDatabase(db);

  console.time("load-measure-units");
  const measureUnits = await loadMeasureUnits(sourceDir);
  console.timeEnd("load-measure-units");

  console.time("load-food-portions");
  const portions = await loadFoodPortions(sourceDir, measureUnits);
  console.timeEnd("load-food-portions");

  console.time("import-foods");
  const candidateFoodIds = await importFoods(db, sourceDir, portions);
  console.timeEnd("import-foods");

  console.time("import-branded-foods");
  await importBrandedFoods(db, sourceDir);
  console.timeEnd("import-branded-foods");

  console.time("import-food-nutrients");
  await importFoodNutrients(db, sourceDir, candidateFoodIds);
  console.timeEnd("import-food-nutrients");

  console.time("rebuild-search-index");
  rebuildSearchIndex(db);
  console.timeEnd("rebuild-search-index");

  writeImportMeta(db, sourceDir);
  db.exec("VACUUM");
  db.close();

  console.log("Importacao USDA concluida.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
