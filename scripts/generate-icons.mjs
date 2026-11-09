// Genera los PNG del ícono (192, 512, maskable y apple-touch) desde icon.svg
// usando el Chromium de Playwright. Ejecutar: npm run icons
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright puede estar instalado globalmente (NODE_PATH) o localmente.
const { chromium } = require('playwright');
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, square: true },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12, square: true },
];
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  const svgSized = svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `).replace(t.square ? 'rx="112"' : '__', t.square ? 'rx="0"' : '__');
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;display:grid;place-items:center;width:${t.size}px;height:${t.size}px;background:${t.square ? '#6D28D9' : 'transparent'}">${svgSized}</body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname, omitBackground: !t.square });
}
await browser.close();
console.log('Íconos generados');
