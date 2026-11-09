import { useRef, useState, type ReactNode } from 'react';
import { DEFAULT_PROFILE, type Profile } from '../data/plan';
import { useInventory, useProfile, useSettings } from '../hooks/useData';
import { db, setInventory, updateProfile, updateSettings } from '../lib/db';
import { today } from '../lib/dates';
import {
  cardioFromCSV,
  cardioToCSV,
  detectCSVKind,
  downloadFile,
  makeBackup,
  measurementsFromCSV,
  measurementsToCSV,
  parseBackup,
  setsToCSV,
} from '../lib/exportImport';
import {
  isIOS,
  isStandalone,
  notificationsSupported,
  requestNotificationPermission,
  showLocalNotification,
  speak,
  speechSupported,
  unlockAudio,
  vibrate,
  vibrationSupported,
  wakeLockSupported,
  beep,
} from '../lib/platform';
import type { Settings } from '../lib/types';
import { DEFAULT_INVENTORY, formatWeight, itemLb, type InventoryItem, type Unit } from '../lib/weights';
import { uid } from '../lib/session';
import { Button, Card, Chip, Field, Loading, Modal, Notice, PageHeader, Toggle, inputClass, useToast } from './ui';

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <Card aria-labelledby={id} className="mb-4">
      <h2 id={id} className="mb-3 font-display text-xl font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

export function applyTheme(theme: Settings['theme']) {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* modo privado */
  }
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function SettingsView() {
  const settings = useSettings();
  const profile = useProfile();
  const inventory = useInventory();
  if (!settings || !profile || !inventory) return <Loading />;
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Todo se guarda en este dispositivo" action={<a href="#/historial" className="min-h-11 py-2 text-sm font-semibold text-sage-strong">Historial →</a>} />
      <nav aria-label="Secciones de ajustes" className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ['s-perfil', 'Perfil'],
          ['s-inv', 'Mancuernas'],
          ['s-entreno', 'Entreno y sonido'],
          ['s-rec', 'Recordatorios'],
          ['s-apar', 'Apariencia'],
          ['s-datos', 'Datos'],
          ['s-lim', 'Limitaciones'],
        ].map(([id, l]) => (
          <a key={id} href={`#/ajustes`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }} className="min-h-10 rounded-full bg-surface-2 px-3 py-2 font-medium">
            {l}
          </a>
        ))}
      </nav>
      <ProfileSection profile={profile} />
      <InventorySection inventory={inventory} unit={settings.unit} onUnit={(u) => set({ unit: u })} />
      <TrainingSection settings={settings} set={set} />
      <ReminderSection settings={settings} set={set} />
      <Section title="Apariencia" id="s-apar">
        <div className="flex gap-2" role="group" aria-label="Tema">
          {(
            [
              ['system', 'Automático'],
              ['light', 'Claro'],
              ['dark', 'Oscuro'],
            ] as const
          ).map(([k, l]) => (
            <Chip
              key={k}
              selected={settings.theme === k}
              onClick={() => {
                void set({ theme: k });
                applyTheme(k);
              }}
            >
              {l}
            </Chip>
          ))}
        </div>
      </Section>
      <DataSection />
      <LimitationsSection />
      <Section title="Aviso de salud" id="s-salud">
        <p className="text-sm leading-relaxed">
          Mi Entrenamiento ofrece un programa general de fuerza y cardio. No es un servicio médico, no diagnostica ni trata ninguna condición y no garantiza resultados estéticos ni de peso. Las cargas son referencias que debes ajustar a tu capacidad real. Con hígado graso u otras condiciones clínicas, embarazo, lesiones, medicación o síntomas como dolor en el pecho, mareo o falta de aire, consulta con un profesional de la salud antes de empezar o continuar.
        </p>
      </Section>
      <p className="pb-4 text-center text-xs text-muted">Mi Entrenamiento · v1.0 · funciona sin conexión</p>
    </div>
  );
}

function ProfileSection({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [p, setP] = useState(profile);
  const num = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Number(e.target.value) });
  return (
    <Section title="Perfil" id="s-perfil">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Edad">{(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" value={p.age} onChange={num('age')} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Altura (ft)">{(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" value={p.heightFt} onChange={num('heightFt')} />}</Field>
          <Field label="(in)">{(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" value={p.heightIn} onChange={num('heightIn')} />}</Field>
        </div>
        <Field label="Peso inicial (lb)">{(id) => <input id={id} className={inputClass} type="number" inputMode="decimal" value={p.weightLb} onChange={num('weightLb')} />}</Field>
        <Field label="Peso objetivo (lb)">{(id) => <input id={id} className={inputClass} type="number" inputMode="decimal" value={p.goalWeightLb} onChange={num('goalWeightLb')} />}</Field>
        <Field label="Cintura inicial (cm)">{(id) => <input id={id} className={inputClass} type="number" inputMode="decimal" value={p.waistCm} onChange={num('waistCm')} />}</Field>
        <Field label="Referencia estética cintura (cm)" hint="No es predicción ni meta médica">
          {(id) => <input id={id} className={inputClass} type="number" inputMode="decimal" value={p.aestheticWaistCm} onChange={num('aestheticWaistCm')} />}
        </Field>
      </div>
      <div className="mt-3 grid gap-3">
        <Field label="Nivel de actividad">
          {(id) => (
            <select id={id} className={inputClass} value={p.activityLevel} onChange={(e) => setP({ ...p, activityLevel: e.target.value as Profile['activityLevel'] })}>
              <option value="sedentario">Sedentario</option>
              <option value="ligero">Ligero</option>
              <option value="moderado">Moderado</option>
              <option value="activo">Activo</option>
            </select>
          )}
        </Field>
        <Field label="Condiciones a tener en cuenta">{(id) => <input id={id} className={inputClass} value={p.conditions} onChange={(e) => setP({ ...p, conditions: e.target.value })} />}</Field>
        <Toggle checked={p.showAestheticReference} onChange={(v) => setP({ ...p, showAestheticReference: v })} label="Mostrar referencia estética en gráficos" description="Solo como referencia personal" />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            await updateProfile(p);
            toast('Perfil guardado');
          }}
        >
          Guardar perfil
        </Button>
        <Button variant="ghost" onClick={() => setP(DEFAULT_PROFILE)}>Restablecer</Button>
      </div>
    </Section>
  );
}

function InventorySection({ inventory, unit, onUnit }: { inventory: InventoryItem[]; unit: Unit; onUnit: (u: Unit) => void }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [newUnit, setNewUnit] = useState<Unit>(unit);
  const [count, setCount] = useState(2);
  const sorted = [...inventory].sort((a, b) => itemLb(a) - itemLb(b));

  const save = async (items: InventoryItem[]) => {
    await setInventory(items);
  };

  return (
    <Section title="Mis mancuernas" id="s-inv">
      <p className="mb-3 text-sm text-muted">La app solo propone cargas que tienes. Si te falta un peso, usará el inmediatamente inferior y te sugerirá más repeticiones en lugar de forzar saltos.</p>
      <div className="mb-3 flex items-center gap-2" role="group" aria-label="Unidad para mostrar cargas">
        <span className="text-sm font-medium text-muted">Mostrar en:</span>
        <Chip selected={unit === 'lb'} onClick={() => onUnit('lb')}>lb</Chip>
        <Chip selected={unit === 'kg'} onClick={() => onUnit('kg')}>kg</Chip>
      </div>
      {sorted.length === 0 ? <Notice tone="warn">No hay mancuernas registradas: todos los ejercicios se propondrán sin peso.</Notice> : null}
      <ul className="divide-y divide-line">
        {sorted.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-2 py-2">
            <div>
              <p className="tabular font-semibold">
                {it.value} {it.unit}
                {it.unit !== unit ? <span className="ml-1 text-sm font-normal text-muted">(≈ {formatWeight(itemLb(it), unit)})</span> : null}
              </p>
              <p className="text-sm text-muted">{it.count === 1 ? '1 mancuerna' : `${it.count} mancuernas${it.count >= 2 ? ' (par)' : ''}`}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="h-11 w-11 rounded-xl border border-line text-lg" aria-label={`Quitar una de ${it.value} ${it.unit}`} onClick={() => save(inventory.map((x) => (x.id === it.id ? { ...x, count: Math.max(1, x.count - 1) } : x)))}>−</button>
              <span className="tabular w-6 text-center">{it.count}</span>
              <button type="button" className="h-11 w-11 rounded-xl border border-line text-lg" aria-label={`Añadir una de ${it.value} ${it.unit}`} onClick={() => save(inventory.map((x) => (x.id === it.id ? { ...x, count: Math.min(9, x.count + 1) } : x)))}>+</button>
              <button
                type="button"
                className="ml-1 h-11 rounded-xl px-2 text-sm text-danger"
                onClick={async () => {
                  await save(inventory.filter((x) => x.id !== it.id));
                  toast(`${it.value} ${it.unit} eliminado`, 'info');
                }}
                aria-label={`Eliminar ${it.value} ${it.unit}`}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-end gap-2">
        <Field label="Añadir peso">{(id) => <input id={id} className={inputClass} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="p. ej. 8" />}</Field>
        <div className="flex gap-1 pb-0.5">
          <Chip selected={newUnit === 'lb'} onClick={() => setNewUnit('lb')}>lb</Chip>
          <Chip selected={newUnit === 'kg'} onClick={() => setNewUnit('kg')}>kg</Chip>
        </div>
        <Field label="Cantidad">
          {(id) => (
            <select id={id} className={`${inputClass} w-20`} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </Field>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            const v = Number(value.replace(',', '.'));
            if (!Number.isFinite(v) || v <= 0 || v > 200) {
              toast('Introduce un peso válido', 'error');
              return;
            }
            const existing = inventory.find((x) => x.unit === newUnit && Math.abs(x.value - v) < 0.01);
            if (existing) await save(inventory.map((x) => (x.id === existing.id ? { ...x, count } : x)));
            else await save([...inventory, { id: uid(), value: v, unit: newUnit, count }]);
            setValue('');
            toast(`${v} ${newUnit} añadido`);
          }}
        >
          Añadir
        </Button>
        <Button variant="ghost" onClick={() => save(DEFAULT_INVENTORY)}>Inventario de ejemplo</Button>
      </div>
      <p className="mt-2 text-xs text-muted">Para ejercicios “por mano” se necesita un par (2), salvo el remo a una mano.</p>
    </Section>
  );
}

function TrainingSection({ settings, set }: { settings: Settings; set: (p: Partial<Settings>) => void }) {
  return (
    <Section title="Entreno y sonido" id="s-entreno">
      <p className="mb-2 text-sm font-medium text-muted">Descanso entre series</p>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Descanso entre series">
        <Chip selected={settings.restSec === 0} onClick={() => set({ restSec: 0 })}>Recomendado</Chip>
        {([45, 60, 90, 120] as const).map((s) => (
          <Chip key={s} selected={settings.restSec === s} onClick={() => set({ restSec: s })}>{s} s</Chip>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted">“Recomendado” usa 60–90 s según el ejercicio y 120 s en los más intensos (peso muerto rumano).</p>
      <div className="divide-y divide-line">
        <Toggle checked={settings.askDifficulty} onChange={(v) => set({ askDifficulty: v })} label="Preguntar dificultad en cada serie" description="Fácil / adecuada / demasiado difícil (opcional)" />
        <Toggle checked={settings.sound} onChange={(v) => { if (v) { unlockAudio(); beep(); } set({ sound: v }); }} label="Sonidos" description="Pitidos 3-2-1 y fin de descanso" />
        <Toggle
          checked={settings.voice}
          onChange={(v) => {
            if (v) {
              unlockAudio();
              speak('Hola, te acompañaré en tus entrenamientos.');
            }
            set({ voice: v });
          }}
          label="Indicaciones por voz (español)"
          description={speechSupported() ? 'Usa la voz en español del sistema' : 'Tu navegador no tiene síntesis de voz'}
          disabled={!speechSupported()}
        />
        <Toggle
          checked={settings.vibration && vibrationSupported()}
          onChange={(v) => { if (v) vibrate(100); set({ vibration: v }); }}
          label="Vibración"
          description={vibrationSupported() ? 'Al terminar el descanso' : 'No disponible en este navegador (Safari en iPhone no permite vibrar desde la web)'}
          disabled={!vibrationSupported()}
        />
        <Toggle
          checked={settings.wakeLock}
          onChange={(v) => set({ wakeLock: v })}
          label="Mantener pantalla encendida"
          description={wakeLockSupported() ? 'Durante el modo coach' : 'Tu navegador no lo permite: ajusta el bloqueo automático del iPhone'}
        />
      </div>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => { unlockAudio(); beep(); speak('Prueba de voz. Tres, dos, uno.'); vibrate(120); }}>
        Probar sonido y voz
      </Button>
    </Section>
  );
}

function ReminderSection({ settings, set }: { settings: Settings; set: (p: Partial<Settings>) => void }) {
  const toast = useToast();
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  return (
    <Section title="Recordatorios" id="s-rec">
      <div className="divide-y divide-line">
        <Toggle checked={settings.reminderEnabled} onChange={(v) => set({ reminderEnabled: v })} label="Recordatorio dentro de la app" description="Aviso en Inicio si a esta hora aún no entrenaste" />
      </div>
      <Field label="Hora del recordatorio">
        {(id) => <input id={id} type="time" className={inputClass} value={settings.reminderTime} onChange={(e) => set({ reminderTime: e.target.value })} />}
      </Field>
      <div className="mt-4 rounded-2xl bg-surface-2 p-3">
        <p className="font-semibold">Notificaciones (opcional)</p>
        <p className="mb-2 text-sm text-muted">
          {perm === 'unsupported'
            ? isIOS() && !isStandalone()
              ? 'En iPhone, las notificaciones web solo están disponibles si instalas la app en la pantalla de inicio (iOS 16.4 o posterior).'
              : 'Este navegador no admite notificaciones web.'
            : perm === 'granted'
              ? 'Permiso concedido. Te avisaremos al abrir la app si tienes el entreno pendiente después de la hora elegida.'
              : perm === 'denied'
                ? 'Bloqueaste las notificaciones. Puedes activarlas en los ajustes del sistema.'
                : 'Activa las notificaciones para recibir avisos del sistema.'}
        </p>
        {perm !== 'unsupported' && perm !== 'denied' ? (
          <div className="flex gap-2">
            {perm !== 'granted' ? (
              <Button
                className="flex-1"
                onClick={async () => {
                  const r = await requestNotificationPermission();
                  setPerm(r);
                  if (r === 'granted') {
                    set({ notificationsEnabled: true });
                    toast('Notificaciones activadas');
                  }
                }}
              >
                Activar notificaciones
              </Button>
            ) : (
              <>
                <Toggle checked={settings.notificationsEnabled} onChange={(v) => set({ notificationsEnabled: v })} label="Usar notificaciones" />
              </>
            )}
          </div>
        ) : null}
        {perm === 'granted' ? (
          <Button variant="secondary" size="sm" className="mt-2" onClick={async () => { const ok = await showLocalNotification('Mi Entrenamiento', 'Así se verán tus recordatorios.'); if (!ok) toast('No se pudo mostrar la notificación', 'error'); }}>
            Enviar notificación de prueba
          </Button>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          Sin un servidor de notificaciones push, una web no puede programar avisos a una hora exacta con la app cerrada. Los recordatorios se muestran al abrir o volver a la app.
        </p>
      </div>
    </Section>
  );
}

function DataSection() {
  const toast = useToast();
  const fileJson = useRef<HTMLInputElement>(null);
  const fileCsv = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [wipe, setWipe] = useState(false);
  const stamp = today();

  const exportJson = async () => {
    setBusy(true);
    const data = {
      kv: await db.kv.toArray(),
      sessions: await db.sessions.toArray(),
      measurements: await db.measurements.toArray(),
      cardio: await db.cardio.toArray(),
      adjustments: await db.adjustments.toArray(),
    };
    downloadFile(`mi-entrenamiento-${stamp}.json`, JSON.stringify(makeBackup(data), null, 2), 'application/json');
    setBusy(false);
    toast('Copia exportada');
  };

  const restore = async () => {
    if (!pendingBackup) return;
    const d = pendingBackup.data;
    await db.transaction('rw', [db.kv, db.sessions, db.measurements, db.cardio, db.adjustments], async () => {
      await Promise.all([db.kv.clear(), db.sessions.clear(), db.measurements.clear(), db.cardio.clear(), db.adjustments.clear()]);
      await db.kv.bulkPut(d.kv);
      await db.sessions.bulkPut(d.sessions);
      await db.measurements.bulkPut(d.measurements);
      await db.cardio.bulkPut(d.cardio);
      await db.adjustments.bulkPut(d.adjustments);
    });
    setPendingBackup(null);
    toast('Copia restaurada');
  };

  return (
    <Section title="Datos" id="s-datos">
      <p className="mb-3 text-sm text-muted">Sin cuentas ni servidores: tus datos viven en este dispositivo (IndexedDB). Exporta copias con regularidad; si borras los datos del navegador o desinstalas la app, se pierden.</p>
      <div className="grid gap-2">
        <Button onClick={exportJson} loading={busy}>Exportar copia completa (JSON)</Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={async () => downloadFile(`series-${stamp}.csv`, setsToCSV(await db.sessions.toArray()), 'text/csv')}>CSV series</Button>
          <Button variant="secondary" size="sm" onClick={async () => downloadFile(`medidas-${stamp}.csv`, measurementsToCSV(await db.measurements.orderBy('date').toArray()), 'text/csv')}>CSV medidas</Button>
          <Button variant="secondary" size="sm" onClick={async () => downloadFile(`cardio-${stamp}.csv`, cardioToCSV(await db.cardio.orderBy('date').toArray()), 'text/csv')}>CSV cardio</Button>
        </div>
        <Button variant="soft" onClick={() => fileJson.current?.click()}>Importar copia (JSON)</Button>
        <Button variant="soft" onClick={() => fileCsv.current?.click()}>Importar medidas o cardio (CSV)</Button>
        <Button variant="danger" onClick={() => setWipe(true)}>Borrar todos los datos</Button>
      </div>
      <input
        ref={fileJson}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setPendingBackup(parseBackup(await f.text()));
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      />
      <input
        ref={fileCsv}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const text = await f.text();
            const kind = detectCSVKind(text);
            if (kind === 'measurements') {
              const rows = measurementsFromCSV(text);
              await db.measurements.bulkAdd(rows);
              toast(`${rows.length} medidas importadas`);
            } else if (kind === 'cardio') {
              const rows = cardioFromCSV(text);
              await db.cardio.bulkAdd(rows);
              toast(`${rows.length} registros de cardio importados`);
            } else if (kind === 'sets') {
              toast('El CSV de series es solo de exportación. Para restaurar sesiones usa la copia JSON.', 'error');
            } else {
              toast('No reconozco el formato. Usa las columnas de los CSV exportados.', 'error');
            }
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      />
      <Modal
        open={!!pendingBackup}
        onClose={() => setPendingBackup(null)}
        title="¿Restaurar la copia?"
        footer={
          <div className="grid gap-2">
            <Button variant="danger" onClick={restore}>Reemplazar mis datos actuales</Button>
            <Button variant="secondary" onClick={() => setPendingBackup(null)}>Cancelar</Button>
          </div>
        }
      >
        {pendingBackup ? (
          <p>
            Copia del {new Date(pendingBackup.exportedAt).toLocaleString('es')}: {pendingBackup.data.sessions.length} sesiones, {pendingBackup.data.measurements.length} medidas y {pendingBackup.data.cardio.length} registros de cardio. Reemplazará todo lo que hay ahora en este dispositivo.
          </p>
        ) : null}
      </Modal>
      <Modal
        open={wipe}
        onClose={() => setWipe(false)}
        title="¿Borrar todo?"
        footer={
          <div className="grid gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                await Promise.all([db.kv.clear(), db.sessions.clear(), db.measurements.clear(), db.cardio.clear(), db.adjustments.clear()]);
                setWipe(false);
                toast('Datos borrados', 'info');
                location.hash = '/';
                location.reload();
              }}
            >
              Sí, borrar definitivamente
            </Button>
            <Button variant="secondary" onClick={() => setWipe(false)}>Cancelar</Button>
          </div>
        }
      >
        <p>Se eliminarán sesiones, medidas, cardio, ajustes e inventario. Te recomendamos exportar una copia antes.</p>
      </Modal>
    </Section>
  );
}

function LimitationsSection() {
  return (
    <Section title="Limitaciones del iPhone y del navegador" id="s-lim">
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li><strong>Instalar:</strong> en Safari, toca Compartir → “Añadir a pantalla de inicio”. En iPhone no aparece un botón automático de instalación.</li>
        <li><strong>Audio y voz:</strong> iOS solo permite sonido después de que toques la pantalla; por eso se activan al pulsar “Empezar”. El interruptor de silencio del iPhone puede silenciar los pitidos.</li>
        <li><strong>Segundo plano:</strong> si bloqueas la pantalla o cambias de app, iOS pausa la web: los avisos de sonido o voz pueden no sonar. El temporizador usa la hora real, así que al volver muestra el tiempo correcto. No se garantiza audio en segundo plano.</li>
        <li><strong>Pantalla encendida:</strong> se usa Wake Lock donde existe (Safari 16.4+; en la app instalada, iOS 18.4+). Si no funciona, ajusta Ajustes → Pantalla → Bloqueo automático.</li>
        <li><strong>Vibración:</strong> Safari en iPhone no permite vibrar desde una web; solo funciona en Android.</li>
        <li><strong>Notificaciones:</strong> en iPhone requieren instalar la app (iOS 16.4+) y dar permiso. Sin servidor push no se pueden programar a una hora exacta con la app cerrada.</li>
        <li><strong>Almacenamiento:</strong> Safari puede borrar datos de webs no usadas durante semanas si no está instalada. Instálala y exporta copias.</li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        Estado en este dispositivo: {isStandalone() ? 'app instalada' : 'en navegador'} · voz {speechSupported() ? 'sí' : 'no'} · vibración {vibrationSupported() ? 'sí' : 'no'} · pantalla activa {wakeLockSupported() ? 'sí' : 'no'} · notificaciones {notificationsSupported() ? 'sí' : 'no'}
      </p>
    </Section>
  );
}
