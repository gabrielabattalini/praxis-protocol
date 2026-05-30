# Scripts arquivados

Scripts de uso único / incidentes / fase de design. Não estão wired ao
`package.json` nem ao CI. Mantidos pra histórico, não pra execução
rotineira.

## Importações one-off (KV/state)
- `import-diet-pdf-items.mjs` — importou alimentos do PDF da dieta do
  usuário para o account-state. Substituído pela UI do módulo Dieta.
- `import-shopping-mercado-suplementos.mjs` — importou planilha xlsx
  de compras de suplementos. Substituído pelo módulo Shopping.
- `import-workout-pacho-abc-pdf.mjs` — importou divisão de treino do
  PDF do Pacho.
- `reimport-shopping-market-all-online.mjs` — re-importou a lista do
  mercado a partir de PDF.

## Recuperação de incidente
- `recover-finance-from-xlsx-2026.mjs` — recuperação após bug que
  zerou orçamento em commit 5306246.
- `restore-diet-structure-pacho.mjs` — emergency restore após um
  state-wipe.

## Fase de design (Google Stitch MCP)
- `stitch-loop.js` — gerador de telas via Stitch (etapa de design).
- `download-stitch.js` — download das telas geradas.

Se precisar rodar um destes, copie pra `scripts/` raiz e ajuste paths.
