// Genera le icone PNG della PWA e di iOS da public/icone/icona.svg con Chromium di Playwright,
// e l'anteprima dei link con il carattere del marchio (Archivo stretto, design/store/).
// La «n» dell'icona è il glifo di Archivo a peso 800 e larghezza 68 (--tipo-larghezza-marchio), convertito in tracciato.
// Uso: pnpm --filter web icone
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
  // Anteprima dei link condivisi (Open Graph, 1200 × 630): simbolo, marchio e descrizione.
  const archivo = await readFile(
    new URL(
      '../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2',
      import.meta.url,
    ),
  );
  const pagina = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await pagina.setContent(`<html><head><style>
    @font-face { font-family: 'Archivo'; src: url(data:font/woff2;base64,${archivo.toString('base64')}) format('woff2');
      font-weight: 100 900; font-stretch: 62% 125%; }
    </style></head><body style="margin:0;width:1200px;height:630px;background:#000000;
    display:flex;align-items:center;gap:48px;padding:0 96px;box-sizing:border-box;
    font-family:'Archivo',Arial,sans-serif;color:#F5F3EF;
    background-image:radial-gradient(circle at 26% 34%,rgba(62,224,207,.22),transparent 44%)">
    ${svg.replace('<svg ', '<svg width="300" height="300" ').replace(/<rect[^>]*\/>/g, '')}
    <div><div style="display:flex;align-items:baseline;font-size:150px;font-weight:800;
      font-stretch:68%;letter-spacing:-3px;line-height:.9">noxa<span style="display:inline-block;
      width:30px;height:30px;margin-left:10px;border-radius:50%;background:#3EE0CF"></span></div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.3;margin-top:28px;
      color:#AEAEB2;max-width:640px">Le serate di Milano e della Brianza, dall&rsquo;idea al ritorno a casa.</div></div>
  </body></html>`);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({
    path: new URL('../public/icone/anteprima.png', import.meta.url).pathname,
  });
  await pagina.close();

  // App native (Capacitor): icone di Android e iOS e schermate di apertura, dallo stesso SVG.
  const simbolo = svg.replace(/<rect[^>]*\/>/g, '');
  const scatta = async (percorso, larghezza, altezza, corpo, sfondo = '#000000') => {
    const foglio = await browser.newPage({ viewport: { width: larghezza, height: altezza } });
    await foglio.setContent(
      `<html><body style="margin:0;width:${larghezza}px;height:${altezza}px;background:${sfondo};display:grid;place-items:center;overflow:hidden">${corpo}</body></html>`,
    );
    await foglio.screenshot({
      path: new URL(percorso, import.meta.url).pathname,
      omitBackground: sfondo === 'transparent',
    });
    await foglio.close();
  };
  const res = '../android/app/src/main/res';
  const densita = [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ];
  for (const [nome, lato] of densita) {
    const piena = svg.replace('<svg ', `<svg width="${lato}" height="${lato}" `);
    await scatta(`${res}/mipmap-${nome}/ic_launcher.png`, lato, lato, piena);
    await scatta(
      `${res}/mipmap-${nome}/ic_launcher_round.png`,
      lato,
      lato,
      `<div style="width:${lato}px;height:${lato}px;border-radius:50%;overflow:hidden">${piena}</div>`,
      'transparent',
    );
    // Icona adattiva: primo piano su 108 dp, il simbolo resta nella zona sicura di 66 dp.
    const primoPiano = Math.round((lato * 108) / 48);
    await scatta(
      `${res}/mipmap-${nome}/ic_launcher_foreground.png`,
      primoPiano,
      primoPiano,
      simbolo.replace('<svg ', `<svg width="${primoPiano}" height="${primoPiano}" `),
      'transparent',
    );
  }
  await scatta(
    '../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    1024,
    1024,
    svg.replace('<svg ', '<svg width="1024" height="1024" '),
  );
  // Schermate di apertura native: il simbolo al centro sul nero, come Apertura.tsx.
  const apertura = (larghezza, altezza) => {
    const lato = Math.round(Math.min(larghezza, altezza) * 0.5);
    return simbolo.replace('<svg ', `<svg width="${lato}" height="${lato}" `);
  };
  const schermi = [
    ['drawable', 480, 320],
    ['drawable-land-mdpi', 480, 320],
    ['drawable-land-hdpi', 800, 480],
    ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-land-xxxhdpi', 1920, 1280],
    ['drawable-port-mdpi', 320, 480],
    ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280],
    ['drawable-port-xxhdpi', 960, 1600],
    ['drawable-port-xxxhdpi', 1280, 1920],
  ];
  for (const [cartella, larghezza, altezza] of schermi) {
    await scatta(`${res}/${cartella}/splash.png`, larghezza, altezza, apertura(larghezza, altezza));
  }
  for (const nome of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await scatta(
      `../ios/App/App/Assets.xcassets/Splash.imageset/${nome}`,
      2732,
      2732,
      apertura(1400, 1400),
    );
  }
} finally {
  await browser.close();
}
