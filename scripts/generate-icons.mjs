/**
 * Gera os ícones do app a partir de um SVG inline:
 *   - src/app/icon.png       (256×256)  — favicon do navegador (Next.js auto-serve em /icon.png)
 *   - src/app/apple-icon.png (180×180)  — iOS home-screen / Safari pinned tab
 *   - public/icon-192.png    (192×192)  — PWA manifest
 *   - public/icon-512.png    (512×512)  — PWA manifest + share previews
 *
 * Design: "P" geométrico (haste vertical + olho fechado em retângulos) em
 * laranja accent (#fb923c) sobre fundo dark arredondado, com hairline
 * laranja translúcido. Legível em 16×16 e identificável como Praxis.
 *
 * Rodar com: node scripts/generate-icons.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "..");

const ACCENT = "#fb923c";
const BG = "#0a0a0d";

// viewBox 256×256. "P" angular composto por 3 retângulos:
//   - haste vertical à esquerda  (60,58)→(100,198)
//   - barra superior horizontal  (60,58)→(186,98)
//   - barra inferior horizontal  (60,118)→(186,158)  ← fecha o "olho"
//   - haste vertical direita     (146,58)→(186,158)
// Tudo preenchido em laranja, sem stroke (mantém legível em 16×16).
function makeSvg(size = 256) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <rect width="256" height="256" rx="48" ry="48" fill="${BG}"/>
  <rect x="2" y="2" width="252" height="252" rx="46" ry="46"
        fill="none" stroke="${ACCENT}" stroke-opacity="0.22" stroke-width="2"/>
  <g fill="${ACCENT}">
    <!-- haste esquerda do P -->
    <rect x="60" y="58" width="40" height="140"/>
    <!-- barra superior do "olho" -->
    <rect x="60" y="58" width="126" height="40"/>
    <!-- barra inferior do "olho" -->
    <rect x="60" y="118" width="126" height="40"/>
    <!-- haste direita do "olho" -->
    <rect x="146" y="58" width="40" height="100"/>
  </g>
</svg>`;
}

async function renderPng(outRelPath, size) {
  const svg = makeSvg(size);
  const buffer = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const outPath = path.join(repoRoot, outRelPath);
  await writeFile(outPath, buffer);
  console.log(`✓ ${outRelPath} (${size}×${size}, ${buffer.length} bytes)`);
}

await Promise.all([
  renderPng("src/app/icon.png", 256),
  renderPng("src/app/apple-icon.png", 180),
  renderPng("public/icon-192.png", 192),
  renderPng("public/icon-512.png", 512),
]);
