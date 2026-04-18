import test from "node:test";
import assert from "node:assert/strict";

import { shouldUseBrowserFallback } from "../../src/lib/shopping-browser-fallback.ts";

test("nao usa fallback quando ja existem ofertas extraidas", () => {
  assert.equal(
    shouldUseBrowserFallback('<div class="product-item">Oferta</div>', 2),
    false,
  );
});

test("usa fallback quando o html vem vazio", () => {
  assert.equal(shouldUseBrowserFallback("", 0), true);
});

test("usa fallback quando a pagina parece bloqueada", () => {
  assert.equal(
    shouldUseBrowserFallback("<html><body>Verifying your browser</body></html>", 0),
    true,
  );
});

test("usa fallback quando nao ha sinais reais de listagem", () => {
  assert.equal(
    shouldUseBrowserFallback("<html><body><main>Nada util carregou ainda</main></body></html>", 0),
    true,
  );
});

test("nao usa fallback quando o html ja traz marcadores estruturados de listagem", () => {
  assert.equal(
    shouldUseBrowserFallback(
      '<html><script type="application/ld+json">{"@type":"ItemList"}</script></html>',
      0,
    ),
    false,
  );
});
