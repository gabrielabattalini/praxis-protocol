import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDossierHtmlDocument,
  escapeHtml,
} from "../../src/lib/legal-analysis/dossier-html.ts";

test("escapeHtml neutraliza caracteres especiais", () => {
  assert.equal(
    escapeHtml(`"><script>alert('xss')</script>`),
    "&quot;&gt;&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
  );
});

test("buildDossierHtmlDocument escapa título, subtítulo e conteúdo", () => {
  const html = buildDossierHtmlDocument({
    title: `<img src=x onerror=alert(1)>`,
    subtitle: `<script>alert("subtitle")</script>`,
    sections: [
      {
        label: "Resumo <final>",
        content: `<b>conteúdo</b>`,
      },
    ],
  });

  assert.equal(html.includes("<img src=x onerror=alert(1)>"), false);
  assert.equal(html.includes('<script>alert("subtitle")</script>'), false);
  assert.equal(html.includes("<b>conteúdo</b>"), false);
  assert.equal(
    html.includes("&lt;img src=x onerror=alert(1)&gt;"),
    true,
  );
  assert.equal(
    html.includes("&lt;script&gt;alert(&quot;subtitle&quot;)&lt;/script&gt;"),
    true,
  );
  assert.equal(html.includes("&lt;b&gt;conteúdo&lt;/b&gt;"), true);
});
