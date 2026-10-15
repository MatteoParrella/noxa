// Genera le icone PNG della PWA e di iOS da public/icone/icona.svg con Chromium di Playwright.
// Icona provvisoria: quella definitiva arriva da Claude Design nell'iterazione 12 (design/store/).
// Uso: pnpm --filter web exec node scripts/genera-icone.mjs
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icone/icona.svg', import.meta.url), 'utf8');
const dimensioni = [
  ['icona-192.png', 192],
  ['icona-512.png', 512],
  ['icona-180.png', 180],
];

const browser = await chromium.launch();
try {
  for (const [nome, lato] of dimensioni) {
    const pagina = await browser.newPage({ viewport: { width: lato, height: lato } });
    await pagina.setContent(
      `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${lato}" height="${lato}" `)}</body></html>`,
    );
    await pagina.screenshot({ path: new URL(`../public/icone/${nome}`, import.meta.url).pathname });
    await pagina.close();
  }
} finally {
  await browser.close();
}
