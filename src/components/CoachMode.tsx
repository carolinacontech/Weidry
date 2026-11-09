import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GUIDE, WARMUP_STEPS, type Alternative } from '../data/guide';
import { DAY_LABELS, RIR_TARGET, WARMUP_MINUTES, getExercise, type Exercise, type Mode } from '../data/plan';
import { useAdjustments, useInventory, useSessions, useSettings } from '../hooks/useData';
import { useNow } from '../hooks/useNow';
import { navigate } from '../hooks/useRoute';
import { useWakeLock } from '../hooks/useWakeLock';
import { db, saveSession, updateSettings } from '../lib/db';
import { beep, doneChime, isAppSpeaking, speak, stopSpeaking, unlockAudio, vibrate } from '../lib/platform';
import { RIR_OPTIONS, rirLabel, suggestProgression, type Suggestion } from '../lib/progression';
import { exerciseName, nextPendingIndex, sessionProgress } from '../lib/session';
import { exerciseHistory, topOption } from '../lib/stats';
import { addTime, createTimer, cuesBetween, formatClock, pause, remainingMs, resume, start, tick, type Cue, type TimerState } from '../lib/timer';
import { plannedOptionOf, setOption, type ExerciseLog, type SetLog, type Settings, type Tempo, type WorkoutSession } from '../lib/types';
import { COMMAND_HELP, createListener, speechRecognitionSupported, type ListenerState, type VoiceCommand } from '../lib/voiceCommands';
import { compareOptions, formatOption, formatOptionShort, ladderFor, nearestAtOrBelow, optionIndex, sameOption, type InventoryItem, type LoadOption } from '../lib/weights';
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

const MODE_LABELS: Record<Exclude<Mode, 'body'>, string> = {
  held: '1 mancuerna, ambas manos',
  each: '1 en cada mano',
  one: '1 mancuerna, una mano',
};

function repsText(ex: Exercise) {
  const side = ex.perSide ? ' por lado' : '';
  if (ex.timed) return `${ex.repsMin} a ${ex.repsMax} segundos${side}`;
  if (ex.repsMin === ex.repsMax) return `${ex.repsMax} repeticiones${side}`;
  return `${ex.repsMin} a ${ex.repsMax} repeticiones${side}`;
}

function modeOfLog(log: ExerciseLog, ex: Exercise): Mode {
  return log.substitute?.mode ?? ex.mode;
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
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const active = s.status === 'in_progress';
  const wake = useWakeLock(settings.wakeLock && active && !s.paused);

  // Siempre trabajar con la versión más reciente (los comandos de voz llegan de forma asíncrona).
  const sRef = useRef(s);
  sRef.current = s;

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [s.phase, s.exerciseIndex]);

  const commit = (next: WorkoutSession) => {
    sRef.current = next;
    setSession(next);
    void saveSession(next);
  };

  const log = s.exercises[s.exerciseIndex];
  const ex = getExercise(log.exerciseId)!;
  const guide = GUIDE[ex.id];
  const name = exerciseName(log);
  const mode = modeOfLog(log, ex);
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
    for (const c of cuesBetween(prev, rem, s.rest.durationMs)) {
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
    if (tick(s.rest, now).status === 'done') finishRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, s.phase, s.rest]);

  useEffect(() => {
    if (s.phase === 'rest' && s.rest && s.rest.status === 'running' && remainingMs(s.rest, Date.now()) === 0) finishRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const instruction = () => {
    const cur = sRef.current;
    const l = cur.exercises[cur.exerciseIndex];
    const e = getExercise(l.exerciseId)!;
    const n = Math.min(l.sets.length + 1, l.plannedSets);
    const load = formatOption(plannedOptionOf(l), modeOfLog(l, e), settings.unit);
    return `Serie ${n} de ${l.plannedSets}. ${exerciseName(l)}. ${repsText(e)}. ${load}. Termina con ${RIR_TARGET.min} o ${RIR_TARGET.max} repeticiones en reserva.`;
  };

  const announceKey = s.phase === 'work' ? `${s.exerciseIndex}-${log.sets.length}-${log.substitute?.id ?? ''}` : '';
  useEffect(() => {
    if (!announceKey || !voiceOn) return;
    speak(instruction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announceKey]);

  useEffect(() => () => stopSpeaking(), []);

  function restDurationFor(e: Exercise) {
    return settings.restSec || e.restSec;
  }

  function finishRest() {
    commit({ ...sRef.current, phase: 'work', rest: null });
  }

  function goToSummary(next: WorkoutSession) {
    commit({ ...next, phase: 'summary', rest: null });
    if (voiceOn) speak('Sesión completada. Buen trabajo.');
  }

  function completeSet(entry: Omit<SetLog, 'setNumber' | 'completedAt'>) {
    unlockAudio();
    const cur = sRef.current;
    const l = cur.exercises[cur.exerciseIndex];
    const e = getExercise(l.exerciseId)!;
    const sets = [...l.sets, { ...entry, setNumber: l.sets.length + 1, completedAt: new Date().toISOString() }];
    const exDone = sets.length >= l.plannedSets;
    const exercises = cur.exercises.map((x, i) => (i === cur.exerciseIndex ? { ...x, sets, status: exDone ? ('done' as const) : x.status } : x));
    let next: WorkoutSession = { ...cur, exercises };
    if (settings.vibration) vibrate(60);

    if (entry.pain) {
      commit({ ...next, phase: 'work', rest: null });
      setPainOpen(true);
      if (voiceOn) speak('Registraste dolor. Detén el ejercicio.');
      return;
    }
    const nextIdx = exDone ? nextPendingIndex(next, cur.exerciseIndex) : cur.exerciseIndex;
    if (nextIdx === -1) return goToSummary(next);
    const dur = restDurationFor(e);
    next = { ...next, exerciseIndex: nextIdx, phase: 'rest', rest: start(createTimer(dur), Date.now()) };
    commit(next);
    if (voiceOn) speak(`Serie registrada. Descansa ${dur} segundos.`);
  }

  function skipExercise() {
    const cur = sRef.current;
    const exercises = cur.exercises.map((e, i) => (i === cur.exerciseIndex ? { ...e, status: e.sets.length > 0 ? ('done' as const) : ('skipped' as const) } : e));
    const next = { ...cur, exercises };
    const idx = nextPendingIndex(next, cur.exerciseIndex);
    if (idx === -1) return goToSummary(next);
    commit({ ...next, exerciseIndex: idx, phase: 'work', rest: null });
    toast('Ejercicio omitido', 'info');
  }

  function move(delta: number) {
    const cur = sRef.current;
    const idx = Math.min(cur.exercises.length - 1, Math.max(0, cur.exerciseIndex + delta));
    if (idx === cur.exerciseIndex) return;
    const exercises = cur.exercises.map((e, i) => (i === idx && e.status === 'skipped' ? { ...e, status: 'pending' as const } : e));
    commit({ ...cur, exercises, exerciseIndex: idx, phase: 'work', rest: null });
  }

  function substitute(alt: Alternative | null) {
    const cur = sRef.current;
    const exercises = cur.exercises.map((e, i) => {
      if (i !== cur.exerciseIndex) return e;
      if (!alt) return { ...e, substitute: undefined, sets: [], status: 'pending' as const };
      return { ...e, substitute: { id: alt.id, name: alt.name, mode: alt.mode }, sets: [], status: 'pending' as const };
    });
    commit({ ...cur, exercises, phase: 'work', rest: null });
    setShowSubstitute(false);
    toast(alt ? `Sustituido por: ${alt.name}` : 'Ejercicio original restaurado');
  }

  function setPaused(paused: boolean) {
    const cur = sRef.current;
    if (!!cur.paused === paused) return;
    const t = Date.now();
    if (!paused) {
      unlockAudio();
      commit({ ...cur, paused: false, rest: cur.rest ? resume(cur.rest, t) : cur.rest });
    } else {
      stopSpeaking();
      commit({ ...cur, paused: true, rest: cur.rest ? pause(cur.rest, t) : cur.rest });
    }
  }

  function setRest(fn: (r: TimerState) => TimerState) {
    const cur = sRef.current;
    if (!cur.rest) return;
    commit({ ...cur, rest: fn(cur.rest) });
  }

  // ---------- Comandos de voz ----------
  const submitRef = useRef<(() => void) | null>(null);
  const [listenState, setListenState] = useState<ListenerState>('off');
  const voiceCmdOn = settings.voiceCommands && active && s.phase !== 'summary';
  const handleCommand = useRef<(c: VoiceCommand, heard: string) => void>(() => undefined);
  handleCommand.current = (c, heard) => {
    const cur = sRef.current;
    toast(`🎙 “${heard.trim()}”`, 'info');
    if (c === 'pause') return setPaused(true);
    if (c === 'resume') return setPaused(false);
    if (cur.paused) return;
    if (c === 'repeat') return speak(cur.phase === 'rest' ? 'Estás descansando. Di saltar para empezar la siguiente serie.' : instruction());
    if (cur.phase === 'rest') {
      if (c === 'complete' || c === 'skipRest') return finishRest();
      if (c === 'addTime') return setRest((r) => addTime(r, 15, Date.now()));
    }
    if (cur.phase === 'warmup' && (c === 'complete' || c === 'skipRest')) return commit({ ...cur, phase: 'work' });
    if (cur.phase === 'work') {
      if (c === 'complete') return submitRef.current?.();
      if (c === 'next') return move(1);
      if (c === 'previous') return move(-1);
    }
  };
  useEffect(() => {
    if (!voiceCmdOn) return;
    const l = createListener({ onCommand: (c, h) => handleCommand.current(c, h), onState: setListenState, isAppSpeaking });
    l.start();
    return () => l.stop();
  }, [voiceCmdOn]);

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
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  if (!speechRecognitionSupported()) return setShowVoiceHelp(true);
                  void updateSettings({ voiceCommands: !settings.voiceCommands });
                  if (!settings.voiceCommands) setShowVoiceHelp(true);
                }}
                aria-pressed={settings.voiceCommands}
                aria-label={settings.voiceCommands ? 'Desactivar comandos de voz' : 'Activar comandos de voz'}
                className={`h-11 w-11 rounded-full text-lg ${settings.voiceCommands ? (listenState === 'listening' ? 'bg-sage text-on-sage' : 'bg-warn-soft') : 'hover:bg-surface-2'}`}
              >
                🎙
              </button>
              <button type="button" onClick={() => setPaused(!s.paused)} className="min-h-11 rounded-full px-3 font-semibold text-sage-strong hover:bg-surface-2" aria-pressed={!!s.paused}>
                {s.paused ? '▶ Seguir' : '⏸ Pausa'}
              </button>
            </div>
          ) : (
            <span className="w-16" />
          )}
        </div>
        <div className="mx-auto mt-2 h-1.5 max-w-xl overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Progreso de la sesión" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done}>
          <div className="h-full bg-sage transition-all" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
        </div>
        {settings.voiceCommands && s.phase !== 'summary' ? (
          <p className="mx-auto mt-1 max-w-xl text-center text-xs text-muted" aria-live="polite">
            {listenState === 'listening'
              ? 'Escuchando: “listo”, “pausa”, “siguiente”, “saltar”, “más tiempo”…'
              : listenState === 'denied'
                ? 'Micrófono bloqueado: actívalo en los ajustes del navegador.'
                : listenState === 'unsupported'
                  ? 'Este navegador no admite comandos de voz.'
                  : 'Activando micrófono…'}
          </p>
        ) : null}
      </header>

      <main className="safe-bottom mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-4">
        {s.phase === 'warmup' ? (
          <Warmup
            onDone={() => {
              unlockAudio();
              commit({ ...sRef.current, phase: 'work' });
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
                  {ex.glute ? ' · glúteo' : ''}
                  {log.status === 'done' ? ' · completado' : log.status === 'skipped' ? ' · omitido' : ''}
                </p>
                <h1 className="font-display text-3xl font-semibold leading-tight">{name}</h1>
                <p className="text-sm text-muted">{log.substitute ? `Sustituye a: ${ex.nameEs}` : ex.name}</p>
              </div>
              <ProgressRing value={log.sets.length / log.plannedSets} size={62} label={`Serie ${setNumber} de ${log.plannedSets}`}>
                <span className="tabular text-sm font-bold">{Math.min(log.sets.length, log.plannedSets)}/{log.plannedSets}</span>
              </ProgressRing>
            </div>

            {!log.substitute ? <ExerciseIllustration pattern={guide.pattern} label={ex.nameEs} className="aspect-[16/10]" /> : null}

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Objetivo</p>
                <p className="font-semibold">{ex.timed ? ex.reps : `${ex.reps} reps`}</p>
                <p className="text-xs text-muted">con {RIR_TARGET.min}–{RIR_TARGET.max} en reserva</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Propuesta (si la técnica lo permite)</p>
                <p className="font-semibold leading-tight">{formatOption(log.substitute ? { kind: 'body', lb: 0 } : plannedOptionOf(log), mode, settings.unit)}</p>
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
              mode={mode}
              inventory={inventory}
              settings={settings}
              soundOn={soundOn}
              onComplete={completeSet}
              registerSubmit={(fn) => (submitRef.current = fn)}
            />

            {log.sets.length > 0 ? (
              <div className="rounded-2xl bg-surface-2 p-3 text-sm">
                <p className="mb-1 font-semibold">Series registradas</p>
                <ul className="space-y-1">
                  {log.sets.map((st) => (
                    <li key={st.setNumber} className="tabular flex justify-between gap-2">
                      <span>
                        Serie {st.setNumber}: {st.reps} {ex.timed && !log.substitute ? 's' : 'reps'} · {formatOptionShort(setOption(st), st.mode ?? mode, settings.unit)}
                        {st.tempo === 'lento' ? ' · tempo lento' : ''}
                      </span>
                      <span className="text-muted">{st.pain ? 'dolor' : st.rir !== undefined && st.rir !== null ? `RIR ${rirLabel(st.rir)}` : ''}</span>
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
            <Button variant="ghost" onClick={() => goToSummary(sRef.current)}>
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
          <p className="max-w-xs text-muted">Tu progreso está guardado. Puedes cerrar la app y continuar más tarde desde Inicio.{settings.voiceCommands ? ' Di “seguir” para continuar.' : ''}</p>
          <Button size="xl" className="w-full max-w-xs" onClick={() => setPaused(false)}>▶ Reanudar</Button>
          <Button variant="secondary" className="w-full max-w-xs" onClick={() => navigate('/')}>Guardar y salir</Button>
        </div>
      ) : null}

      <Modal open={showGuide} onClose={() => setShowGuide(false)} title={ex.nameEs}>
        <GuideContent exerciseId={ex.id} compact />
      </Modal>

      <Modal open={showVoiceHelp} onClose={() => setShowVoiceHelp(false)} title="Comandos de voz">
        {speechRecognitionSupported() ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Con el micrófono activo puedes decir:</p>
            <ul className="divide-y divide-line">
              {COMMAND_HELP.map((c) => (
                <li key={c.say} className="flex justify-between gap-3 py-2 text-sm">
                  <strong>{c.say}</strong>
                  <span className="text-right text-muted">{c.does}</span>
                </li>
              ))}
            </ul>
            <Notice>“Listo” registra la serie con los valores que tengas en pantalla. En iPhone el micrófono necesita permiso, deja de escuchar con la pantalla bloqueada y puede pausarse tras silencios largos (se reactiva solo).</Notice>
          </div>
        ) : (
          <Notice tone="warn">Este navegador no admite reconocimiento de voz. Las indicaciones habladas y el temporizador siguen funcionando.</Notice>
        )}
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
            <Button onClick={() => { setPainOpen(false); skipExercise(); }}>Omitir este ejercicio</Button>
            <Button variant="secondary" onClick={() => { setPainOpen(false); setShowSubstitute(true); }}>Elegir una alternativa</Button>
            <Button variant="danger" onClick={() => { setPainOpen(false); goToSummary(sRef.current); }}>Terminar la sesión</Button>
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
  mode: baseMode,
  inventory,
  settings,
  soundOn,
  onComplete,
  registerSubmit,
}: {
  ex: Exercise;
  log: ExerciseLog;
  mode: Mode;
  inventory: InventoryItem[];
  settings: Settings;
  soundOn: boolean;
  onComplete: (e: Omit<SetLog, 'setNumber' | 'completedAt'>) => void;
  registerSubmit: (fn: () => void) => void;
}) {
  const last = log.sets[log.sets.length - 1];
  const [mode, setMode] = useState<Mode>(last?.mode ?? baseMode);
  // En el registro se permite cualquier opción real: peso corporal, alternativas ligeras y mancuernas fijas.
  const ladder = useMemo(() => ladderFor({ mode, allowBody: true, allowLight: true }, inventory), [mode, inventory]);
  const initial: LoadOption = last ? setOption(last) : log.substitute ? { kind: 'body', lb: 0 } : plannedOptionOf(log);
  const [option, setOptionState] = useState<LoadOption>(() => nearestAtOrBelow(ladder, initial) ?? { kind: 'body', lb: 0 });
  const [reps, setReps] = useState(last?.reps ?? ex.repsMax);
  const [rir, setRir] = useState<number | null>(null);
  const [tempo, setTempo] = useState<Tempo>(last?.tempo ?? 'normal');
  const [pain, setPain] = useState(false);
  const [techniqueOk, setTechniqueOk] = useState(true);
  const timedMain = ex.timed && !log.substitute;

  // Si cambia la sujeción, ajustar la carga a una opción válida.
  useEffect(() => {
    if (optionIndex(ladder, option) === -1) setOptionState(nearestAtOrBelow(ladder, option) ?? ladder[0]);
  }, [ladder, option]);

  const entry = { reps, option, loadLb: option.kind === 'body' ? 0 : option.lb, rir, tempo, mode: mode !== baseMode ? mode : undefined, pain, techniqueOk };
  const entryRef = useRef(entry);
  entryRef.current = entry;
  useEffect(() => {
    registerSubmit(() => onComplete(entryRef.current));
  }, [registerSubmit, onComplete]);

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
    const idx = optionIndex(ladder, option);
    const n = ladder[(idx === -1 ? 0 : idx) + dir];
    if (n) setOptionState(n);
  };
  const holdElapsedSec = hold ? Math.round((hold.durationMs - remainingMs(hold, holdNow)) / 1000) : 0;
  const planned = plannedOptionOf(log);
  const aboveProposal = !log.substitute && compareOptions(option, planned) > 0;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4">
      <p className="font-semibold">Registrar serie {log.sets.length + 1}</p>

      {baseMode !== 'body' ? (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Cómo sujetas la carga</legend>
            <div className="flex flex-wrap gap-2">
              {(['held', 'each', 'one'] as const).map((m) => (
                <Chip key={m} selected={mode === m} onClick={() => setMode(m)} className="px-3">
                  {MODE_LABELS[m]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div>
            <Stepper
              label={mode === 'each' ? 'Carga real (por mano)' : mode === 'one' ? 'Carga real (en una mano)' : 'Carga real (total)'}
              value={option.lb}
              display={option.kind === 'body' ? 'Peso corporal' : option.kind === 'light' ? option.label ?? 'Ligera' : formatOptionShort(option, mode, settings.unit)}
              onDec={() => stepLoad(-1)}
              onInc={() => stepLoad(1)}
            />
            <p className="mt-1 text-center text-sm text-muted">{formatOption(option, mode, settings.unit)}</p>
            {sameOption(option, planned) && !log.substitute ? <p className="text-center text-xs font-semibold text-sage-strong">= propuesta de hoy</p> : null}
            {aboveProposal ? (
              <p className="mt-1 text-center text-xs text-warn">Por encima de la propuesta: úsala solo si mantienes la técnica y {RIR_TARGET.min}–{RIR_TARGET.max} RIR.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {timedMain ? (
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
            {hold ? formatClock(remainingMs(hold, holdNow)) : formatClock(ex.repsMax * 1000)}
          </span>
        </div>
      ) : null}

      <Stepper
        label={timedMain ? 'Segundos logrados' : ex.perSide ? 'Repeticiones por lado' : 'Repeticiones'}
        value={reps}
        onDec={() => setReps((r) => Math.max(0, r - 1))}
        onInc={() => setReps((r) => r + 1)}
      />

      {settings.askRir ? (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-muted">Repeticiones en reserva (RIR)</legend>
          <p className="mb-2 text-xs text-muted">¿Cuántas más podrías haber hecho con buena técnica? Objetivo: {RIR_TARGET.min}–{RIR_TARGET.max}.</p>
          <div className="grid grid-cols-5 gap-2">
            {RIR_OPTIONS.map((r) => (
              <Chip
                key={r}
                selected={rir === r}
                onClick={() => setRir(rir === r ? null : r)}
                className={`px-0 ${r >= RIR_TARGET.min && r <= RIR_TARGET.max && rir !== r ? 'border-sage' : ''}`}
                aria-label={`${rirLabel(r)} repeticiones en reserva${r >= RIR_TARGET.min && r <= RIR_TARGET.max ? ' (objetivo)' : ''}`}
              >
                {rirLabel(r)}
              </Chip>
            ))}
          </div>
          {rir !== null && rir <= 1 ? <p className="mt-1 text-xs text-warn">Muy cerca del fallo: en la siguiente serie haz 1–2 repeticiones menos o baja la carga.</p> : null}
        </fieldset>
      ) : null}

      <div className="divide-y divide-line rounded-2xl bg-surface-2 px-3">
        <Toggle checked={tempo === 'lento'} onChange={(v) => setTempo(v ? 'lento' : 'normal')} label="Tempo lento" description="3 s al bajar y 1 s de pausa: progresión sin subir peso" />
        <Toggle checked={techniqueOk} onChange={setTechniqueOk} label="Técnica adecuada" description="Movimiento controlado y en buena postura" />
        <Toggle checked={pain} onChange={setPain} label="Sentí dolor o molestia" description="Te indicaremos parar" />
      </div>

      <Button size="xl" className="w-full" variant={pain ? 'danger' : 'primary'} onClick={() => onComplete(entry)}>
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
  const [decided, setDecided] = useState<Record<string, LoadOption | null>>({});

  if (!sessions || !adjustments) return <Loading />;
  const merged = sessions.map((x) => (x.id === s.id ? s : x));
  if (!merged.some((x) => x.id === s.id)) merged.push(s);

  const approve = async (ex: Exercise, option: LoadOption, reason: string) => {
    await db.adjustments.add({ exerciseId: ex.id, createdAt: new Date().toISOString(), option, reason });
    setDecided((a) => ({ ...a, [ex.id]: option }));
    toast(`Nueva propuesta para ${ex.nameEs}: ${formatOptionShort(option, ex.mode, settings.unit)}`);
  };

  const finish = () => {
    commit({ ...s, status: 'completed', endedAt: new Date().toISOString(), notes, phase: 'summary', rest: null });
    toast('Sesión guardada. ¡Bien hecho!');
    navigate('/');
  };

  const totalSets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  const minutes = Math.max(1, Math.round(((s.endedAt ? new Date(s.endedAt).getTime() : Date.now()) - new Date(s.startedAt).getTime()) / 60000));
  const gluteSets = s.exercises.filter((e) => !e.substitute && getExercise(e.exerciseId)?.glute).reduce((a, e) => a + e.sets.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Resumen</h1>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [totalSets, 'series'],
          [gluteSets, 'de glúteo'],
          [minutes, 'minutos'],
        ].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-sage-soft p-3">
            <p className="tabular text-2xl font-bold">{v}</p>
            <p className="text-sm text-muted">{l}</p>
          </div>
        ))}
      </div>

      <Notice>
        Solo se recomienda subir peso tras dos sesiones seguidas con todas las series, buena técnica y {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva. Nada cambia sin tu aprobación.
      </Notice>

      <ul className="flex flex-col gap-3">
        {s.exercises.map((log) => {
          const ex = getExercise(log.exerciseId)!;
          const mode = modeOfLog(log, ex);
          if (log.status === 'skipped' || log.sets.length === 0)
            return (
              <li key={log.exerciseId} className="rounded-2xl border border-line bg-surface p-3">
                <p className="font-semibold">{exerciseName(log)}</p>
                <p className="text-sm text-muted">{log.status === 'skipped' ? 'Omitido' : 'Sin registrar'}</p>
              </li>
            );
          const ladder = ladderFor(ex, inventory);
          let sug: Suggestion | null = null;
          if (!log.substitute) sug = suggestProgression({ history: exerciseHistory(merged, ex.id), ex, ladder, unit: settings.unit });
          const hist = exerciseHistory([s], ex.id);
          const used = !log.substitute && hist.length ? topOption(hist[0]) : undefined;
          const planned = plannedOptionOf(log);
          const changed = used && !sameOption(used, planned) && sug?.kind !== 'stop_pain' && optionIndex(ladder, used) !== -1;
          const done = ex.id in decided;
          return (
            <li key={log.exerciseId} className="rounded-2xl border border-line bg-surface p-3">
              <p className="font-semibold">{exerciseName(log)}</p>
              <p className="tabular text-sm text-muted">
                {log.sets.length}/{log.plannedSets} series · {log.sets.map((x) => `${x.reps}${ex.timed && !log.substitute ? 's' : ''}${x.rir !== undefined && x.rir !== null ? ` (RIR ${rirLabel(x.rir)})` : ''}`).join(' · ')}
              </p>
              {used && mode !== 'body' ? <p className="text-sm text-muted">{formatOption(used, mode, settings.unit)}</p> : null}
              {sug ? (
                <div className="mt-2">
                  <Notice tone={sug.kind === 'stop_pain' ? 'danger' : sug.kind === 'increase' ? 'success' : sug.kind === 'decrease' ? 'warn' : 'info'}>{sug.message}</Notice>
                  {(sug.kind === 'increase' || sug.kind === 'decrease') && !done ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => approve(ex, sug.to, sug.kind === 'increase' ? 'Criterio RIR cumplido dos sesiones' : 'Sin reserva y por debajo del mínimo')}>
                        Aprobar {formatOptionShort(sug.to, ex.mode, settings.unit)}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setDecided((a) => ({ ...a, [ex.id]: null }))}>
                        {sug.kind === 'increase' ? 'Seguir con reps/tempo' : 'Mantener'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {changed && !done ? (
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => approve(ex, used!, 'Carga usada por la persona')}>
                  Usar {formatOptionShort(used!, ex.mode, settings.unit)} como próxima propuesta
                </Button>
              ) : null}
              {done && decided[ex.id] ? <p className="mt-2 text-sm font-semibold text-sage-strong">✓ Próxima propuesta: {formatOptionShort(decided[ex.id]!, ex.mode, settings.unit)}</p> : null}
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
