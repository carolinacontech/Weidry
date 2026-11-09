# Mi Entrenamiento

PWA en español para entrenar fuerza con un programa de 13 semanas centrado en **fuerza, desarrollo de glúteos y definición muscular**, adaptado a un equipamiento real: **tres pares de mancuernas fijas de 10, 15 y 20 lb**, peso corporal y alternativas domésticas ligeras (botellas de agua). Está pensada primero para iPhone. Funciona sin conexión, guarda los datos solo en el dispositivo (IndexedDB) y no pide cuenta.

**Stack:** Astro 7 · React 19 · TypeScript · Tailwind CSS 4 · Dexie (IndexedDB) · gráficos SVG accesibles propios · Vitest · despliegue estático en Vercel.

> ⚠️ **Aviso de salud.** Es una app de orientación general. No es un servicio médico y no promete resultados de peso ni estéticos. Las cargas son **propuestas ajustables**, nunca obligatorias. Si tienes alguna condición clínica (por ejemplo, hígado graso), una lesión o tomas medicación, consulta con un profesional de la salud. No existe la pérdida de grasa localizada. La referencia de cintura de 60 cm es solo estética y personal: no es una predicción ni una meta médica.

---

## Funciones

| Área | Qué hace |
|---|---|
| **Inicio** | Muestra el entreno de hoy con cargas propuestas, la semana actual, los minutos de cardio frente a la meta, la adherencia, el peso y la cintura. También muestra recordatorios y permite reanudar una sesión interrumpida. |
| **Plan** | Calendario de 13 semanas desde el 2026-11-09, con días hechos, pendientes y semanas de recuperación (5 y 9). Puedes hacer o recuperar cualquier entreno y registrar cardio. |
| **Equipamiento** | Pares de mancuernas fijas de 10, 15 y 20 lb, más botellas de agua (500 ml, 1 L y 1,5 L) como alternativa ligera. Todo es editable. La app **nunca** propone una mancuerna que no esté en el inventario. |
| **Tabla de cargas** | En Plan → «Tabla de cargas» se ven las 13 semanas por ejercicio: 10/15/20 lb, PC (peso corporal) o Lig. (alternativa ligera). Las semanas 5 y 9 aparecen sombreadas (menos series y carga más ligera). |
| **Modo coach** | Pantalla completa con 5 min de calentamiento guiado y la ilustración animada del ejercicio. Incluye técnica, carga editable (solo pesos de tu inventario, por mano o total), repeticiones o cronómetro, series y progreso. Botones: completar serie, omitir, sustituir, pausar, anterior y siguiente. |
| **Descanso** | Temporizador de 45, 60, 90 o 120 s (o el recomendado por ejercicio) con ±15 s y pausa/reanudación. Tiene pitidos 3‑2‑1, voz en español (Web Speech API), vibración donde existe, botón de silencio y Wake Lock. |
| **Registro por serie** | Cómo sujetas la carga (1 mancuerna con ambas manos, 1 en cada mano o 1 en una mano), carga real (peso corporal, botella o mancuerna) con peso **por mano** y **total**, repeticiones o segundos, **repeticiones en reserva (RIR 0–4+)**, tempo lento, técnica adecuada y dolor. Si marcas dolor, la app te indica parar. |
| **Comandos de voz** | Opcionales, con el botón 🎙: «listo», «pausa», «seguir», «siguiente», «anterior», «saltar», «más tiempo», «repite». |
| **Progresión** | Solo recomienda subir peso cuando completas **todas las series con buena técnica y 2–3 RIR durante dos sesiones seguidas**, y siempre a la siguiente opción que tienes. Si no, propone progresar con repeticiones, tempo o series. Los saltos grandes (10 → 15 lb) se marcan como opcionales, para probar primero en una serie. Cada cambio requiere tu aprobación. |
| **Progreso** | Primero fuerza (carga, repeticiones y RIR por ejercicio) y series de glúteo por semana; después volumen, cardio y, como algo opcional y secundario, medidas corporales. El peso objetivo y la referencia de cintura están ocultos por defecto. Cada gráfico tiene descripción accesible y tabla de datos. |
| **Datos** | Exportar e importar una copia completa en JSON. Exportar CSV de series, medidas y cardio; importar CSV de medidas y cardio. Borrar todo. |
| **Guía** | Ilustraciones esquemáticas **originales** (SVG animado, dibujado en código), con preparación, ejecución, claves, errores comunes y alternativas. Puedes añadir tu propio video o enlace autorizado en cada ejercicio. La app no incluye enlaces de terceros. |
| **PWA** | Instalable, con manifest, íconos (incluido apple‑touch‑icon) y service worker que precachea todo el build. Guarda inmediatamente cada serie y recupera la sesión tras cerrar o recargar. |
| **Diseño** | Blanco cálido, verde salvia y un acento arcilla. Tipografías Fraunces e Inter (servidas en local). Modo oscuro automático o manual, botones grandes (≥ 44 px), foco visible y respeto por «reducir movimiento». |

## Instalación local

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev        # http://localhost:4321 (sin service worker en desarrollo)
npm test           # tests de progresión (RIR), cargas/inventario, propuestas, programa, temporizador, voz, migración y CSV/JSON
npm run typecheck  # astro check
npm run build      # genera dist/ e inyecta la lista de precache en dist/sw.js
npm run preview    # sirve dist/ en http://localhost:4321 (con service worker)
```

Para probarlo en tu iPhone dentro de la misma red, usa `npm run dev -- --host` y abre la IP que muestra. Ojo: el service worker, las notificaciones y Wake Lock necesitan **HTTPS**. Para probar la PWA completa, usa el deploy de Vercel.

### Prueba de humo de punta a punta (opcional)

Usa Playwright con un iPhone 13 emulado. Recorre el onboarding, el modo coach, el descanso, sustituir, omitir, pausar, la recuperación tras recargar, el dolor, la sugerencia de progresión y su aprobación, el cardio, las medidas, el inventario y la exportación JSON.

```bash
npm run build && npm run preview &
npm i -D playwright && npx playwright install chromium   # si no lo tienes
npm run smoke
```

## Despliegue: GitHub + Vercel

1. Sube el repositorio a GitHub:
   ```bash
   git remote add origin https://github.com/<usuario>/<repo>.git
   git push -u origin main
   ```
2. En [vercel.com](https://vercel.com), entra en **Add New → Project** e importa el repositorio.
3. Vercel detecta **Astro**. Los valores ya están en `vercel.json`:
   - Build command: `npm run build`
   - Output directory: `dist`
   - No hacen falta variables de entorno.
4. Pulsa **Deploy**. Cada `push` a `main` publica en producción, y cada PR genera una URL de vista previa.
5. (Opcional) Cambia `site` en `astro.config.mjs` por tu dominio final.

`vercel.json` define cabeceras para que `sw.js` no se cachee (así las actualizaciones llegan) y para servir el manifest con su tipo correcto.

### Instalar en iPhone

Abre la URL en **Safari**, toca **Compartir → Añadir a pantalla de inicio** y abre la app desde el ícono. Así se ve a pantalla completa, funciona sin conexión y puede pedir notificaciones (iOS 16.4+).

## Limitaciones reales de iPhone y navegadores

- **Audio y voz:** iOS solo reproduce sonido después de un toque. La app activa audio y voz al pulsar «Empezar», «Completar serie» o «Reanudar». El interruptor de silencio del iPhone puede apagar los pitidos. Las voces dependen de las que tenga instaladas el sistema.
- **Segundo plano:** con la pantalla bloqueada o en otra app, iOS congela la web, así que **no se garantizan sonidos ni voz** en ese estado. El temporizador se basa en marcas de tiempo reales: al volver muestra el tiempo correcto y, si el descanso terminó, pasa a la siguiente serie sin encadenar avisos atrasados.
- **Pantalla encendida:** Wake Lock funciona en Safari 16.4+. En apps instaladas en la pantalla de inicio solo es fiable desde iOS 18.4. Si no está disponible, la app lo indica; en ese caso ajusta el bloqueo automático.
- **Vibración:** Safari en iOS no implementa `navigator.vibrate`. Solo vibra en Android.
- **Comandos de voz:** usan el reconocimiento de voz del navegador (Safari 14.5+, Chrome y Edge). Piden permiso de micrófono y solo escuchan con la app en pantalla. Pueden cortarse tras silencios largos (la app los reactiva sola). En Safari, el audio puede procesarse en servidores de Apple.
- **Notificaciones:** en iPhone solo funcionan con la app instalada (iOS 16.4+) y con permiso. Sin servidor push, una web **no puede programar** avisos a una hora exacta con la app cerrada. Los recordatorios aparecen dentro de la app y, si das permiso, como notificación del sistema al abrir o volver a la app tras la hora elegida.
- **Almacenamiento:** Safari puede borrar los datos de webs **no instaladas** que no se usan durante semanas. La app pide almacenamiento persistente, pero conviene instalarla y **exportar copias** con regularidad.
- **Instalación:** iOS no muestra un botón automático de «Instalar». Se hace desde Compartir.

## Estructura

```
src/
  data/plan.ts            Seed completo: 13 semanas, días A–D, series, cargas, cardio, perfil
  data/guide.ts           Técnica, claves, errores y alternativas por ejercicio
  lib/program.ts          Fecha → semana/día, series, cardio, cargas del plan
  lib/progression.ts      Reglas de sugerencia (sin cambios automáticos)
  lib/timer.ts            Temporizador basado en marcas de tiempo + avisos
  lib/weights.ts          Inventario, lb/kg, ajuste a pesos disponibles
  lib/db.ts               Dexie / IndexedDB
  lib/session.ts          Creación de sesiones y cargas propuestas
  lib/stats.ts            Adherencia, volumen, cardio semanal, historial por ejercicio
  lib/exportImport.ts     JSON y CSV
  lib/platform.ts         Audio, voz, vibración, Wake Lock, notificaciones
  components/             Pantallas (Inicio, Plan, Coach, Progreso, Guía, Ajustes…)
public/
  manifest.webmanifest, sw.js, icons/
scripts/
  sw-precache-integration.mjs  Inyecta la lista de precache al terminar el build
  generate-icons.mjs           Regenera los PNG desde icons/icon.svg (Playwright)
  smoke.mjs                    Prueba de punta a punta en iPhone emulado
tests/                         Vitest
```

## Cómo funcionan las cargas y la progresión

**Propuesta de cada sesión** (`src/lib/session.ts`):
1. Sin historial se usa la tabla del plan de esa semana, ajustada a tu inventario.
2. Con historial se usa **tu nivel actual**: el último cambio que aprobaste o la carga que usaste en tu última sesión. Las subidas de la tabla **no se aplican solas**. Si tu nivel está por debajo de la tabla, la app lo indica y espera a que cumplas el criterio.
3. En las semanas 5 y 9 se usa la opción más ligera entre tu nivel y la tabla, con menos series. Después vuelves a tu nivel.

**Registro:** carga real (tipo y peso de una unidad, y cómo se sujeta), repeticiones o segundos, RIR, tempo, técnica y dolor.

**Sugerencias** (`src/lib/progression.ts`), a partir de la última sesión de cada ejercicio:
- **Dolor** → parar y consultar con un profesional.
- **Sin llegar al mínimo de repeticiones y con RIR 0** → bajar a la opción inferior que tienes.
- **RIR 0–1, técnica inadecuada, series incompletas o cargas distintas entre series** → mantener la carga.
- **Todas las series con 2–3+ RIR y buena técnica en una sesión** → sumar repeticiones. En el tope del rango: tempo lento o una serie más.
- **Lo mismo durante dos sesiones seguidas con la misma carga** → subir a la siguiente opción del inventario (botella más pesada o mancuerna). Si es un salto grande, se recomienda probarlo solo en la primera serie y volver si no sale.
- Nada cambia hasta que pulsas **Aprobar**.

### Tablas del programa

Están en `src/data/plan.ts` (`PLAN_DAYS`). Cada ejercicio tiene 13 valores: `'B'` (peso corporal), `'L'` (alternativa ligera) o `10/15/20` (lb por mancuerna). Los tests comprueban que solo se usan 10, 15 o 20 lb, que las semanas 5 y 9 bajan, y que no hay saltos de más de un escalón entre semanas. Para cambiar las tablas, edita ese archivo.
