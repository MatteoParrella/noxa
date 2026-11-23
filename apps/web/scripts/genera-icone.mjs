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
  // Anteprima dei link condivisi (Open Graph, 1200 × 630): simbolo, bagliore e descrizione.
  const pagina = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await pagina.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#000000;
    display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;
    font-family:Arial,Helvetica,sans-serif;color:#EDEAE4;
    background-image:radial-gradient(circle at 22% 45%,rgba(62,224,207,.24),transparent 46%)">
    ${svg.replace('<svg ', '<svg width="300" height="300" ').replace(/<rect[^>]*\/>/, '')}
    <div><div style="font-size:120px;font-weight:700;letter-spacing:-4px;line-height:1">noxa</div>
    <div style="font-size:38px;line-height:1.3;margin-top:24px;color:#B4AFA6;max-width:620px">
    Le tue serate a Milano e in Brianza, dall&rsquo;idea al ritorno a casa.</div></div>
  </body></html>`);
  await pagina.screenshot({
    path: new URL('../public/icone/anteprima.png', import.meta.url).pathname,
  });
  await pagina.close();
} finally {
  await browser.close();
}
