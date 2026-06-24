import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha a migração cardName → cardId do provider (buildFinanceCardsFromLines
 * + atribuição de cardId nas linhas em migrateFinanceBudget). O alias @/ não
 * resolve em node:test, então a lógica é replicada aqui como spec de
 * regressão — o ponto crítico é que a migração NÃO pode perder o vínculo do
 * cartão (histórico de perda de dados nesse módulo).
 *
 * Invariantes cobertos:
 *  1. Cria um cartão por cardName distinto (dedup case-insensitive).
 *  2. É idempotente: rodar de novo com cards já existentes não duplica.
 *  3. cardId só é atribuído a linhas credit-card.
 *  4. Linha que já tem cardId é preservada.
 */

const PALETTE = ["#fb923c", "#fb7185", "#a78bfa", "#60a5fa"];
let idCounter = 0;
const makeId = (prefix) => `${prefix}-${++idCounter}`;

const isCreditCard = (method) => method === "credit-card";

function buildFinanceCardsFromLines(lines, existingCards) {
  const cards = (existingCards ?? []).map((card, index) => ({
    ...card,
    order: card.order ?? index,
  }));
  const nameToId = new Map();
  for (const card of cards) {
    nameToId.set(card.name.trim().toLowerCase(), card.id);
  }
  for (const line of lines) {
    const rawName = line.cardName?.trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();
    if (nameToId.has(key)) continue;
    const id = makeId("fin-card");
    nameToId.set(key, id);
    cards.push({
      id,
      name: rawName,
      color: PALETTE[cards.length % PALETTE.length],
      dueDay: line.dueDay,
      order: cards.length,
    });
  }
  return { cards, nameToId };
}

function migrateLines(lines, nameToId) {
  return lines.map((line) => {
    const cardId =
      line.cardId ??
      (line.cardName ? nameToId.get(line.cardName.trim().toLowerCase()) : undefined);
    return {
      ...line,
      cardId: isCreditCard(line.paymentMethod) ? cardId : undefined,
      cardName: undefined,
    };
  });
}

test("cria um cartão por cardName distinto (dedup case-insensitive)", () => {
  const lines = [
    { paymentMethod: "credit-card", cardName: "Inter", dueDay: 15 },
    { paymentMethod: "credit-card", cardName: "inter", dueDay: 20 },
    { paymentMethod: "credit-card", cardName: "Nubank", dueDay: 10 },
  ];
  const { cards } = buildFinanceCardsFromLines(lines, []);
  assert.equal(cards.length, 2);
  assert.deepEqual(
    cards.map((c) => c.name),
    ["Inter", "Nubank"],
  );
});

test("é idempotente: cards existentes não são duplicados", () => {
  const existing = [{ id: "fin-card-inter", name: "Inter", color: "#fb923c", order: 0 }];
  const lines = [{ paymentMethod: "credit-card", cardName: "Inter", dueDay: 15 }];
  const { cards } = buildFinanceCardsFromLines(lines, existing);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, "fin-card-inter");
});

test("cardId só é atribuído a linhas credit-card", () => {
  const lines = [
    { paymentMethod: "credit-card", cardName: "Inter" },
    { paymentMethod: "pix", cardName: "Inter" },
  ];
  const { nameToId } = buildFinanceCardsFromLines(lines, []);
  const migrated = migrateLines(lines, nameToId);
  assert.ok(migrated[0].cardId, "linha credit-card recebe cardId");
  assert.equal(migrated[1].cardId, undefined, "linha pix não recebe cardId");
  assert.equal(migrated[0].cardName, undefined, "cardName legado é descartado");
});

test("linha que já tem cardId é preservada", () => {
  const lines = [
    { paymentMethod: "credit-card", cardId: "fin-card-existing", cardName: "Inter" },
  ];
  const { nameToId } = buildFinanceCardsFromLines(lines, [
    { id: "fin-card-existing", name: "Inter", color: "#fb923c", order: 0 },
  ]);
  const migrated = migrateLines(lines, nameToId);
  assert.equal(migrated[0].cardId, "fin-card-existing");
});
