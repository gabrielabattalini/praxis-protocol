import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Guardas do registry do fluxo "Nova meta" (src/lib/task-creation.ts).
 *
 * A regra de segurança que NÃO pode ser solta num refactor:
 *  - sleep/run/nutrition sincronizam tarefas por sourceKey (o sleep
 *    chega a APAGAR task manual órfã do módulo) e work é planilha —
 *    esses tipos têm que ser "navigate", nunca quick-form;
 *  - o config de quick-form não pode ganhar campo sourceKey (tarefa
 *    manual jamais entra no canal das sincronizadas);
 *  - as categories do quick-form têm que espelhar o form nativo de cada
 *    módulo (home=productivity, mind=mindfulness, health=health) — é o
 *    que garante o mesmo XP nos dois caminhos de criação.
 */
const source = readFileSync(
  new URL("../../src/lib/task-creation.ts", import.meta.url),
  "utf8",
);

function entryBlock(key) {
  const start = source.indexOf(`  ${key}: {`);
  assert.ok(start > -1, `registry sem a entrada "${key}"`);
  const end = source.indexOf("  },", start);
  return source.slice(start, end);
}

test("modulos sync-only e planilha sao navigate (nunca quick-form)", () => {
  for (const key of ["sleep", "run", "nutrition", "work", "workout"]) {
    const block = entryBlock(key);
    assert.ok(
      block.includes('mode: "navigate"'),
      `"${key}" precisa ser navigate — quick-form criaria Task que o reconcile apaga ou lixo fora da entidade do módulo`,
    );
  }
});

test("quick-form so nos modulos de tarefa manual + meta avulsa", () => {
  const quickKeys = [...source.matchAll(/^ {2}(\w+): \{\n\s+mode: "quick-form"/gm)].map(
    (m) => m[1],
  );
  assert.deepEqual(quickKeys.sort(), ["custom", "health", "home", "mind"].sort());
});

test("config de quick-form nao tem campo sourceKey", () => {
  const typeStart = source.indexOf("export type QuickFormConfig");
  const typeEnd = source.indexOf("};", typeStart);
  const typeBlock = source.slice(typeStart, typeEnd);
  assert.ok(
    !typeBlock.includes("sourceKey"),
    "QuickFormConfig nao pode ter sourceKey — tarefa manual jamais entra no canal das sincronizadas",
  );
});

test("categories do quick-form espelham os forms nativos dos modulos", () => {
  assert.ok(entryBlock("home").includes('category: "productivity"'));
  assert.ok(entryBlock("mind").includes('category: "mindfulness"'));
  assert.ok(entryBlock("health").includes('category: "health"'));
});

test("mind mantem dificuldade fixa hard e health derivada (regras de XP)", () => {
  assert.ok(entryBlock("mind").includes('difficultyMode: "fixed-hard"'));
  assert.ok(entryBlock("health").includes('difficultyMode: "derived-health"'));
});

/**
 * O app NÃO pergunta dificuldade/XP ao usuário — essa mecânica saiu da UI
 * e os forms nativos dos módulos só definem por dentro. Um seletor voltou
 * a aparecer no form rápido uma vez; estes testes travam a regra.
 */
test("nenhum modo de dificuldade depende de escolha do usuario", () => {
  const modos = [...source.matchAll(/difficultyMode: "([^"]+)"/g)].map((m) => m[1]);
  for (const modo of modos) {
    assert.ok(
      ["default-medium", "fixed-hard", "derived-health"].includes(modo),
      `difficultyMode "${modo}" nao pode existir — sugere escolha manual do usuario`,
    );
  }
});

test("o form rapido nao renderiza seletor de dificuldade nem cita XP", () => {
  const form = readFileSync(
    new URL("../../src/components/ui/quick-task-form.tsx", import.meta.url),
    "utf8",
  );
  // Sem estado de escolha e sem handler de clique de dificuldade.
  assert.ok(
    !/setDifficulty/.test(form),
    "voltou um seletor de dificuldade no form rapido",
  );
  // Sem rotulo pedindo dificuldade/XP pro usuario (fora de comentarios).
  const semComentarios = form
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/Dificuldade|Leve|Difícil/.test(semComentarios),
    "rotulo de dificuldade voltou a aparecer na UI do form rapido",
  );
  assert.ok(
    !/\bXP\b/.test(semComentarios),
    "o form rapido nao deve expor XP ao usuario",
  );
});

test("registry cobre os 13 modulos + custom", () => {
  const keys = [...source.matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);
  assert.equal(new Set(keys).size, 14, `esperado 14 entradas; achou ${keys.length}`);
});
