import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

const PROJECT_ROOT = process.cwd();
const OUTPUT_DB_PATH = path.join(PROJECT_ROOT, ".data", "tbca-foods.sqlite");

const nutrientMapping = {
  "Energia|kcal": "calories",
  "Proteína|g": "protein",
  "Carboidrato total|g": "carbs",
  "Lipídios|g": "fat",
  "Fibra alimentar|g": "fiber",
  "Sódio|mg": "sodium",
};

function resolveTbcaDataFile() {
  const candidates = [];
  const sourceRoots = [PROJECT_ROOT, path.join(PROJECT_ROOT, ".sources")];

  if (process.env.TBCA_DATA_FILE) {
    candidates.push(process.env.TBCA_DATA_FILE);
  }

  if (process.env.TBCA_SOURCE_DIR) {
    candidates.push(path.join(process.env.TBCA_SOURCE_DIR, "alimentos.txt"));
  }

  for (const sourceRoot of sourceRoots) {
    if (!fs.existsSync(sourceRoot)) {
      continue;
    }

    for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("web-scraping-tbca")) {
        continue;
      }

      candidates.push(path.join(sourceRoot, entry.name, entry.name, "alimentos.txt"));
      candidates.push(path.join(sourceRoot, entry.name, "alimentos.txt"));
    }
  }

  const dataFile = candidates.find((candidate) => fs.existsSync(candidate));

  if (!dataFile) {
    throw new Error(
      "Nao encontrei o alimentos.txt da TBCA. Defina TBCA_DATA_FILE ou mantenha o repo do scraper dentro do projeto.",
    );
  }

  return dataFile;
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
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      food_category TEXT NOT NULL DEFAULT '',
      serving_label TEXT NOT NULL,
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

function parseTbcaNumber(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(",", ".");

  if (!normalized || normalized === "na" || normalized === "n/a" || normalized === "tr") {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTbcaText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\bs\//gi, "sem ")
    .replace(/\bc\//gi, "com ")
    .replace(/\s+,/g, ",")
    .replace(/,+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function importTbcaFoods(db, dataFile) {
  const insertFood = db.prepare(`
    INSERT INTO foods (
      code,
      name,
      food_category,
      serving_label,
      protein,
      carbs,
      fat,
      fiber,
      sodium,
      calories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rl = readline.createInterface({
    input: fs.createReadStream(dataFile, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let batch = [];
  let count = 0;

  const flush = () =>
    runInTransaction(db, () => {
      for (const item of batch) {
        insertFood.run(
          item.code,
          item.name,
          item.category,
          item.servingLabel,
          item.protein,
          item.carbs,
          item.fat,
          item.fiber,
          item.sodium,
          item.calories,
        );
      }
    });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const rawItem = JSON.parse(line);
    const macros = {
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
      calories: 0,
    };

    for (const nutrient of rawItem.nutrientes ?? []) {
      const key = `${nutrient.Componente}|${nutrient.Unidades}`;
      const column = nutrientMapping[key];
      if (!column) continue;
      macros[column] = parseTbcaNumber(nutrient["Valor por 100g"]);
    }

    batch.push({
      code: rawItem.codigo,
      name: normalizeTbcaText(rawItem.descricao),
      category: normalizeTbcaText(rawItem.classe),
      servingLabel: "100 g",
      ...macros,
    });
    count += 1;

    if (batch.length >= 1000) {
      flush();
      batch = [];
      if (count % 1000 === 0) {
        console.log(`tbca: ${count.toLocaleString()} alimentos importados`);
      }
    }
  }

  if (batch.length) {
    flush();
  }

  return count;
}

function rebuildSearchIndex(db) {
  db.exec(`
    CREATE VIRTUAL TABLE foods_fts USING fts5(
      code UNINDEXED,
      name,
      food_category,
      tokenize = 'unicode61 remove_diacritics 2'
    );

    INSERT INTO foods_fts (code, name, food_category)
    SELECT code, name, food_category
    FROM foods;

    CREATE INDEX IF NOT EXISTS idx_tbca_foods_name ON foods (name);
  `);
}

function writeImportMeta(db, dataFile, totalFoods) {
  const insertMeta = db.prepare(`
    INSERT INTO import_meta (key, value)
    VALUES (?, ?)
  `);

  runInTransaction(db, () => {
    for (const row of [
      { key: "source_file", value: dataFile },
      { key: "imported_at", value: new Date().toISOString() },
      { key: "total_foods", value: String(totalFoods) },
    ]) {
      insertMeta.run(row.key, row.value);
    }
  });
}

async function main() {
  const dataFile = resolveTbcaDataFile();
  fs.mkdirSync(path.dirname(OUTPUT_DB_PATH), { recursive: true });
  fs.rmSync(OUTPUT_DB_PATH, { force: true });

  console.log(`Arquivo TBCA: ${dataFile}`);
  console.log(`Saida SQLite: ${OUTPUT_DB_PATH}`);

  const db = new DatabaseSync(OUTPUT_DB_PATH);
  createDatabase(db);

  console.time("import-tbca");
  const totalFoods = await importTbcaFoods(db, dataFile);
  console.timeEnd("import-tbca");

  console.time("rebuild-search-index");
  rebuildSearchIndex(db);
  console.timeEnd("rebuild-search-index");

  writeImportMeta(db, dataFile, totalFoods);
  db.exec("VACUUM");
  db.close();

  console.log(`Importacao TBCA concluida com ${totalFoods.toLocaleString()} alimentos.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
