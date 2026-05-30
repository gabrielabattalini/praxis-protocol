#!/usr/bin/env node
/**
 * One-off import: build the user's "Pacho ABC" weekly split (parsed
 * from TODAS AS PLANILHAS - TREINO PACHO ABC.pdf) and push it into
 * KV as a SavedWorkoutProgram. Activates the new program so the
 * workout module + the agenda's activity-multiplier pick it up
 * immediately.
 *
 * Layout:
 *   Mon  → Treino A — Peito, Ombro, Tríceps  (7 exercises + cardio)
 *   Tue  → Descanço ativo (cardio + abs)
 *   Wed  → Treino C — Pernas                  (7 exercises + cardio)
 *   Thu  → Descanço ativo (cardio + abs)
 *   Fri  → Treino B — Costas e Bíceps         (6 exercises + cardio)
 *   Sat  → Descanço ativo (cardio + abs)
 *   Sun  → Descanço total
 *
 * Idempotent: if a program named "Pacho ABC" already exists, it's
 * replaced (keeping the same id so completions/logs survive).
 *
 * Env:
 *   KV_REST_API_URL + KV_REST_API_TOKEN
 *   USERID (auto-detected when there's only one account in KV)
 *
 * Run:  node scripts/import-workout-pacho-abc-pdf.mjs
 */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
let userId = process.env.USERID || process.env.PRAXIS_USERID;

if (!KV_URL || !KV_TOKEN) {
  console.error("Missing KV creds (KV_REST_API_URL + KV_REST_API_TOKEN).");
  process.exit(1);
}

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) throw new Error(`KV get failed: ${r.status}`);
  const { result } = await r.json();
  return result ? JSON.parse(result) : null;
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error(`KV set failed: ${r.status}`);
}

async function kvKeys(pattern) {
  const r = await fetch(`${KV_URL}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) throw new Error(`KV keys failed: ${r.status}`);
  const { result } = await r.json();
  return result ?? [];
}

if (!userId) {
  const keys = await kvKeys("praxis:account-state:*");
  if (keys.length === 1) {
    userId = keys[0].replace(/^praxis:account-state:/, "");
    console.log(`USERID not set — using the only account key: ${userId}`);
  } else {
    console.error(`USERID not set and KV has ${keys.length} keys.`);
    process.exit(1);
  }
}

const makeId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

const STANDARD_REP_RANGE = "1) 12-15 · 2) 8-12 · 3) 6-10";

// Per-day exercise tables, faithfully copied from the PDF.
const ex = (name, muscleGroup, bodyArea) => ({
  id: makeId("exercise"),
  name,
  muscleGroup,
  bodyArea,
  sets: 3,
  repRange: STANDARD_REP_RANGE,
});

const treinoA = [
  ex("Supino inclinado no banco com halteres", "Peito", "Superior"),
  ex("Supino reto na máquina", "Peito", "Médio"),
  ex("Cross over na polia alta / crucifixo com halteres deitado", "Peito", "Inferior/médio"),
  ex("Desenvolvimento de ombros", "Ombro", "Anterior"),
  ex("Elevação lateral", "Ombro", "Lateral"),
  ex("Elevação frontal", "Ombro", "Anterior"),
  ex("Tríceps no cabo barra W", "Tríceps", "Cabeça longa/lateral"),
];

const treinoC = [
  ex("Agachamento livre ou no Smith", "Quadríceps", "Total"),
  ex("Hack machine", "Quadríceps", "Total"),
  ex("Cadeira extensora", "Quadríceps", "Vasto medial/lateral"),
  ex("Flexor deitado (mesa flexora)", "Posterior", "Bíceps femoral"),
  ex("Cadeira abdutora", "Glúteos", "Médio"),
  ex("Cadeira adutora", "Glúteos", "Adutor"),
  ex("Panturrilha", "Panturrilha", "Gastrocnêmio/sóleo"),
];

const treinoB = [
  ex("Remada curvada", "Costas", "Dorsal/romboides"),
  ex("Serrote", "Costas", "Dorsal"),
  ex("Puxador frente pegada supinada", "Costas", "Dorsal/bíceps"),
  ex("Remada baixa com triângulo sentado", "Costas", "Dorsal/romboides"),
  ex("Rosca martelo", "Bíceps", "Braquial"),
  ex("Rosca direta", "Bíceps", "Bíceps braquial"),
];

const REST_ACCESSORY = [
  "Prancha até a falha — 3x ou 60s",
  "Abdominal infra na máquina ou barra fixa — 3x10",
  "Vacuum — 3x",
];

const cardioBlock = () => ({
  id: makeId("cardio"),
  label: "Cardio steady state",
  durationMinutes: 45,
});

const buildDay = ({
  weekday,
  title,
  focus,
  summary,
  isRestDay,
  exercises,
  accessoryWork,
  withCardio,
}) => ({
  id: makeId("workout-day"),
  weekday,
  title,
  focus,
  summary,
  isRestDay,
  exercises,
  accessoryWork,
  cardio: withCardio ? cardioBlock() : undefined,
});

const workoutPlan = [
  buildDay({
    weekday: "monday",
    title: "Treino A — Peito, Ombro, Tríceps",
    focus: "Peito + Ombro + Tríceps",
    summary: "Pacho ABC · 7 exercícios + cardio",
    isRestDay: false,
    exercises: treinoA,
    accessoryWork: [],
    withCardio: true,
  }),
  buildDay({
    weekday: "tuesday",
    title: "Descanço ativo",
    focus: "Cardio + abdômen",
    summary: "45 min cardio + prancha / abdominal / vacuum",
    isRestDay: true,
    exercises: [],
    accessoryWork: REST_ACCESSORY,
    withCardio: true,
  }),
  buildDay({
    weekday: "wednesday",
    title: "Treino C — Pernas",
    focus: "Pernas (quad + posterior + glúteo + panturrilha)",
    summary: "Pacho ABC · 7 exercícios + cardio",
    isRestDay: false,
    exercises: treinoC,
    accessoryWork: [],
    withCardio: true,
  }),
  buildDay({
    weekday: "thursday",
    title: "Descanço ativo",
    focus: "Cardio + abdômen",
    summary: "45 min cardio + prancha / abdominal / vacuum",
    isRestDay: true,
    exercises: [],
    accessoryWork: REST_ACCESSORY,
    withCardio: true,
  }),
  buildDay({
    weekday: "friday",
    title: "Treino B — Costas e Bíceps",
    focus: "Costas + Bíceps",
    summary: "Pacho ABC · 6 exercícios + cardio",
    isRestDay: false,
    exercises: treinoB,
    accessoryWork: [],
    withCardio: true,
  }),
  buildDay({
    weekday: "saturday",
    title: "Descanço ativo",
    focus: "Cardio + abdômen",
    summary: "45 min cardio + prancha / abdominal / vacuum",
    isRestDay: true,
    exercises: [],
    accessoryWork: REST_ACCESSORY,
    withCardio: true,
  }),
  buildDay({
    weekday: "sunday",
    title: "Descanço total",
    focus: "Recuperação",
    summary: "Sem treino agendado",
    isRestDay: true,
    exercises: [],
    accessoryWork: [],
    withCardio: false,
  }),
];

const KEY = `praxis:account-state:${userId}`;
const envelope = await kvGet(KEY);
if (!envelope) {
  console.error(`No account state found for ${userId}.`);
  process.exit(2);
}

const state = envelope.state;
if (!state || typeof state !== "object") {
  console.error("State payload is not an object.");
  process.exit(3);
}

const programs = Array.isArray(state.workoutPrograms)
  ? state.workoutPrograms
  : [];

// Idempotency: if "Pacho ABC" exists, reuse its id so the rest of the
// state (workoutLoadEntries, workoutDayCompletions) keeps pointing at
// a real program. Otherwise mint a fresh id.
const existing = programs.find((p) => p && p.name === "Pacho ABC");
const programId = existing ? existing.id : makeId("workout-program");

const nextProgram = {
  id: programId,
  name: "Pacho ABC",
  splitLabel: "ABC + cardio diário",
  startDate: undefined,
  endDate: undefined,
  notes:
    "Importado do PDF TODAS AS PLANILHAS — TREINO PACHO ABC. " +
    "1ª série 12-15 reps · 2ª série 8-12 reps · 3ª série 6-10 reps.",
  createdAt: existing?.createdAt ?? new Date().toISOString(),
  workoutPlan,
};

const nextPrograms = existing
  ? programs.map((p) => (p.id === programId ? nextProgram : p))
  : [nextProgram, ...programs];

state.workoutPrograms = nextPrograms;
state.activeWorkoutProgramId = programId;
// Mirror it on the legacy top-level workoutPlan slot too (some old
// reads still fall back to it).
state.workoutPlan = workoutPlan;

await kvSet(KEY, {
  version: (typeof envelope.version === "number" ? envelope.version : 1) + 1,
  updatedAt: new Date().toISOString(),
  state,
});

console.log(
  existing
    ? `Replaced existing "Pacho ABC" (id=${programId}).`
    : `Created "Pacho ABC" (id=${programId}).`,
);
console.log(`Active program set. Days breakdown:`);
workoutPlan.forEach((d) => {
  const tag = d.isRestDay ? "[REST]" : "[TRAIN]";
  const lift = d.exercises.length;
  const acc = d.accessoryWork.length;
  const card = d.cardio ? `${d.cardio.durationMinutes}min cardio` : "no cardio";
  console.log(`  ${tag} ${d.weekday.padEnd(9)} ${d.title} — ${lift}x · ${acc} acc · ${card}`);
});
