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

// viewBox 256×256. Design inspirado em referência do usuário:
//  - hexágono "pointy-top" outline laranja (raio 110, centro 128/128)
//  - fundo dark dentro do hexágono e do canvas
//  - "P" angular geométrico em laranja, centralizado
//
// Hexágono pointy-top (vértices em cima/baixo) com r=110, cx=128 cy=132:
//   top          (128, 22)
//   upper-right  (223.3, 77)
//   lower-right  (223.3, 187)
//   bottom       (128, 242)
//   lower-left   (32.7, 187)
//   upper-left   (32.7, 77)
// (√3/2 · 110 ≈ 95.26)
//
// "P" angular feito de 4 retângulos pra renderizar nítido em 16×16
// (sem depender de fonte do sistema):
//   - haste vertical esquerda      (96, 76) 24×104
//   - barra superior do "olho"     (96, 76) 60×24
//   - haste vertical direita do "olho" (132, 76) 24×52
//   - barra inferior do "olho"     (96, 104) 60×24
function makeSvg(size = 256) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <rect width="256" height="256" fill="${BG}"/>
  <polygon
    points="128,22 223.26,77 223.26,187 128,242 32.74,187 32.74,77"
    fill="none"
    stroke="${ACCENT}"
    stroke-width="14"
    stroke-linejoin="round"
  />
  <g fill="${ACCENT}">
    <rect x="96" y="76" width="24" height="104"/>
    <rect x="96" y="76" width="60" height="24"/>
    <rect x="132" y="76" width="24" height="52"/>
    <rect x="96" y="104" width="60" height="24"/>
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
