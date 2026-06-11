# Notas de segurança

Registro curto dos itens de segurança em acompanhamento e das medidas já
aplicadas. Complementa a auditoria profunda do PR #137.

## Em acompanhamento

### postcss `<8.5.10` (GHSA-qx2v-qp2m-jg93) — moderado, transitivo do Next

- **Onde**: `node_modules/next/node_modules/postcss` (postcss `8.4.31`
  embutido pelo Next). O postcss de topo do projeto (via
  `@tailwindcss/postcss`) já está em `8.5.15`, fora do range vulnerável.
- **Risco real**: baixo. A falha é XSS via `</style>` não escapado na
  saída do *stringify* de CSS — só importa quando se serializa CSS de
  fonte não confiável. No Praxis isso só roda em *build-time* sobre CSS
  do próprio projeto; não há entrada de CSS de usuário em runtime.
- **Status upstream**: sem fix disponível. O Next ainda fixa
  `postcss@8.4.31` até `16.2.9` (versão atual) — bumpar patch do Next não
  limpa o aviso.
- **Ação**: manter o Next atualizado (hoje em `16.2.9`) e revisitar quando
  o Next passar a depender de `postcss >= 8.5.10`. Rodar `npm audit`
  periodicamente para reavaliar.

## Aplicado

### PII fora do bundle do client

- Emails de clientes pagantes (lifetime allowlist) vivem só em
  `src/lib/access-entitlements.server.ts` (`import "server-only"`) — não
  vão pro JS público. Override por env `PRAXIS_BUILT_IN_LIFETIME_EMAILS`.
- O email do fundador também saiu do bundle do client: o módulo
  client-safe `src/lib/access-entitlements.ts` guarda só o **hash SHA-256**
  (`FOUNDER_ACCESS_EMAIL_HASHES`) usado por `isFounderEmail()` pra liberar
  o seed de demo. O texto puro do fundador vive em
  `access-entitlements.server.ts` (`FOUNDER_LIFETIME_EMAILS`) e é sempre
  injetado na allowlist de lifetime — o acesso admin não quebra por env.

### Isolamento por usuário

- O log de despacho de notificações é por usuário
  (`praxis:notif:u:<userId>:dispatchlog`), com janela de 14 dias e teto de
  500 entradas — sem log global compartilhado entre contas.

### localStorage legado

- `findLegacyPersistedState` só adota estado legado não-escopado quando o
  envelope é **comprovadamente** do usuário atual
  (`isEnvelopePositivelyOwnedByUser`: exige `sessionUserId`/`sessionEmail`
  batendo), evitando herdar dados de outra conta no mesmo dispositivo.
