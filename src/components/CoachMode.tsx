import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GUIDE, WARMUP_STEPS, type Alternative } from '../data/guide';
import { DAY_LABELS, WARMUP_MINUTES, findPlanExercise, type LoadType, type PlanExercise } from '../data/plan';
import { useAdjustments, useInventory, useSessions, useSettings } from '../hooks/useData';
import { useNow } from '../hooks/useNow';
import { navigate } from '../hooks/useRoute';
import { useWakeLock } from '../hooks/useWakeLock';
import { db, saveSession } from '../lib/db';
import { beep, doneChime, speak, stopSpeaking, unlockAudio, vibrate } from '../lib/platform';
import { plannedLoadLb } from '../lib/program';
import { DIFFICULTY_LABELS, suggestProgression, type Difficulty, type Suggestion } from '../lib/progression';
import { exerciseName, nextPendingIndex, sessionProgress } from '../lib/session';
import { exerciseHistory } from '../lib/stats';
import { addTime, createTimer, cuesBetween, formatClock, pause, remainingMs, resume, start, tick, type Cue, type TimerState } from '../lib/timer';
import type { ExerciseLog, SetLog, Settings, WorkoutSession } from '../lib/types';
import { availableLoadsLb, formatLoad, formatWeight, type InventoryItem } from '../lib/weights';
import { ExerciseIllustration } from './ExerciseIllustration';
import { GuideContent } from './GuideView';
import { RestTimer } from './RestTimer';
import { Button, Chip, Loading, Modal, Notice, ProgressRing, Stepper, Toggle, inputClass, useToast } from './ui';

const CUE_SPEECH: Partial<Record<Cue, string>> = {
  halfway: 'Mitad del descanso',
  ten: 'Quedan diez segundos',
  three: 'Tres',
  two: 'Dos',
  one: 'Uno',
};

function repsText(ex: PlanExercise) {
  if (ex.timed) return `${ex.repsMin} a ${ex.repsMax} segundos${ex.perSide ? ' por lado' : ''}`;
  if (ex.repsMin === ex.repsMax) return `${ex.repsMax} repeticiones${ex.perSide ? ' por lado' : ''}`;
  return `${ex.repsMin} a ${ex.repsMax} repeticiones${ex.perSide ? ' por lado' : ''}`;
}

function effectiveLoadType(log: ExerciseLog, ex: PlanExercise): LoadType {
  return log.substitute?.loadType ?? ex.loadType;
}

export function CoachMode({ sessionId }: { sessionId: string }) {
  const stored = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const settings = useSettings();
  const inventory = useInventory();
  const [s, setS] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    if (stored && !s) setS(stored);
  }, [stored, s]);

  if (stored === undefined && !s) return <Loading label="Cargando sesión…" />;
  if (!stored && !s)
    return (
      <div className="p-6">
        <Notice tone="warn" title="Sesión no encontrada">Puede que se haya descartado.</Notice>
        <Button className="mt-4" onClick={() => navigate('/')}>Volver al inicio</Button>
      </div>
    );
  if (!s || !settings || !inventory) return <Loading label="Preparando el modo coach…" />;
  return <Coach session={s} setSession={setS} settings={settings} inventory={inventory} />;
}

function Coach({
  session: s,
  setSession,
  settings,
  inventory,
}: {
  session: WorkoutSession;
  setSession: (s: WorkoutSession) => void;
  settings: Settings;
  inventory: InventoryItem[];
}) {
  const toast = useToast();
  const [muted, setMuted] = useState(!settings.sound && !settings.voice);
  const [showGuide, setShowGuide] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const active = s.status === 'in_progress';
  const wake = useWakeLock(settings.wakeLock && active && !s.paused);

  // Al cambiar de fase o de ejercicio, volver arriba.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [s.phase, s.exerciseIndex]);

  const commit = (next: WorkoutSession) => {
    setSession(next);
    void saveSession(next);
  };

  const log = s.exercises[s.exerciseIndex];
  const ex = findPlanExercise(log.exerciseId)!;
  const guide = GUIDE[ex.id];
  const name = exerciseName(log);
  const loadType = effectiveLoadType(log, ex);
  const setNumber = Math.min(log.sets.length + 1, log.plannedSets);
  const prog = sessionProgress(s);

  const soundOn = settings.sound && !muted;
  const voiceOn = settings.voice && !muted;

  // ---------- Descanso ----------
  const restRunning = s.phase === 'rest' && s.rest?.status === 'running' && !s.paused;
  const now = useNow(restRunning || s.phase === 'warmup' || s.phase === 'work');
  const prevRemaining = useRef<number | null>(null);

  useEffect(() => {
    if (s.phase !== 'rest' || !s.rest) {
      prevRemaining.current = null;
      return;
    }
    const rem = remainingMs(s.rest, now);
    const prev = prevRemaining.current;
    prevRemaining.current = rem;
    if (prev === null || s.rest.status !== 'running') return;
    const cues = cuesBetween(prev, rem, s.rest.durationMs);
    for (const c of cues) {
      if (c === 'done') {
        if (soundOn) doneChime();
        if (settings.vibration) vibrate([200, 100, 200]);
        finishRest();
        return;
      }
      if (soundOn && (c === 'three' || c === 'two' || c === 'one')) beep(c === 'one' ? 990 : 880, 120);
      if (voiceOn && CUE_SPEECH[c] && (c === 'ten' || c === 'halfway' || !soundOn)) speak(CUE_SPEECH[c]!);
      if (settings.vibration && c === 'ten') vibrate(80);
    }
    const ticked = tick(s.rest, now);
    if (ticked.status === 'done') finishRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, s.phase, s.rest]);

  // Si al reanudar una sesión interrumpida el descanso ya terminó, pasar a la serie.
  useEffect(() => {
    if (s.phase === 'rest' && s.rest && s.rest.status === 'running' && remainingMs(s.rest, Date.now()) === 0) finishRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anuncio por voz al empezar cada serie.
  const announceKey = s.phase === 'work' ? `${s.exerciseIndex}-${log.sets.length}-${log.substitute?.id ?? ''}` : '';
  useEffect(() => {
    if (!announceKey || !voiceOn) return;
    speak(`Serie ${setNumber} de ${log.plannedSets}. ${name}. ${repsText(ex)}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announceKey]);

  useEffect(() => () => stopSpeaking(), []);

  function restDurationFor(e: PlanExercise) {
    return settings.restSec || e.restSec;
  }

  function finishRest() {
    commit({ ...s, phase: 'work', rest: null });
  }

  function goToSummary(next: WorkoutSession) {
    commit({ ...next, phase: 'summary', rest: null });
    if (voiceOn) speak('¡Sesión completada! Buen trabajo.');
  }

  function completeSet(entry: Omit<SetLog, 'setNumber' | 'completedAt'>) {
    unlockAudio();
    const sets = [...log.sets, { ...entry, setNumber: log.sets.length + 1, completedAt: new Date().toISOString() }];
    const exDone = sets.length >= log.plannedSets;
    const exercises = s.exercises.map((e, i) => (i === s.exerciseIndex ? { ...e, sets, status: exDone ? ('done' as const) : e.status } : e));
    let next: WorkoutSession = { ...s, exercises };
    if (settings.vibration) vibrate(60);

    if (entry.pain) {
      commit({ ...next, phase: 'work', rest: null });
      setPainOpen(true);
      if (voiceOn) speak('Registraste dolor. Detén el ejercicio.');
      return;
    }

    const nextIdx = exDone ? nextPendingIndex(next, s.exerciseIndex) : s.exerciseIndex;
    if (nextIdx === -1) return goToSummary(next);
    const restFor = findPlanExercise(next.exercises[nextIdx].exerciseId)!;
    const dur = exDone ? restDurationFor(ex) : restDurationFor(restFor);
    next = { ...next, exerciseIndex: nextIdx, phase: 'rest', rest: start(createTimer(dur), Date.now()) };
    commit(next);
    if (voiceOn) speak(`Serie completada. Descansa ${dur} segundos.`);
  }

  function skipExercise() {
    const exercises = s.exercises.map((e, i) => (i === s.exerciseIndex ? { ...e, status: e.sets.length > 0 ? ('done' as const) : ('skipped' as const) } : e));
    const next = { ...s, exercises };
    const idx = nextPendingIndex(next, s.exerciseIndex);
    if (idx === -1) return goToSummary(next);
    commit({ ...next, exerciseIndex: idx, phase: 'work', rest: null });
    toast('Ejercicio omitido', 'info');
  }

  function move(delta: number) {
    const idx = Math.min(s.exercises.length - 1, Math.max(0, s.exerciseIndex + delta));
    if (idx === s.exerciseIndex) return;
    // Volver a un ejercicio omitido lo reactiva.
    const exercises = s.exercises.map((e, i) => (i === idx && e.status === 'skipped' ? { ...e, status: 'pending' as const } : e));
    commit({ ...s, exercises, exerciseIndex: idx, phase: 'work', rest: null });
  }

  function substitute(alt: Alternative | null) {
    const exercises = s.exercises.map((e, i) => {
      if (i !== s.exerciseIndex) return e;
      if (!alt) return { ...e, substitute: undefined, sets: [], status: 'pending' as const, plannedLoadLb: e.plannedLoadLb };
      return { ...e, substitute: { id: alt.id, name: alt.name, loadType: alt.loadType }, sets: [], status: 'pending' as const };
    });
    commit({ ...s, exercises, phase: 'work', rest: null });
    setShowSubstitute(false);
    toast(alt ? `Sustituido por: ${alt.name}` : 'Ejercicio original restaurado');
  }

  function togglePause() {
    const t = Date.now();
    if (s.paused) {
      unlockAudio();
      commit({ ...s, paused: false, rest: s.rest ? resume(s.rest, t) : s.rest });
    } else {
      stopSpeaking();
      commit({ ...s, paused: true, rest: s.rest ? pause(s.rest, t) : s.rest });
    }
  }

  function setRest(fn: (r: TimerState) => TimerState) {
    if (!s.rest) return;
    commit({ ...s, rest: fn(s.rest) });
  }

  const nextLabel = (() => {
    const l = s.exercises[s.exerciseIndex];
    return `${exerciseName(l)} · Serie ${Math.min(l.sets.length + 1, l.plannedSets)} de ${l.plannedSets}`;
  })();

  return (
    <div ref={scroller} className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <button type="button" onClick={() => setConfirmExit(true)} className="min-h-11 rounded-full px-3 font-semibold text-sage-strong hover:bg-surface-2" aria-label="Salir del modo coach">
            ✕ Salir
          </button>
          <div className="text-center">
            <p className="font-display text-lg font-semibold leading-tight">{DAY_LABELS[s.dayKey]}</p>
            <p className="text-xs text-muted">Semana {s.week} · {prog.done}/{prog.total} series</p>
          </div>
          {s.phase !== 'summary' ? (
            <button type="button" onClick={togglePause} className="min-h-11 rounded-full px-3 font-semibold text-sage-strong hover:bg-surface-2" aria-pressed={!!s.paused}>
              {s.paused ? '▶ Seguir' : '⏸ Pausar'}
            </button>
          ) : (
            <span className="w-16" />
          )}
        </div>
        <div className="mx-auto mt-2 h-1.5 max-w-xl overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Progreso de la sesión" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done}>
          <div className="h-full bg-sage transition-all" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="safe-bottom mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-4">
        {s.phase === 'warmup' ? (
          <Warmup
            onDone={() => {
              unlockAudio();
              commit({ ...s, phase: 'work' });
            }}
            soundOn={soundOn}
            voiceOn={voiceOn}
            now={now}
          />
        ) : null}

        {s.phase === 'rest' && s.rest ? (
          <RestTimer
            timer={s.rest}
            now={now}
            nextLabel={nextLabel}
            muted={muted}
            onToggleMute={() => {
              unlockAudio();
              setMuted((m) => !m);
              stopSpeaking();
            }}
            onPause={() => setRest((r) => pause(r, Date.now()))}
            onResume={() => {
              unlockAudio();
              setRest((r) => resume(r, Date.now()));
            }}
            onAdd={(sec) => setRest((r) => addTime(r, sec, Date.now()))}
            onSetDuration={(sec) => setRest(() => start(createTimer(sec), Date.now()))}
            onSkip={() => {
              unlockAudio();
              finishRest();
            }}
          />
        ) : null}

        {s.phase === 'work' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sage-strong">
                  Ejercicio {s.exerciseIndex + 1} de {s.exercises.length}
                  {log.status === 'done' ? ' · completado' : log.status === 'skipped' ? ' · omitido' : ''}
                </p>
                <h1 className="font-display text-3xl font-semibold leading-tight">{name}</h1>
                {log.substitute ? (
                  <p className="text-sm text-muted">Sustituye a: {ex.nameEs}</p>
                ) : (
                  <p className="text-sm text-muted">{ex.name}</p>
                )}
              </div>
              <ProgressRing value={log.sets.length / log.plannedSets} size={62} label={`Serie ${setNumber} de ${log.plannedSets}`}>
                <span className="tabular text-sm font-bold">{Math.min(log.sets.length, log.plannedSets)}/{log.plannedSets}</span>
              </ProgressRing>
            </div>

            {!log.substitute ? (
              <ExerciseIllustration pattern={guide.pattern} label={ex.nameEs} className="aspect-[16/10]" />
            ) : null}

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Objetivo</p>
                <p className="font-semibold">{ex.timed ? `${ex.reps}` : `${ex.reps} reps`}</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Carga propuesta (ajustable)</p>
                <p className="font-semibold">{formatLoad(log.substitute?.loadType === 'body' ? 0 : log.plannedLoadLb, loadType, settings.unit)}</p>
              </div>
            </div>

            {!log.substitute && guide ? (
              <details className="rounded-2xl border border-line bg-surface p-3">
                <summary className="min-h-8 cursor-pointer font-semibold">Claves de técnica</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {guide.steps.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowGuide(true)}>
                  Ver guía completa y video
                </Button>
              </details>
            ) : null}

            {log.status === 'done' || log.status === 'skipped' ? (
              <Notice tone="success">
                {log.status === 'done' ? 'Ya completaste este ejercicio.' : 'Este ejercicio está omitido.'} Puedes añadir otra serie o pasar al siguiente.
              </Notice>
            ) : null}

            <SetLogger
              key={`${s.exerciseIndex}-${log.sets.length}-${log.substitute?.id ?? ''}`}
              ex={ex}
              log={log}
              loadType={loadType}
              inventory={inventory}
              settings={settings}
              soundOn={soundOn}
              onComplete={completeSet}
            />

            {log.sets.length > 0 ? (
              <div className="rounded-2xl bg-surface-2 p-3 text-sm">
                <p className="mb-1 font-semibold">Series registradas</p>
                <ul className="space-y-1">
                  {log.sets.map((st) => (
                    <li key={st.setNumber} className="tabular flex justify-between gap-2">
                      <span>Serie {st.setNumber}: {st.reps} {ex.timed ? 's' : 'reps'} · {formatLoad(st.loadLb, loadType, settings.unit)}</span>
                      <span className="text-muted">{st.pain ? 'dolor' : st.difficulty ? DIFFICULTY_LABELS[st.difficulty] : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <nav className="grid grid-cols-2 gap-2" aria-label="Controles del ejercicio">
              <Button variant="secondary" onClick={() => move(-1)} disabled={s.exerciseIndex === 0}>
                ← Anterior
              </Button>
              <Button variant="secondary" onClick={() => move(1)} disabled={s.exerciseIndex === s.exercises.length - 1}>
                Siguiente →
              </Button>
              <Button variant="soft" onClick={() => setShowSubstitute(true)}>
                ⇄ Sustituir
              </Button>
              <Button variant="soft" onClick={skipExercise}>
                ⤼ Omitir
              </Button>
            </nav>
            <Button variant="ghost" onClick={() => goToSummary(s)}>
              Terminar sesión ahora
            </Button>
          </div>
        ) : null}

        {s.phase === 'summary' ? <Summary session={s} commit={commit} settings={settings} inventory={inventory} /> : null}

        {settings.wakeLock && active && s.phase !== 'summary' ? (
          <p className="mt-4 text-center text-xs text-muted">
            {wake.supported
              ? wake.locked
                ? 'Pantalla mantenida encendida durante el entreno.'
                : 'El sistema no permitió mantener la pantalla encendida: revisa el bloqueo automático o el modo de bajo consumo.'
              : 'Este navegador no permite mantener la pantalla encendida: ajusta el bloqueo automático del dispositivo.'}
          </p>
        ) : null}
      </main>

      {s.paused ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg/95 p-6 text-center backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <h2 id="paused-title" className="font-display text-4xl font-semibold">En pausa</h2>
          <p className="max-w-xs text-muted">Tu progreso está guardado. Puedes cerrar la app y continuar más tarde desde Inicio.</p>
          <Button size="xl" className="w-full max-w-xs" onClick={togglePause}>▶ Reanudar</Button>
          <Button variant="secondary" className="w-full max-w-xs" onClick={() => navigate('/')}>Guardar y salir</Button>
        </div>
      ) : null}

      <Modal open={showGuide} onClose={() => setShowGuide(false)} title={ex.nameEs}>
        <GuideContent exerciseId={ex.id} compact />
      </Modal>

      <Modal open={showSubstitute} onClose={() => setShowSubstitute(false)} title="Sustituir ejercicio">
        <p className="mb-3 text-sm text-muted">Elige una alternativa para hoy. Se registrará como sustitución y no afectará a la progresión de {ex.nameEs}.</p>
        <ul className="flex flex-col gap-2">
          {guide.alternatives.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => substitute(a)} className={`w-full rounded-2xl border p-3 text-left hover:bg-surface-2 ${log.substitute?.id === a.id ? 'border-sage bg-sage-soft' : 'border-line bg-surface'}`}>
                <p className="font-semibold">{a.name}</p>
                <p className="text-sm text-muted">{a.why}</p>
              </button>
            </li>
          ))}
        </ul>
        {log.substitute ? (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => substitute(null)}>
            Volver a {ex.nameEs}
          </Button>
        ) : null}
      </Modal>

      <Modal
        open={painOpen}
        onClose={() => setPainOpen(false)}
        title="Detén el ejercicio"
        footer={
          <div className="grid gap-2">
            <Button variant="primary" onClick={() => { setPainOpen(false); skipExercise(); }}>Omitir este ejercicio</Button>
            <Button variant="secondary" onClick={() => { setPainOpen(false); setShowSubstitute(true); }}>Elegir una alternativa</Button>
            <Button variant="danger" onClick={() => { setPainOpen(false); goToSummary(s); }}>Terminar la sesión</Button>
          </div>
        }
      >
        <Notice tone="danger" title="Registraste dolor o molestia">
          Para aquí. No continúes con este ejercicio ni subas carga. Si el dolor es agudo, punzante, no desaparece al parar o aparece con mareo, falta de aire o dolor en el pecho, busca atención profesional.
        </Notice>
      </Modal>

      <Modal
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        title="¿Salir del modo coach?"
        footer={
          <div className="grid gap-2">
            <Button onClick={() => navigate('/')}>Guardar y salir (continuar después)</Button>
            <Button variant="secondary" onClick={() => setConfirmExit(false)}>Seguir entrenando</Button>
          </div>
        }
      >
        <p>Todo lo registrado ya está guardado en este dispositivo. Podrás reanudar la sesión desde Inicio.</p>
      </Modal>
    </div>
  );
}

// ---------- Registro de serie ----------

function SetLogger({
  ex,
  log,
  loadType,
  inventory,
  settings,
  soundOn,
  onComplete,
}: {
  ex: PlanExercise;
  log: ExerciseLog;
  loadType: LoadType;
  inventory: InventoryItem[];
  settings: Settings;
  soundOn: boolean;
  onComplete: (e: Omit<SetLog, 'setNumber' | 'completedAt'>) => void;
}) {
  const last = log.sets[log.sets.length - 1];
  const options = useMemo(() => [0, ...availableLoadsLb(inventory, loadType, ex.unilateral)], [inventory, loadType, ex.unilateral]);
  const initialLoad = loadType === 'body' ? 0 : last?.loadLb ?? log.plannedLoadLb;
  const [loadLb, setLoadLb] = useState(initialLoad);
  const [reps, setReps] = useState(last?.reps ?? ex.repsMax);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [pain, setPain] = useState(false);
  const [techniqueOk, setTechniqueOk] = useState(true);

  // Cronómetro para ejercicios por tiempo
  const [hold, setHold] = useState<TimerState | null>(null);
  const holdNow = useNow(hold?.status === 'running', 200);
  const prevHold = useRef<number | null>(null);
  useEffect(() => {
    if (!hold || hold.status !== 'running') return;
    const rem = remainingMs(hold, holdNow);
    const prev = prevHold.current;
    prevHold.current = rem;
    if (prev !== null) {
      const cues = cuesBetween(prev, rem, hold.durationMs);
      if (cues.includes('done')) {
        if (soundOn) doneChime();
        if (settings.vibration) vibrate([150, 80, 150]);
        setReps(Math.round(hold.durationMs / 1000));
        setHold(tick(hold, holdNow));
      } else if (soundOn && cues.some((c) => c === 'three' || c === 'two' || c === 'one')) beep(880, 100);
    }
  }, [holdNow, hold, soundOn, settings.vibration]);

  const stepLoad = (dir: 1 | -1) => {
    const idx = options.findIndex((o) => Math.abs(o - loadLb) < 0.01);
    if (idx === -1) {
      const nearest = dir === 1 ? options.find((o) => o > loadLb) : [...options].reverse().find((o) => o < loadLb);
      if (nearest !== undefined) setLoadLb(nearest);
      return;
    }
    const n = options[idx + dir];
    if (n !== undefined) setLoadLb(n);
  };

  const holdElapsedSec = hold ? Math.round((hold.durationMs - remainingMs(hold, holdNow)) / 1000) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4">
      <p className="font-semibold">Registrar serie {Math.min(log.sets.length + 1, Math.max(log.plannedSets, log.sets.length + 1))}</p>

      {loadType !== 'body' ? (
        <Stepper
          label={loadType === 'each' ? 'Peso por mano' : 'Peso total'}
          value={loadLb}
          display={loadLb > 0 ? formatWeight(loadLb, settings.unit) : 'Sin peso'}
          onDec={() => stepLoad(-1)}
          onInc={() => stepLoad(1)}
        />
      ) : null}
      {loadType !== 'body' && options.length <= 1 ? (
        <Notice tone="warn">No tienes mancuernas registradas para este ejercicio. Añádelas en Ajustes → Inventario o hazlo sin peso.</Notice>
      ) : null}

      {ex.timed && !log.substitute ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant={hold?.status === 'running' ? 'secondary' : 'soft'}
              className="flex-1"
              onClick={() => {
                unlockAudio();
                const t = Date.now();
                if (!hold || hold.status === 'done' || hold.status === 'idle') {
                  prevHold.current = null;
                  setHold(start(createTimer(ex.repsMax), t));
                } else if (hold.status === 'running') {
                  setHold(pause(hold, t));
                  setReps(Math.max(1, holdElapsedSec));
                } else setHold(resume(hold, t));
              }}
            >
              {hold?.status === 'running' ? '⏸ Parar cronómetro' : hold?.status === 'paused' ? '▶ Continuar' : `⏱ Iniciar ${ex.repsMax} s`}
            </Button>
            <span className="tabular w-20 text-center font-display text-3xl font-semibold" aria-live="off">
              {hold ? formatClock(remainingMs(hold, holdNow)) : `0:${String(ex.repsMax).padStart(2, '0')}`}
            </span>
          </div>
        </div>
      ) : null}

      <Stepper
        label={ex.timed && !log.substitute ? 'Segundos logrados' : ex.perSide ? 'Repeticiones por lado' : 'Repeticiones'}
        value={reps}
        onDec={() => setReps((r) => Math.max(0, r - 1))}
        onInc={() => setReps((r) => r + 1)}
      />

      {settings.askDifficulty ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">¿Cómo se sintió? (opcional)</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'ok', 'hard'] as const).map((d) => (
              <Chip key={d} selected={difficulty === d} onClick={() => setDifficulty(difficulty === d ? null : d)} className="px-2">
                {DIFFICULTY_LABELS[d]}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="divide-y divide-line rounded-2xl bg-surface-2 px-3">
        <Toggle checked={techniqueOk} onChange={setTechniqueOk} label="Técnica adecuada" description="Movimiento controlado y en buena postura" />
        <Toggle checked={pain} onChange={setPain} label="Sentí dolor o molestia" description="Te indicaremos parar" />
      </div>

      <Button
        size="xl"
        className="w-full"
        variant={pain ? 'danger' : 'primary'}
        onClick={() => onComplete({ reps, loadLb: loadType === 'body' ? 0 : loadLb, difficulty, pain, techniqueOk })}
      >
        {pain ? 'Registrar y parar' : '✓ Completar serie'}
      </Button>
    </div>
  );
}

// ---------- Calentamiento ----------

function Warmup({ onDone, soundOn, voiceOn, now }: { onDone: () => void; soundOn: boolean; voiceOn: boolean; now: number }) {
  const [timer, setTimer] = useState<TimerState>(() => createTimer(WARMUP_MINUTES * 60));
  const prev = useRef<number | null>(null);
  const rem = remainingMs(timer, now);
  const elapsed = timer.durationMs - rem;
  let acc = 0;
  let currentStep = WARMUP_STEPS.length - 1;
  for (let i = 0; i < WARMUP_STEPS.length; i++) {
    acc += WARMUP_STEPS[i].seconds * 1000;
    if (elapsed < acc) {
      currentStep = i;
      break;
    }
  }
  const stepRef = useRef(-1);
  useEffect(() => {
    if (timer.status !== 'running') return;
    if (stepRef.current !== currentStep) {
      stepRef.current = currentStep;
      if (voiceOn) speak(WARMUP_STEPS[currentStep].name);
      else if (soundOn) beep(660, 120);
    }
    const p = prev.current;
    prev.current = rem;
    if (p !== null && cuesBetween(p, rem, timer.durationMs).includes('done')) {
      if (soundOn) doneChime();
      setTimer(tick(timer, now));
    }
  }, [now, timer, currentStep, rem, soundOn, voiceOn]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Calentamiento · {WARMUP_MINUTES} min</h1>
      <p className="text-muted">Movimientos suaves para preparar articulaciones y músculos. Puedes saltarlo si ya calentaste.</p>
      <div className="flex justify-center">
        <ProgressRing value={1 - rem / timer.durationMs} size={180} stroke={12} label={`Calentamiento: quedan ${Math.ceil(rem / 1000)} segundos`}>
          <span className="tabular font-display text-5xl font-semibold" aria-hidden>{formatClock(rem)}</span>
        </ProgressRing>
      </div>
      <ol className="flex flex-col gap-2">
        {WARMUP_STEPS.map((st, i) => (
          <li key={st.name} className={`flex justify-between rounded-2xl px-4 py-3 ${timer.status !== 'idle' && i === currentStep ? 'bg-sage text-on-sage' : 'bg-surface-2'}`} aria-current={timer.status !== 'idle' && i === currentStep ? 'step' : undefined}>
            <span>{st.name}</span>
            <span className="tabular">{st.seconds} s</span>
          </li>
        ))}
      </ol>
      {timer.status === 'running' ? (
        <Button variant="secondary" size="lg" onClick={() => setTimer(pause(timer, Date.now()))}>⏸ Pausar calentamiento</Button>
      ) : timer.status === 'done' ? null : (
        <Button
          variant="soft"
          size="lg"
          onClick={() => {
            unlockAudio();
            setTimer(timer.status === 'paused' ? resume(timer, Date.now()) : start(timer, Date.now()));
          }}
        >
          {timer.status === 'paused' ? '▶ Reanudar calentamiento' : '▶ Iniciar calentamiento guiado'}
        </Button>
      )}
      <Button size="xl" onClick={onDone}>
        {timer.status === 'done' ? 'Empezar entrenamiento' : 'Listo, empezar entrenamiento'}
      </Button>
    </div>
  );
}

// ---------- Resumen y sugerencias ----------

function Summary({ session: s, commit, settings, inventory }: { session: WorkoutSession; commit: (s: WorkoutSession) => void; settings: Settings; inventory: InventoryItem[] }) {
  const toast = useToast();
  const sessions = useSessions();
  const adjustments = useAdjustments();
  const [notes, setNotes] = useState(s.notes ?? '');
  const [approved, setApproved] = useState<Record<string, number>>({});

  if (!sessions || !adjustments) return <Loading />;
  const merged = sessions.map((x) => (x.id === s.id ? s : x));
  if (!merged.some((x) => x.id === s.id)) merged.push(s);

  const approve = async (exId: string, toLb: number, reason: string) => {
    const plan = findPlanExercise(exId)!;
    await db.adjustments.add({
      exerciseId: exId,
      createdAt: new Date().toISOString(),
      deltaLb: toLb - plannedLoadLb(plan, s.week),
      approvedLb: toLb,
      reason,
    });
    setApproved((a) => ({ ...a, [exId]: toLb }));
    toast(`Nueva propuesta para ${plan.nameEs}: ${formatWeight(toLb, settings.unit)}`);
  };

  const finish = () => {
    commit({ ...s, status: 'completed', endedAt: new Date().toISOString(), notes, phase: 'summary', rest: null });
    toast('Sesión guardada. ¡Bien hecho!');
    navigate('/');
  };

  const totalSets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  const minutes = Math.max(1, Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Resumen</h1>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-sage-soft p-3">
          <p className="tabular text-2xl font-bold">{totalSets}</p>
          <p className="text-sm text-muted">series</p>
        </div>
        <div className="rounded-2xl bg-sage-soft p-3">
          <p className="tabular text-2xl font-bold">{s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000) : minutes}</p>
          <p className="text-sm text-muted">minutos</p>
        </div>
      </div>

      <Notice>Las sugerencias no cambian nada por sí solas: solo se aplican si las apruebas. Las cargas son referencias que adaptas a tu capacidad real.</Notice>

      <ul className="flex flex-col gap-3">
        {s.exercises.map((log) => {
          const ex = findPlanExercise(log.exerciseId)!;
          if (log.status === 'skipped' || log.sets.length === 0)
            return (
              <li key={log.exerciseId} className="rounded-2xl border border-line bg-surface p-3">
                <p className="font-semibold">{exerciseName(log)}</p>
                <p className="text-sm text-muted">{log.status === 'skipped' ? 'Omitido' : 'Sin registrar'}</p>
              </li>
            );
          let sug: Suggestion | null = null;
          if (!log.substitute) {
            const history = exerciseHistory(merged, ex.id);
            const current = Math.max(...log.sets.map((x) => x.loadLb));
            sug = suggestProgression({
              history,
              currentLoadLb: current,
              loadType: ex.loadType,
              available: availableLoadsLb(inventory, ex.loadType, ex.unilateral),
              repsMax: ex.repsMax,
              timed: ex.timed,
            });
          }
          const usedMax = Math.max(...log.sets.map((x) => x.loadLb));
          const changedLoad = ex.loadType !== 'body' && !log.substitute && Math.abs(usedMax - log.plannedLoadLb) > 0.01 && sug?.kind !== 'stop_pain';
          const isApproved = approved[ex.id] !== undefined;
          return (
            <li key={log.exerciseId} className="rounded-2xl border border-line bg-surface p-3">
              <p className="font-semibold">{exerciseName(log)}</p>
              <p className="tabular text-sm text-muted">
                {log.sets.map((x) => `${x.reps}${ex.timed ? 's' : ''}`).join(' · ')} {ex.loadType !== 'body' && !log.substitute ? `— ${formatLoad(usedMax, ex.loadType, settings.unit)}` : ''}
              </p>
              {sug ? (
                <div className="mt-2">
                  <Notice tone={sug.kind === 'stop_pain' ? 'danger' : sug.kind === 'increase' ? 'success' : sug.kind === 'decrease' || sug.kind === 'decrease_reps' ? 'warn' : 'info'}>
                    {sug.message}
                  </Notice>
                  {(sug.kind === 'increase' || sug.kind === 'decrease') && !isApproved ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => approve(ex.id, sug.toLb, sug.kind === 'increase' ? 'Dos sesiones fáciles' : 'Sesión demasiado difícil')}>
                        Aprobar {formatWeight(sug.toLb, settings.unit)}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setApproved((a) => ({ ...a, [ex.id]: -1 }))}>No, mantener</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {changedLoad && !isApproved ? (
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => approve(ex.id, usedMax, 'Carga usada por la persona')}>
                  Usar {formatWeight(usedMax, settings.unit)} como nueva propuesta
                </Button>
              ) : null}
              {isApproved && approved[ex.id] > 0 ? <p className="mt-2 text-sm font-semibold text-sage-strong">✓ Propuesta actualizada a {formatWeight(approved[ex.id], settings.unit)}</p> : null}
            </li>
          );
        })}
      </ul>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted">Notas de la sesión (opcional)</span>
        <textarea className={`${inputClass} min-h-24 py-3`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Energía, sueño, cómo te sentiste…" />
      </label>
      {s.status === 'completed' ? (
        <Button size="xl" onClick={() => navigate('/')}>Volver al inicio</Button>
      ) : (
        <>
          <Button size="xl" onClick={finish}>Guardar y terminar</Button>
          <Button variant="secondary" onClick={() => commit({ ...s, phase: 'work' })}>Volver al entrenamiento</Button>
        </>
      )}
    </div>
  );
}
