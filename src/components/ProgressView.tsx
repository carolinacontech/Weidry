import { useState, type ReactNode } from 'react';
import { RIR_TARGET, getExercise, planExercises } from '../data/plan';
import { useCardio, useMeasurements, useProfile, useSessions, useSettings } from '../hooks/useData';
import { db } from '../lib/db';
import { addDays, formatShort, today } from '../lib/dates';
import { programDayFor } from '../lib/program';
import { rirLabel } from '../lib/progression';
import { exerciseHistory, topOption, weekSummaries } from '../lib/stats';
import type { Measurement } from '../lib/types';
import { displayValue, formatOptionShort } from '../lib/weights';
import { CardioLogger } from './CardioLogger';
import { BarChart, LineChart } from './Charts';
import { Button, Card, Chip, Field, Loading, Modal, Notice, PageHeader, Tabs, inputClass, useToast } from './ui';
import { HistoryView } from './HistoryView';
import { IconFlex, IconHip, IconScale, IconTape } from './icons';

type Tab = 'resumen' | 'medidas' | 'fuerza' | 'cardio' | 'historial';
type Range = '4' | '13' | 'all';

export function ProgressView({ initialTab = 'resumen' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [range, setRange] = useState<Range>('13');
  return (
    <div>
      <PageHeader
        title="Tu progreso"
        subtitle="Evolución de tus medidas, peso y fuerza"
        action={
          <label className="flex flex-col text-xs text-muted">
            <span className="sr-only">Periodo</span>
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="min-h-10 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink shadow-card">
              <option value="4">4 semanas</option>
              <option value="13">13 semanas</option>
              <option value="all">Todo</option>
            </select>
          </label>
        }
      />
      <div className="mb-5">
        <Tabs
          label="Secciones de progreso"
          value={tab}
          onChange={setTab}
          tabs={[
            ['resumen', 'Resumen'],
            ['medidas', 'Medidas'],
            ['fuerza', 'Fuerza'],
            ['cardio', 'Cardio'],
            ['historial', 'Historial'],
          ]}
        />
      </div>
      <div role="tabpanel">
        {tab === 'resumen' ? <Summary range={range} /> : null}
        {tab === 'medidas' ? <Measurements /> : null}
        {tab === 'fuerza' ? (
          <div className="flex flex-col gap-5">
            <Loads />
            <Volume />
          </div>
        ) : null}
        {tab === 'cardio' ? <Cardio /> : null}
        {tab === 'historial' ? <HistoryView embedded /> : null}
      </div>
    </div>
  );
}

/** Filtra registros por el periodo elegido. */
function inRange<T extends { date: string }>(list: T[], range: Range): T[] {
  if (range === 'all') return list;
  const from = addDays(today(), -Number(range) * 7);
  return list.filter((x) => x.date >= from);
}

function Summary({ range }: { range: Range }) {
  const list = useMeasurements();
  const profile = useProfile();
  const sessions = useSessions();
  const cardio = useCardio();
  if (!list || !profile || !sessions || !cardio) return <Loading />;
  const latest = (k: keyof Measurement) => [...list].reverse().find((m) => m[k] !== undefined)?.[k] as number | undefined;
  const first = (k: keyof Measurement) => list.find((m) => m[k] !== undefined)?.[k] as number | undefined;
  const fmtDelta = (d: number | undefined, unit: string) => (d === undefined ? '' : d === 0 ? 'Sin cambios' : `${d < 0 ? '▼' : '▲'} ${d > 0 ? '+' : ''}${Math.round(d * 10) / 10} ${unit}`);
  const weight = latest('weightLb') ?? profile.weightLb;
  const waist = latest('waistCm') ?? profile.waistCm;
  const hip = latest('hipCm');
  const weeks = weekSummaries(sessions, cardio);
  const wk = programDayFor(today()).week;
  const glute = wk ? weeks[wk - 1].gluteSets : 0;
  const weightPts = withStart(profile.weightLb, inRange(list, range).filter((m) => m.weightLb !== undefined).map((m) => ({ label: formatShort(m.date), value: m.weightLb! })));
  const rows: [string, keyof Measurement, number | undefined][] = [
    ['Cintura', 'waistCm', profile.waistCm],
    ['Cadera', 'hipCm', undefined],
    ['Muslo', 'thighCm', undefined],
    ['Brazo', 'armCm', undefined],
  ];
  const tiles: [ReactNode, string, string, string][] = [
    [<IconScale />, 'Peso', `${weight} lb`, fmtDelta(weight - profile.weightLb, 'lb')],
    [<IconTape />, 'Cintura', `${waist} cm`, fmtDelta(waist - profile.waistCm, 'cm')],
    [<IconHip />, 'Cadera', hip !== undefined ? `${hip} cm` : '—', hip !== undefined ? fmtDelta(hip - (first('hipCm') ?? hip), 'cm') : 'Sin registros'],
    [<IconFlex />, 'Series de glúteo', `${glute}`, 'esta semana'],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([icon, label, value, sub]) => (
          <Card key={label} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-primary">
              {icon}
              <span className="font-medium text-ink">{label}</span>
            </div>
            <p className="font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-2 font-display text-lg font-semibold">Evolución del peso</h2>
          <LineChart title="Peso corporal" unit="lb" points={weightPts} refs={profile.showWeightGoal ? [{ value: profile.goalWeightLb, label: `Objetivo ${profile.goalWeightLb}` }] : []} empty={`Punto de partida: ${profile.weightLb} lb. Registra tus medidas en la pestaña Medidas.`} area />
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-lg font-semibold">Medidas (cm)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="py-1 text-left font-medium">
                  <span className="sr-only">Medida</span>
                </th>
                <th scope="col" className="py-1 text-right font-medium">Inicial</th>
                <th scope="col" className="py-1 text-right font-medium">Actual</th>
                <th scope="col" className="py-1 text-right font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, k, base]) => {
                const ini = base ?? first(k);
                const cur = latest(k) ?? base;
                const d = ini !== undefined && cur !== undefined ? Math.round((cur - ini) * 10) / 10 : undefined;
                return (
                  <tr key={label} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-medium">{label}</th>
                    <td className="tabular py-2 text-right">{ini ?? '—'}</td>
                    <td className="tabular py-2 text-right">{cur ?? '—'}</td>
                    <td className="tabular py-2 text-right font-semibold text-primary">{d === undefined ? '—' : `${d > 0 ? '+' : ''}${d}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Los cambios de medidas dependen de muchos factores; ningún ejercicio reduce grasa de una zona concreta.</p>
        </Card>
      </div>
    </div>
  );
}

function Measurements() {
  const list = useMeasurements();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  if (!list || !profile) return <Loading />;

  const pts = (key: keyof Measurement) => list.filter((m) => m[key] !== undefined).map((m) => ({ label: formatShort(m.date), value: m[key] as number }));

  return (
    <div className="flex flex-col gap-4">
      <Button size="lg" onClick={() => setOpen(true)}>+ Registrar medidas de esta semana</Button>
      <Notice>Las medidas son opcionales y secundarias: la prioridad es la fuerza y el desarrollo de glúteos. Si mides, hazlo una vez por semana, el mismo día y con la misma cinta. Ningún ejercicio reduce grasa de una zona concreta; los cambios de cintura dependen de muchos factores.</Notice>

      <Card>
        <h2 className="mb-2 font-semibold">Peso (lb)</h2>
        <LineChart title="Peso corporal" unit="lb" points={withStart(profile.weightLb, pts('weightLb'))} refs={profile.showWeightGoal ? [{ value: profile.goalWeightLb, label: `Objetivo ${profile.goalWeightLb}` }] : []} empty={`Punto de partida: ${profile.weightLb} lb. Registra tu primera medida.`} />
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Cintura (cm)</h2>
        <LineChart
          title="Cintura"
          unit="cm"
          points={withStart(profile.waistCm, pts('waistCm'))}
          refs={profile.showAestheticReference ? [{ value: profile.aestheticWaistCm, label: `Ref. estética ${profile.aestheticWaistCm}` }] : []}
          empty={`Punto de partida: ${profile.waistCm} cm.`}
        />
        {profile.showAestheticReference ? (
          <p className="mt-1 text-xs text-muted">
            La línea de {profile.aestheticWaistCm} cm es solo una referencia estética personal: no es una predicción, ni una meta médica, ni un resultado esperado del programa. Puedes ocultarla en Ajustes.
          </p>
        ) : null}
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ['hipCm', 'Cadera (cm)'],
            ['armCm', 'Brazo (cm)'],
            ['thighCm', 'Muslo (cm)'],
          ] as const
        ).map(([k, l]) => (
          <Card key={k}>
            <h2 className="mb-2 font-semibold">{l}</h2>
            <LineChart title={l} unit="cm" points={pts(k)} height={130} />
          </Card>
        ))}
      </div>

      {list.length ? (
        <Card>
          <h2 className="mb-2 font-semibold">Registros</h2>
          <ul className="divide-y divide-line text-sm">
            {[...list].reverse().map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <span className="tabular">
                  <strong>{formatShort(m.date)}</strong> · {m.weightLb ? `${m.weightLb} lb` : ''} {m.waistCm ? `· cintura ${m.waistCm}` : ''} {m.hipCm ? `· cadera ${m.hipCm}` : ''} {m.armCm ? `· brazo ${m.armCm}` : ''} {m.thighCm ? `· muslo ${m.thighCm}` : ''}
                </span>
                <button
                  type="button"
                  className="min-h-11 px-2 text-danger"
                  aria-label={`Eliminar registro del ${formatShort(m.date)}`}
                  onClick={async () => {
                    if (m.id !== undefined && confirm('¿Eliminar este registro?')) {
                      await db.measurements.delete(m.id);
                      toast('Registro eliminado', 'info');
                    }
                  }}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Medidas">
        <MeasurementForm onSaved={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

/** Añade el valor inicial del perfil como primer punto cuando ya hay registros. */
function withStart(start: number, points: { label: string; value: number }[]) {
  return points.length ? [{ label: 'Inicio', value: start }, ...points] : points;
}

function MeasurementForm({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [m, setM] = useState<Record<string, string>>({ date: today() });
  const [saving, setSaving] = useState(false);
  const fields: [string, string, string][] = [
    ['weightLb', 'Peso', 'lb'],
    ['waistCm', 'Cintura', 'cm'],
    ['hipCm', 'Cadera', 'cm'],
    ['armCm', 'Brazo', 'cm'],
    ['thighCm', 'Muslo', 'cm'],
  ];
  const n = (v?: string) => (v && v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : undefined);
  const save = async () => {
    const rec: Measurement = { date: m.date, weightLb: n(m.weightLb), waistCm: n(m.waistCm), hipCm: n(m.hipCm), armCm: n(m.armCm), thighCm: n(m.thighCm), notes: m.notes || undefined };
    if (!rec.weightLb && !rec.waistCm && !rec.hipCm && !rec.armCm && !rec.thighCm) {
      toast('Introduce al menos una medida', 'error');
      return;
    }
    setSaving(true);
    await db.measurements.add(rec);
    setSaving(false);
    toast('Medidas guardadas');
    onSaved();
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label="Fecha">{(id) => <input id={id} type="date" className={inputClass} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, l, u]) => (
          <Field key={k} label={`${l} (${u})`}>
            {(id) => <input id={id} className={inputClass} inputMode="decimal" type="text" value={m[k] ?? ''} onChange={(e) => setM({ ...m, [k]: e.target.value })} placeholder="—" />}
          </Field>
        ))}
      </div>
      <Field label="Notas">{(id) => <input id={id} className={inputClass} value={m.notes ?? ''} onChange={(e) => setM({ ...m, notes: e.target.value })} />}</Field>
      <Button onClick={save} loading={saving}>Guardar</Button>
    </div>
  );
}

function Loads() {
  const sessions = useSessions();
  const settings = useSettings();
  const all = planExercises();
  const [exId, setExId] = useState(all[0].id);
  if (!sessions || !settings) return <Loading />;
  const ex = getExercise(exId)!;
  const hist = exerciseHistory(sessions, exId);
  const modeText = ex.mode === 'each' ? 'por mano' : ex.mode === 'one' ? 'en una mano' : ex.mode === 'held' ? 'total' : '';
  return (
    <div className="flex flex-col gap-4">
      <Notice>La fuerza se nota en más repeticiones, mejor técnica o más carga con {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva. Todo cuenta como progreso.</Notice>
      <Field label="Ejercicio">
        {(id) => (
          <select id={id} className={inputClass} value={exId} onChange={(e) => setExId(e.target.value)}>
            {all.map((e) => (
              <option key={e.id} value={e.id}>{e.nameEs}</option>
            ))}
          </select>
        )}
      </Field>
      {ex.mode !== 'body' ? (
        <Card>
          <h2 className="mb-2 font-semibold">Carga más alta por sesión ({settings.unit} {modeText})</h2>
          <LineChart
            title={`Carga en ${ex.nameEs}`}
            unit={settings.unit}
            points={hist.map((h) => ({ label: formatShort(h.date), value: displayValue(topOption(h)?.lb ?? 0, settings.unit) }))}
            empty="Aún no hay sesiones registradas de este ejercicio."
          />
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-2 font-semibold">{ex.timed ? 'Segundos totales' : 'Repeticiones totales'} por sesión</h2>
        <LineChart title={`${ex.timed ? 'Segundos' : 'Repeticiones'} en ${ex.nameEs}`} unit={ex.timed ? 's' : 'reps'} points={hist.map((h) => ({ label: formatShort(h.date), value: h.sets.reduce((a, s) => a + s.reps, 0) }))} empty="Aún no hay sesiones registradas de este ejercicio." />
      </Card>
      {hist.length ? (
        <Card>
          <h2 className="mb-2 font-semibold">Últimas sesiones</h2>
          <ul className="divide-y divide-line text-sm">
            {[...hist].reverse().slice(0, 6).map((h, i) => (
              <li key={h.date + i} className="tabular py-2">
                <strong>{formatShort(h.date)}</strong> · {h.sets.map((st) => `${formatOptionShort(st.option, ex.mode, settings.unit)} × ${st.reps}${st.rir !== null ? ` (RIR ${rirLabel(st.rir)})` : ''}`).join(' · ')}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Volume() {
  const sessions = useSessions();
  const cardio = useCardio();
  const settings = useSettings();
  if (!sessions || !cardio || !settings) return <Loading />;
  const weeks = weekSummaries(sessions, cardio);
  const current = programDayFor(today()).week;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-1 font-semibold">Series de glúteo por semana</h2>
        <p className="mb-2 text-xs text-muted">Hip thrust, sentadillas, pesos muertos, zancadas, búlgaras, puentes y abducciones.</p>
        <BarChart title="Series de glúteo" unit="series" points={weeks.map((w) => ({ label: `S${w.week}`, value: w.gluteSets }))} highlightIndex={current ? current - 1 : undefined} />
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Volumen semanal estimado ({settings.unit})</h2>
        <p className="mb-2 text-xs text-muted">Repeticiones × carga (× 2 cuando es por mano). Útil para ver la tendencia; no tiene que subir cada semana, y baja en semanas de recuperación.</p>
        <BarChart title="Volumen semanal" unit={settings.unit} points={weeks.map((w) => ({ label: `S${w.week}`, value: Math.round(displayValue(w.volumeLb, settings.unit)) }))} highlightIndex={current ? current - 1 : undefined} />
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Sesiones de fuerza por semana</h2>
        <BarChart title="Sesiones de fuerza completadas" unit="sesiones" points={weeks.map((w) => ({ label: `S${w.week}`, value: w.strengthDone }))} targets={weeks.map(() => 4)} highlightIndex={current ? current - 1 : undefined} />
      </Card>
    </div>
  );
}

function Cardio() {
  const cardio = useCardio();
  const sessions = useSessions();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<'all' | 'recent'>('recent');
  if (!cardio || !sessions) return <Loading />;
  const weeks = weekSummaries(sessions, cardio);
  const current = programDayFor(today()).week;
  const list = [...cardio].reverse();
  return (
    <div className="flex flex-col gap-4">
      <Button size="lg" onClick={() => setOpen(true)}>+ Registrar cardio</Button>
      <Card>
        <h2 className="mb-1 font-semibold">Minutos de cardio por semana</h2>
        <p className="mb-2 text-xs text-muted">Barras: minutos registrados. Marca discontinua: meta sugerida de la semana.</p>
        <BarChart title="Cardio semanal" unit="min" points={weeks.map((w) => ({ label: `S${w.week}`, value: w.cardioMinutes }))} targets={weeks.map((w) => w.cardioTarget)} highlightIndex={current ? current - 1 : undefined} />
      </Card>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Registros</h2>
          <div className="flex gap-1">
            <Chip selected={range === 'recent'} onClick={() => setRange('recent')}>Recientes</Chip>
            <Chip selected={range === 'all'} onClick={() => setRange('all')}>Todos</Chip>
          </div>
        </div>
        {list.length === 0 ? <p className="text-sm text-muted">Aún no hay registros.</p> : null}
        <ul className="divide-y divide-line text-sm">
          {(range === 'recent' ? list.slice(0, 10) : list).map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>
                <strong>{formatShort(c.date)}</strong> · {c.minutes} min · {c.activity}
              </span>
              <button
                type="button"
                className="min-h-11 px-2 text-danger"
                aria-label={`Eliminar cardio del ${formatShort(c.date)}`}
                onClick={async () => {
                  if (c.id !== undefined && confirm('¿Eliminar este registro de cardio?')) {
                    await db.cardio.delete(c.id);
                    toast('Registro eliminado', 'info');
                  }
                }}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar cardio">
        <CardioLogger onSaved={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
