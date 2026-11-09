// Prueba de humo de punta a punta en un iPhone emulado (Playwright).
// Uso: npm run build && npx astro preview --port 4321 & node scripts/smoke.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const OUT = process.env.SHOTS ?? '.';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto(BASE);
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('checkbox').check();
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('button', { name: 'Empezar' }).click();
await page.getByText('Semana 1 de 13').waitFor();
await shot('01-dashboard');

await page.getByRole('button', { name: 'Empezar entrenamiento' }).first().click();
await page.getByText('Calentamiento').first().waitFor();
await shot('02-warmup');
await page.getByRole('button', { name: /Listo, empezar/ }).click();
await page.getByRole('heading', { name: 'Sentadilla goblet' }).waitFor();
await page.getByRole('button', { name: 'Fácil' }).click();
await shot('03-coach');
await page.getByRole('button', { name: /Completar serie/ }).click();
await page.getByText('Descanso', { exact: true }).waitFor();
await shot('04-rest');
await page.getByRole('button', { name: 'Empezar siguiente serie' }).click();
await page.getByRole('button', { name: /Completar serie/ }).click();
// Tras 2 series (semana 1) pasa al siguiente ejercicio
await page.getByRole('button', { name: 'Empezar siguiente serie' }).click();
await page.getByRole('heading', { name: 'Peso muerto rumano' }).waitFor();
// Sustituir
await page.getByRole('button', { name: /Sustituir/ }).click();
await page.getByRole('button', { name: /Bisagra de cadera/ }).click();
await page.getByRole('heading', { name: /Bisagra de cadera/ }).waitFor();
// Omitir
await page.getByRole('button', { name: /Omitir/ }).click();
await page.getByRole('heading', { name: 'Puente de glúteo con peso' }).waitFor();
// Pausa y reanudar
await page.getByRole('button', { name: /Pausar/ }).click();
await page.getByRole('heading', { name: 'En pausa' }).waitFor();
await page.getByRole('button', { name: /Reanudar/ }).click();
await page.getByRole('heading', { name: 'En pausa' }).waitFor({ state: 'hidden' });
await page.waitForTimeout(300); // deja terminar la escritura en IndexedDB
// Recuperación de sesión interrumpida: recargar
await page.reload();
await page.getByRole('heading', { name: 'Puente de glúteo con peso' }).waitFor();
// Terminar
await page.getByRole('button', { name: 'Terminar sesión ahora' }).click();
await page.getByRole('heading', { name: 'Resumen' }).waitFor();
await shot('05-summary');
await page.getByRole('button', { name: 'Guardar y terminar' }).click();
await page.getByText('completado ✓').waitFor();

// --- Segunda sesión: dos sesiones "fáciles" → sugerencia de subida que requiere aprobación
await page.getByRole('button', { name: 'Repetir entrenamiento' }).click();
await page.getByRole('button', { name: /Listo, empezar/ }).click();
await page.getByRole('heading', { name: 'Sentadilla goblet' }).waitFor();
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Fácil' }).click();
  await page.getByRole('button', { name: /Completar serie/ }).click();
  await page.getByRole('button', { name: 'Empezar siguiente serie' }).click();
}
await page.getByRole('heading', { name: 'Peso muerto rumano' }).waitFor();
// Dolor → indicación de parar
await page.getByRole('switch', { name: 'Sentí dolor o molestia' }).click();
await page.getByRole('button', { name: 'Registrar y parar' }).click();
await page.getByRole('heading', { name: 'Detén el ejercicio' }).waitFor();
await shot('13-dolor');
await page.getByRole('button', { name: 'Terminar la sesión' }).click();
await page.getByRole('heading', { name: 'Resumen' }).waitFor();
await page.getByRole('button', { name: /Aprobar 10 lb/ }).waitFor();
await shot('14-sugerencia');
await page.getByRole('button', { name: /Aprobar 10 lb/ }).click();
await page.getByText('Propuesta actualizada a 10 lb').waitFor();
await page.getByRole('button', { name: 'Guardar y terminar' }).click();
await page.getByText('10 lb total').first().waitFor(); // la propuesta aprobada se refleja en Inicio

// Cardio desde Inicio
await page.getByRole('button', { name: '+ Añadir' }).click();
await page.getByRole('button', { name: 'Guardar cardio' }).click();
await page.getByText('30', { exact: true }).first().waitFor();

// Medidas
await page.goto(`${BASE}/#/progreso`);
await page.getByRole('button', { name: /Registrar medidas/ }).click();
await page.getByLabel('Peso (lb)').fill('147');
await page.getByLabel('Cintura (cm)').fill('82.5');
await page.getByRole('button', { name: 'Guardar', exact: true }).click();
await page.getByText('Medidas guardadas').waitFor();

// Inventario: añadir 2 lb
await page.goto(`${BASE}/#/ajustes`);
await page.getByLabel('Añadir peso').fill('2');
await page.getByRole('button', { name: 'Añadir', exact: true }).click();
await page.getByText('2 lb añadido').waitFor();

// Exportación JSON
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar copia completa/ }).click()]);
const backup = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
if (backup.data.sessions.length !== 2 || backup.data.adjustments.length !== 1 || backup.data.cardio.length !== 1) {
  throw new Error('La copia exportada no tiene los datos esperados: ' + JSON.stringify(Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, v.length]))));
}

for (const [hash, name] of [['/plan', '06-plan'], ['/progreso', '07-progreso'], ['/guia', '08-guia'], ['/guia/romanian-deadlift', '09-guia-detalle'], ['/ajustes', '10-ajustes'], ['/historial', '11-historial']]) {
  await page.goto(`${BASE}/#${hash}`);
  await page.waitForTimeout(400);
  await shot(name);
}
// Modo oscuro
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(`${BASE}/#/`);
await page.waitForTimeout(400);
await shot('12-dark');

await browser.close();
if (errors.length) {
  console.error('Errores en consola:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Smoke test OK');
