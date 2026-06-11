/**
 * Data-alvo embutida no callback_data dos botões do Telegram.
 *
 * Bug que isto corrige: o "✓ Concluir" marcava a tarefa pra data do
 * CLIQUE, não pra data do disparo. Notificação saiu 23:50 do dia 1,
 * usuário clicou 00:10 do dia 2 → conclusão caía no dia 2. Agora o
 * botão carrega o dia do disparo num sufixo compacto "|YYMMDD" (7 bytes,
 * cabe no limite de 64 do Telegram) e o webhook conclui PRA AQUELE dia.
 *
 * Módulo propositalmente puro (zero imports, sem alias @/) pra ser
 * importável direto nos testes de unidade do node.
 */

const DATE_KEY_RE = /^\d{4}-(\d{2})-(\d{2})$/;
const SUFFIX_RE = /\|(\d{6})$/;

function isValidDateKey(value: string): boolean {
  const match = value.match(DATE_KEY_RE);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * "2026-06-11" → "|260611". dateKey inválido → "" (sem sufixo).
 * Século fixado em 20xx — suficiente até 2099.
 */
export function encodeCallbackDateSuffix(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return "";
  return `|${dateKey.slice(2, 4)}${dateKey.slice(5, 7)}${dateKey.slice(8, 10)}`;
}

/**
 * Anexa o sufixo de data ao callback_data SE couber nos 64 bytes do
 * Telegram. Não coube (ou data inválida) → retorna o callback sem data
 * (botão continua funcionando; a conclusão cai no fallback "hoje").
 */
export function appendCallbackDate(callbackData: string, dateKey: string): string {
  const suffix = encodeCallbackDateSuffix(dateKey);
  if (!suffix) return callbackData;
  const withDate = `${callbackData}${suffix}`;
  return byteLength(withDate) <= 64 ? withDate : callbackData;
}

/**
 * Separa o sufixo opcional "|YYMMDD" do callback_data recebido no
 * webhook. Mensagens antigas (sem sufixo) → dateKey null, base intacta.
 */
export function splitCallbackDate(data: string): {
  base: string;
  dateKey: string | null;
} {
  const match = data.match(SUFFIX_RE);
  if (!match) return { base: data, dateKey: null };
  const digits = match[1];
  const dateKey = `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  if (!isValidDateKey(dateKey)) return { base: data, dateKey: null };
  return { base: data.slice(0, -match[0].length), dateKey };
}

/**
 * Resolve a data efetiva da conclusão: a data-alvo do botão quando é
 * válida e não está no futuro (comparação lexicográfica funciona em
 * YYYY-MM-DD); senão, "hoje" no fuso do usuário. Datas futuras são
 * clampadas em hoje (não dá pra concluir o amanhã por clock skew).
 */
export function resolveCompletionDateKey(
  targetDateKey: string | null | undefined,
  todayKey: string,
): string {
  if (!targetDateKey || !isValidDateKey(targetDateKey)) return todayKey;
  if (targetDateKey > todayKey) return todayKey;
  return targetDateKey;
}
