// Prueba de humo de punta a punta en un iPhone emulado (Playwright).
// Uso: npm run build && npm run preview &  →  npm run smoke
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
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
const rir2 = () => page.getByRole('button', { name: /^2 repeticiones en reserva/ }).click();
const complete = () => page.getByRole('button', { name: '✓ Completar serie' }).click();
const skipRest = () => page.getByRole('button', { name: 'Saltar descanso →' }).click();
const menu = async (item) => {
  await page.getByRole('button', { name: 'Más opciones' }).click();
  await page.getByRole('button', { name: item }).click();
};

// Bienvenida
await page.goto(BASE);
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('checkbox').check();
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByPlaceholder('Tu nombre').fill('Laura');
await page.getByRole('button', { name: 'Empezar' }).click();
await page.getByRole('heading', { name: /Hola, Laura/ }).waitFor();
await page.getByText('Tu siguiente entrenamiento').waitFor();
await shot('01-inicio');

// Sesión 1: Comenzar desde Inicio
await page.getByRole('button', { name: /Comenzar/ }).first().click();
await page.getByRole('heading', { name: 'Piernas & glúteos A' }).waitFor();
await page.getByRole('heading', { name: 'Sentadilla goblet' }).waitFor();
await page.getByText('10 lb total · 1 mancuerna con ambas manos').first().waitFor();
await rir2();
await shot('02-entrenar');
await complete();
await page.getByRole('button', { name: 'Pausar descanso' }).waitFor();
await shot('03-descanso');
await skipRest();
await rir2();
await complete();
await skipRest();
await page.getByRole('heading', { name: 'Peso muerto rumano' }).waitFor();
await page.getByText('10 lb por mano · 20 lb total').first().waitFor();
// Sustituir y omitir
await menu(/Sustituir ejercicio/);
await page.getByRole('button', { name: /Bisagra de cadera/ }).click();
await page.getByRole('heading', { name: /Bisagra de cadera/ }).waitFor();
await menu(/Omitir ejercicio/);
await page.getByRole('heading', { name: 'Puente de glúteos' }).waitFor();
// Pausa y recuperación tras recargar
await menu(/Pausar sesión/);
await page.getByRole('heading', { name: 'En pausa' }).waitFor();
await page.getByRole('button', { name: /Reanudar/ }).click();
await page.getByRole('heading', { name: 'En pausa' }).waitFor({ state: 'hidden' });
await page.waitForTimeout(300);
await page.reload();
await page.getByRole('heading', { name: 'Puente de glúteos' }).waitFor();
// Terminar
await menu('Terminar sesión');
await page.getByRole('heading', { name: 'Resumen' }).waitFor();
await shot('04-resumen');
await page.getByRole('button', { name: 'Guardar y terminar' }).click();
await page.getByText(/MAÑANA · MARTES/).waitFor();

// Sesión 2: dos sesiones con 2 RIR → sugerencia de subir (requiere aprobación)
await page.goto(`${BASE}/#/entrenamiento`);
await page.getByRole('heading', { name: 'Sentadilla goblet' }).waitFor();
for (let i = 0; i < 2; i++) {
  await rir2();
  await complete();
  await skipRest();
}
await page.getByRole('heading', { name: 'Peso muerto rumano' }).waitFor();
await page.getByRole('switch', { name: 'Sentí dolor o molestia' }).click();
await complete();
await page.getByRole('heading', { name: 'Detén el ejercicio' }).waitFor();
await shot('05-dolor');
await page.getByRole('button', { name: 'Terminar la sesión' }).click();
await page.getByRole('heading', { name: 'Resumen' }).waitFor();
await page.getByRole('button', { name: /Aprobar 15 lb total/ }).waitFor();
await shot('06-sugerencia');
await page.getByRole('button', { name: /Aprobar 15 lb total/ }).click();
await page.getByText('Próxima propuesta: 15 lb total').waitFor();
await page.getByRole('button', { name: 'Guardar y terminar' }).click();
await page.goto(`${BASE}/#/plan`);
await page.getByText(/Sentadilla goblet · 2 × 10–12 · 15 lb total/).first().waitFor(); // la propuesta aprobada se refleja en el programa

// Cardio desde Inicio
await page.goto(`${BASE}/#/`);
await page.getByRole('button', { name: /\+ Cardio/ }).click();
await page.getByRole('button', { name: 'Guardar cardio' }).click();
await page.getByText('+30 min de cardio guardados').waitFor();

// Medidas
await page.goto(`${BASE}/#/progreso`);
await page.getByLabel('Peso (lb)').fill('147');
await page.getByLabel('Cintura (cm)').fill('82.5');
await page.getByRole('button', { name: 'Guardar medidas' }).click();
await page.getByText('Medidas guardadas').waitFor();

// Equipamiento: añadir una alternativa ligera
await page.goto(`${BASE}/#/ajustes`);
await page.getByLabel('Nombre', { exact: true }).fill('Botella 2 L');
await page.getByLabel('Peso (lb)').fill('4.4');
await page.getByRole('button', { name: 'Añadir alternativa ligera' }).click();
await page.getByText('Botella 2 L añadida').waitFor();

// Exportación JSON
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar copia completa/ }).click()]);
const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
if (backup.data.sessions.length !== 2 || backup.data.adjustments.length !== 1 || backup.data.cardio.length !== 1 || backup.data.measurements.length !== 1) {
  throw new Error('La copia exportada no tiene los datos esperados: ' + JSON.stringify(Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, v.length]))));
}

for (const [hash, name] of [['/', '07-inicio-datos'], ['/plan', '08-programa'], ['/progreso', '09-progreso'], ['/entrenamiento', '10-entrenar'], ['/ajustes', '11-ajustes'], ['/historial', '12-historial'], ['/guia', '13-tecnica']]) {
  await page.goto(`${BASE}/#${hash}`);
  await page.waitForTimeout(400);
  await shot(name);
}
await page.setViewportSize({ width: 1440, height: 1000 });
for (const [hash, name] of [['/', '20-desk-inicio'], ['/entrenamiento', '21-desk-entrenar'], ['/plan', '22-desk-programa'], ['/progreso', '23-desk-progreso']]) {
  await page.goto(`${BASE}/#${hash}`);
  await page.waitForTimeout(500);
  await shot(name);
}
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(`${BASE}/#/`);
await page.waitForTimeout(400);
await shot('24-desk-oscuro');

await browser.close();
if (errors.length) {
  console.error('Errores en consola:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Smoke test OK');
