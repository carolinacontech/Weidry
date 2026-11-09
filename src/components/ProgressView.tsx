import { useEffect, useRef, useState } from 'react';
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

type Section = 'medidas';

/** "Progreso": diseño del prototipo (métricas, registro e historial de medidas) + gráficos de fuerza y cardio. */
export function ProgressView({ initialTab }: { initialTab?: Section }) {
  const list = useMeasurements();
  const profile = useProfile();
  const sessions = useSessions();
  const cardio = useCardio();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (initialTab === 'medidas') formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialTab, list === undefined]);

  if (!list || !profile || !sessions || !cardio) return <Loading />;

  const latest = (k: keyof Measurement) => [...list].reverse().find((m) => m[k] !== undefined)?.[k] as number | undefined;
  const weight = latest('weightLb') ?? profile.weightLb;
  const waist = latest('waistCm') ?? profile.waistCm;
  const hip = latest('hipCm') ?? profile.hipCm;
  const totalSets = sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
  const weightPts = withStart(profile.weightLb, list.filter((m) => m.weightLb !== undefined).map((m) => ({ label: formatShort(m.date), value: m.weightLb! })));
  const waistPts = withStart(profile.waistCm, list.filter((m) => m.waistCm !== undefined).map((m) => ({ label: formatShort(m.date), value: m.waistCm! })));

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => {
      const v = String(f.get(k) ?? '').replace(',', '.').trim();
      return v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v);
    };
    const rec: Measurement = {
      date: String(f.get('date') || today()),
      weightLb: n('weight'),
      waistCm: n('waist'),
      hipCm: n('hip'),
      armCm: n('arm'),
      thighCm: n('thigh'),
      notes: String(f.get('notes') ?? '').trim() || undefined,
    };
    if (!rec.weightLb && !rec.waistCm && !rec.hipCm && !rec.armCm && !rec.thighCm) return toast('Introduce al menos una medida', 'error');
    await db.measurements.add(rec);
    toast('Medidas guardadas');
  };

  return (
    <>
      <div className="section-heading top-section">
        <h2>Tu progreso real</h2>
        <p>Seguimiento de medidas y entrenamientos. Sin métricas ficticias.</p>
      </div>
      <div className="metric-grid">
        <article className="metric">
          <span className="metric-icon" aria-hidden>⚖</span>
          <span className="metric-title">Peso</span>
          <strong>
            {weight} <small>lb</small>
          </strong>
          <span className="metric-caption">Inicio: {profile.weightLb} lb</span>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden>◌</span>
          <span className="metric-title">Cintura</span>
          <strong>
            {waist} <small>cm</small>
          </strong>
          <span className="metric-caption">Inicio: {profile.waistCm} cm</span>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden>♡</span>
          <span className="metric-title">Cadera</span>
          <strong>
            {hip} <small>cm</small>
          </strong>
          <span className="metric-caption">Inicio: {profile.hipCm} cm</span>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden>✳</span>
          <span className="metric-title">Series completadas</span>
          <strong>{totalSets}</strong>
          <span className="metric-caption">Registradas en este dispositivo</span>
        </article>
      </div>

      <div className="progress-grid">
        <article className="panel">
          <div className="panel-heading">
            <h3>Registrar mis medidas</h3>
          </div>
          <form id="measure-form" ref={formRef} onSubmit={onSubmit} key={list.length}>
            <div className="form-grid">
              <label>
                Peso (lb)
                <input type="number" name="weight" min={50} max={500} step={0.1} defaultValue={weight} inputMode="decimal" />
              </label>
              <label>
                Cintura (cm)
                <input type="number" name="waist" min={30} max={200} step={0.1} defaultValue={waist} inputMode="decimal" />
              </label>
              <label>
                Cadera (cm)
                <input type="number" name="hip" min={30} max={220} step={0.1} defaultValue={hip} inputMode="decimal" />
              </label>
              <label>
                Fecha
                <input type="date" name="date" defaultValue={today()} required />
              </label>
            </div>
            <details style={{ marginBottom: 16 }}>
              <summary className="link-btn" style={{ cursor: 'pointer' }}>
                + Brazo, muslo y notas (opcional)
              </summary>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label>
                  Brazo (cm)
                  <input type="number" name="arm" min={10} max={80} step={0.1} inputMode="decimal" />
                </label>
                <label>
                  Muslo (cm)
                  <input type="number" name="thigh" min={20} max={120} step={0.1} inputMode="decimal" />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Notas
                  <input type="text" name="notes" />
                </label>
              </div>
            </details>
            <button className="btn btn-primary" type="submit">
              Guardar medidas
            </button>
          </form>
        </article>
        <article className="panel history-panel">
          <div className="panel-heading">
            <h3>Historial de medidas</h3>
            <span className="tiny-label">{list.length} registros</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="history-row head" aria-hidden>
              <span>FECHA</span>
              <span>PESO</span>
              <span>CINTURA</span>
              <span>CADERA</span>
              <span />
            </div>
            <div className="history-row">
              <span>Inicio</span>
              <span>{profile.weightLb} lb</span>
              <span>{profile.waistCm} cm</span>
              <span>{profile.hipCm} cm</span>
              <span />
            </div>
            {[...list].reverse().map((m) => (
              <div key={m.id} className="history-row">
                <span>{formatShort(m.date)}</span>
                <span>{m.weightLb !== undefined ? `${m.weightLb} lb` : '—'}</span>
                <span>{m.waistCm !== undefined ? `${m.waistCm} cm` : '—'}</span>
                <span>{m.hipCm !== undefined ? `${m.hipCm} cm` : '—'}</span>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 36, height: 36 }}
                  aria-label={`Eliminar registro del ${formatShort(m.date)}`}
                  onClick={async () => {
                    if (m.id !== undefined && confirm('¿Eliminar este registro?')) {
                      await db.measurements.delete(m.id);
                      toast('Registro eliminado', 'info');
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="progress-grid">
        <article className="panel">
          <div className="panel-heading">
            <h3>Evolución del peso</h3>
            <span className="tiny-label">lb</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <LineChart title="Peso corporal" unit="lb" points={weightPts} area refs={profile.showWeightGoal ? [{ value: profile.goalWeightLb, label: `Meta ${profile.goalWeightLb}` }] : []} empty={`Punto de partida: ${profile.weightLb} lb. Registra tus medidas para ver la tendencia.`} />
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <h3>Evolución de la cintura</h3>
            <span className="tiny-label">cm</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <LineChart title="Cintura" unit="cm" points={waistPts} area empty={`Punto de partida: ${profile.waistCm} cm.`} />
          </div>
          <p className="privacy-note" style={{ margin: '8px 0 0' }}>Ningún ejercicio reduce grasa de una zona concreta; los cambios dependen de muchos factores.</p>
        </article>
      </div>

      <div className="section-heading">
        <h2>Tu fuerza</h2>
        <p>Carga, repeticiones y repeticiones en reserva por ejercicio.</p>
      </div>
      <div className="flex flex-col gap-5">
        <Loads />
        <Volume />
      </div>

      <div className="section-heading">
        <h2>Cardio</h2>
        <p>Minutos por semana frente a la meta sugerida.</p>
      </div>
      <Cardio />

      <p className="privacy-note">
        Tus datos se guardan en este dispositivo (IndexedDB) y no se envían a ningún servidor. <a href="#/historial" className="link-btn">Ver historial de entrenamientos →</a>
      </p>
    </>
  );
}

/** Añade el valor inicial del perfil como primer punto cuando ya hay registros. */
function withStart(start: number, points: { label: string; value: number }[]) {
  return points.length ? [{ label: 'Inicio', value: start }, ...points] : points;
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
