type DossierSection = {
  label: string;
  content: string;
};

type DossierHtmlDocument = {
  title: string;
  subtitle: string;
  sections: DossierSection[];
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDossierHtmlDocument({
  title,
  subtitle,
  sections,
}: DossierHtmlDocument) {
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeSections = sections
    .map(
      (section) => `
        <section style="page-break-after: always; margin-bottom: 40px;">
          <h2 style="font-family: Georgia, serif; font-size: 18px; margin-bottom: 12px;">${escapeHtml(section.label)}</h2>
          <pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; line-height: 1.7; font-size: 12px;">${escapeHtml(section.content)}</pre>
        </section>
      `,
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${safeTitle}</title></head><body style="font-family: Georgia, serif; padding: 32px; color: #0f172a;"><h1 style="font-size: 24px;">${safeTitle}</h1><p>${safeSubtitle}</p>${safeSections}</body></html>`;
}
