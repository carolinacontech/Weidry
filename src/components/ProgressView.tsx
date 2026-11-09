import { useState } from 'react';
import { allPlanExercises, findPlanExercise } from '../data/plan';
import { useCardio, useMeasurements, useProfile, useSessions, useSettings } from '../hooks/useData';
import { db } from '../lib/db';
import { formatShort, today } from '../lib/dates';
import { programDayFor } from '../lib/program';
import { exerciseHistory, weekSummaries } from '../lib/stats';
import type { Measurement } from '../lib/types';
import { displayValue } from '../lib/weights';
import { CardioLogger } from './CardioLogger';
import { BarChart, LineChart } from './Charts';
import { Button, Card, Chip, Field, Loading, Modal, Notice, PageHeader, inputClass, useToast } from './ui';

type Tab = 'medidas' | 'cargas' | 'volumen' | 'cardio';

export function ProgressView() {
  const [tab, setTab] = useState<Tab>('medidas');
  return (
    <div>
      <PageHeader title="Progreso" subtitle="Tendencias semanales, no juicios diarios" action={<a href="#/historial" className="min-h-11 py-2 text-sm font-semibold text-sage-strong">Historial →</a>} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Secciones de progreso">
        {(
          [
            ['medidas', 'Medidas'],
            ['cargas', 'Cargas'],
            ['volumen', 'Volumen'],
            ['cardio', 'Cardio'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            type="button"
            onClick={() => setTab(k)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${tab === k ? 'bg-ink text-bg' : 'bg-surface-2 text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'medidas' ? <Measurements /> : null}
        {tab === 'cargas' ? <Loads /> : null}
        {tab === 'volumen' ? <Volume /> : null}
        {tab === 'cardio' ? <Cardio /> : null}
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
      <Notice>Mide una vez por semana, el mismo día, en ayunas y con la misma cinta. Ningún ejercicio reduce grasa de una zona concreta; los cambios de cintura dependen de muchos factores.</Notice>

      <Card>
        <h2 className="mb-2 font-semibold">Peso (lb)</h2>
        <LineChart title="Peso corporal" unit="lb" points={withStart(profile.weightLb, pts('weightLb'))} refs={[{ value: profile.goalWeightLb, label: `Objetivo ${profile.goalWeightLb}` }]} empty={`Punto de partida: ${profile.weightLb} lb. Registra tu primera medida.`} />
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
  const weighted = allPlanExercises().filter((e) => e.loadType !== 'body');
  const [exId, setExId] = useState(weighted[0].id);
  if (!sessions || !settings) return <Loading />;
  const ex = findPlanExercise(exId)!;
  const hist = exerciseHistory(sessions, exId);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Ejercicio">
        {(id) => (
          <select id={id} className={inputClass} value={exId} onChange={(e) => setExId(e.target.value)}>
            {weighted.map((e) => (
              <option key={e.id} value={e.id}>{e.nameEs}</option>
            ))}
          </select>
        )}
      </Field>
      <Card>
        <h2 className="mb-2 font-semibold">
          Carga máxima por sesión ({settings.unit}{ex.loadType === 'each' ? ', por mano' : ', total'})
        </h2>
        <LineChart title={`Carga en ${ex.nameEs}`} unit={settings.unit} points={hist.map((h) => ({ label: formatShort(h.date), value: displayValue(h.loadLb, settings.unit) }))} empty="Aún no hay sesiones registradas de este ejercicio." />
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Repeticiones totales por sesión</h2>
        <LineChart title={`Repeticiones en ${ex.nameEs}`} unit="reps" points={hist.map((h) => ({ label: formatShort(h.date), value: h.sets.reduce((a, s) => a + s.reps, 0) }))} />
      </Card>
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
