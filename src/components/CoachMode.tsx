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
import { RestCard } from './RestCard';
import { IconArrowLeft, IconArrowRight, IconCheck, IconDumbbell, IconExpand, IconInfo, IconMic, IconMore, IconPlay, IconVolume, IconVolumeOff } from './icons';
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
  const [showMenu, setShowMenu] = useState(false);
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

  const doneCount = s.exercises.filter((e) => e.status !== 'pending').length;
  const videoUrl = !log.substitute ? settings.videoLinks[ex.id] : undefined;
  const directVideo = videoUrl && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(videoUrl);
  const fullscreenOk = typeof document !== 'undefined' && document.fullscreenEnabled;
  const headerBtn = 'grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-primary-soft';
  const workLike = s.phase === 'work' || s.phase === 'rest';

  return (
    <div ref={scroller} className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg lg:left-64">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-bg/95 px-4 pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <button type="button" onClick={() => setConfirmExit(true)} className="flex min-h-11 items-center gap-2 rounded-full pr-3 font-display font-semibold hover:bg-primary-soft" aria-label="Salir del modo coach">
            <IconArrowLeft /> Entrenamiento
          </button>
          {s.phase !== 'summary' ? (
            <div className="flex items-center">
              <button
                type="button"
                className={headerBtn}
                onClick={() => {
                  unlockAudio();
                  setMuted((m) => !m);
                  stopSpeaking();
                }}
                aria-pressed={muted}
                aria-label={muted ? 'Activar sonido y voz' : 'Silenciar sonido y voz'}
              >
                {muted ? <IconVolumeOff /> : <IconVolume />}
              </button>
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
                className={`${headerBtn} ${settings.voiceCommands ? (listenState === 'listening' ? '!bg-primary !text-on-primary' : '!bg-warn-soft') : ''}`}
              >
                <IconMic />
              </button>
              {fullscreenOk ? (
                <button
                  type="button"
                  className={headerBtn}
                  aria-label="Pantalla completa"
                  onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
                >
                  <IconExpand />
                </button>
              ) : null}
              <button type="button" className={headerBtn} onClick={() => setShowMenu(true)} aria-label="Más opciones">
                <IconMore />
              </button>
            </div>
          ) : null}
        </div>
        {settings.voiceCommands && s.phase !== 'summary' ? (
          <p className="mx-auto max-w-5xl text-xs text-muted" aria-live="polite">
            {listenState === 'listening'
              ? '🎙 Escuchando: “listo”, “pausa”, “siguiente”, “saltar”, “más tiempo”…'
              : listenState === 'denied'
                ? 'Micrófono bloqueado: actívalo en los ajustes del navegador.'
                : listenState === 'unsupported'
                  ? 'Este navegador no admite comandos de voz.'
                  : 'Activando micrófono…'}
          </p>
        ) : null}
      </header>

      <main className="safe-bottom mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{DAY_LABELS[s.dayKey]}</h1>
            <p className="text-sm text-muted">
              Semana {s.week} · ~{35 + s.exercises[0].plannedSets * 5} min · {prog.done}/{prog.total} series
            </p>
          </div>
          <div className="w-44">
            <p className="mb-1 text-right text-sm font-medium">
              {Math.min(s.exerciseIndex + 1, s.exercises.length)} de {s.exercises.length} ejercicios
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-label="Progreso de la sesión" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

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

        {workLike ? (
          <>
            <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
              {/* Visual */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3edff] to-[#d8c8fb] shadow-card dark:from-[#2a1d44] dark:to-[#3b2a63]">
                {directVideo ? (
                  <video src={videoUrl} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" aria-label={`Video de ${ex.nameEs}`} />
                ) : (
                  <>
                    {!log.substitute ? <ExerciseIllustration pattern={guide.pattern} label={ex.nameEs} className="h-full w-full !bg-transparent" /> : <div className="grid h-full place-items-center p-6 text-center font-display text-lg font-semibold text-primary">{name}</div>}
                    <button
                      type="button"
                      onClick={() => (videoUrl ? window.open(videoUrl, '_blank', 'noopener') : setShowGuide(true))}
                      className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
                      aria-label={videoUrl ? 'Abrir tu video de referencia' : 'Ver técnica y añadir tu video'}
                    >
                      <IconPlay size={28} />
                    </button>
                  </>
                )}
              </div>

              {/* Detalle del ejercicio */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
                    <p className="text-sm text-muted">{log.substitute ? `Sustituye a: ${ex.nameEs}` : ex.name}</p>
                  </div>
                  <button type="button" onClick={() => setShowGuide(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-primary-soft" aria-label="Ver guía de técnica">
                    <IconInfo />
                  </button>
                </div>
                {!log.substitute ? <span className="w-fit rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{guide.muscles.split(',').slice(0, 2).join(' · ')}</span> : null}
                <p className="text-lg">
                  <strong className="font-display">{log.plannedSets}</strong> series × {ex.timed ? ex.reps : `${ex.reps} rep`}
                </p>
                <p className="flex w-fit items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
                  <IconDumbbell size={18} />
                  {formatOption(log.substitute ? { kind: 'body', lb: 0 } : plannedOptionOf(log), mode, settings.unit)}
                </p>
                <p className="text-xs text-muted">
                  Propuesta condicionada a tu técnica y a terminar con {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva.
                </p>
                {!log.substitute && guide ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                    {guide.cues.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="flex flex-col gap-4">
                <SetsTable log={log} ex={ex} mode={mode} unit={settings.unit} />
                {log.status === 'skipped' ? <Notice>Este ejercicio está omitido. Puedes registrar una serie igualmente o pasar al siguiente.</Notice> : null}
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
              </div>
              <div className="flex flex-col gap-3">
                <RestCard
                  timer={s.phase === 'rest' && s.rest ? s.rest : null}
                  defaultSec={restDurationFor(ex)}
                  now={now}
                  onStart={(sec) => {
                    unlockAudio();
                    commit({ ...sRef.current, phase: 'rest', rest: start(createTimer(sec), Date.now()) });
                  }}
                  onPause={() => setRest((r) => pause(r, Date.now()))}
                  onResume={() => {
                    unlockAudio();
                    setRest((r) => resume(r, Date.now()));
                  }}
                  onRestart={() => setRest((r) => start(createTimer(r.durationMs / 1000), Date.now()))}
                  onAdd={(sec) => (sRef.current.rest ? setRest((r) => addTime(r, sec, Date.now())) : undefined)}
                  onSetDuration={(sec) => {
                    unlockAudio();
                    commit({ ...sRef.current, phase: 'rest', rest: start(createTimer(sec), Date.now()) });
                  }}
                  onSkip={() => {
                    unlockAudio();
                    finishRest();
                  }}
                />
                <Button variant="ghost" onClick={() => goToSummary(sRef.current)}>
                  Terminar sesión
                </Button>
              </div>
            </div>

            <nav className="flex items-center justify-between gap-3 border-t border-line pt-4" aria-label="Cambiar de ejercicio">
              <Button variant="secondary" onClick={() => move(-1)} disabled={s.exerciseIndex === 0}>
                <IconArrowLeft size={18} /> Anterior
              </Button>
              <ol className="flex items-center gap-2" aria-label={`${doneCount} de ${s.exercises.length} ejercicios terminados`}>
                {s.exercises.map((e, i) => (
                  <li key={e.exerciseId}>
                    <button
                      type="button"
                      onClick={() => move(i - sRef.current.exerciseIndex)}
                      className={`block h-2.5 rounded-full transition-all ${i === s.exerciseIndex ? 'w-6 bg-primary' : e.status === 'done' ? 'w-2.5 bg-success' : e.status === 'skipped' ? 'w-2.5 bg-muted/40' : 'w-2.5 bg-primary-soft'}`}
                      aria-label={`Ir a ${exerciseName(e)}${e.status === 'done' ? ' (hecho)' : ''}`}
                      aria-current={i === s.exerciseIndex ? 'step' : undefined}
                    />
                  </li>
                ))}
              </ol>
              <Button onClick={() => move(1)} disabled={s.exerciseIndex === s.exercises.length - 1}>
                Siguiente <IconArrowRight size={18} />
              </Button>
            </nav>
          </>
        ) : null}

        {s.phase === 'summary' ? <Summary session={s} commit={commit} settings={settings} inventory={inventory} /> : null}

        {settings.wakeLock && active && s.phase !== 'summary' ? (
          <p className="text-center text-xs text-muted">
            {wake.supported
              ? wake.locked
                ? 'Pantalla mantenida encendida durante el entreno.'
                : 'El sistema no permitió mantener la pantalla encendida: revisa el bloqueo automático o el modo de bajo consumo.'
              : 'Este navegador no permite mantener la pantalla encendida: ajusta el bloqueo automático del dispositivo.'}
          </p>
        ) : null}
      </main>

      <Modal open={showMenu} onClose={() => setShowMenu(false)} title="Opciones">
        <div className="grid gap-2">
          <Button variant="secondary" onClick={() => { setShowMenu(false); setPaused(true); }}>⏸ Pausar sesión</Button>
          <Button variant="secondary" onClick={() => { setShowMenu(false); setShowSubstitute(true); }}>⇄ Sustituir ejercicio</Button>
          <Button variant="secondary" onClick={() => { setShowMenu(false); skipExercise(); }}>⤼ Omitir ejercicio</Button>
          <Button variant="secondary" onClick={() => { setShowMenu(false); setShowGuide(true); }}>Ver guía de técnica y video</Button>
          <Button variant="secondary" onClick={() => { setShowMenu(false); setShowVoiceHelp(true); }}>🎙 Comandos de voz</Button>
          <Button variant="danger" onClick={() => { setShowMenu(false); goToSummary(sRef.current); }}>Terminar sesión</Button>
        </div>
      </Modal>

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
              <button type="button" onClick={() => substitute(a)} className={`w-full rounded-2xl border p-3 text-left hover:bg-surface-2 ${log.substitute?.id === a.id ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}>
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

// ---------- Tabla de series ----------

function SetsTable({ log, ex, mode, unit }: { log: ExerciseLog; ex: Exercise; mode: Mode; unit: Settings['unit'] }) {
  const rows = Math.max(log.plannedSets, log.sets.length + (log.status === 'pending' ? 1 : 0));
  const planned = log.substitute ? ({ kind: 'body', lb: 0 } as LoadOption) : plannedOptionOf(log);
  const timedMain = ex.timed && !log.substitute;
  return (
    <table className="w-full border-separate border-spacing-y-2 text-sm">
      <caption className="sr-only">Series de {exerciseName(log)}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Estado</th>
          <th scope="col">Serie</th>
          <th scope="col">{timedMain ? 'Segundos' : 'Repeticiones'}</th>
          <th scope="col">Carga</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => {
          const st = log.sets[i];
          const current = !st && i === log.sets.length;
          const cell = `py-3 ${current ? 'border-y-2 border-primary bg-primary-soft/40' : 'border-y border-line bg-surface'}`;
          return (
            <tr key={i} aria-current={current ? 'step' : undefined}>
              <td className={`${cell} rounded-l-xl pl-3 ${current ? 'border-l-2' : 'border-l'}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-md ${st ? (st.pain ? 'bg-danger text-white' : 'bg-success text-white') : 'border-2 border-line'}`}>
                  {st ? <IconCheck size={14} /> : null}
                </span>
              </td>
              <th scope="row" className={`${cell} text-left font-display font-semibold`}>
                Serie {i + 1}
              </th>
              <td className={`${cell} tabular`}>
                {st ? `${st.reps} ${timedMain ? 's' : 'rep'}` : current ? (timedMain ? ex.reps : `${ex.reps} rep`) : '–'}
                {st && st.rir !== undefined && st.rir !== null ? <span className="ml-1 text-xs text-muted">RIR {rirLabel(st.rir)}</span> : null}
              </td>
              <td className={`${cell} tabular rounded-r-xl pr-3 text-right ${current ? 'border-r-2' : 'border-r'}`}>
                {formatOptionShort(st ? setOption(st) : planned, st?.mode ?? mode, unit)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
            {sameOption(option, planned) && !log.substitute ? <p className="text-center text-xs font-semibold text-primary-600">= propuesta de hoy</p> : null}
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
                className={`px-0 ${r >= RIR_TARGET.min && r <= RIR_TARGET.max && rir !== r ? 'border-primary' : ''}`}
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
          <li key={st.name} className={`flex justify-between rounded-2xl px-4 py-3 ${timer.status !== 'idle' && i === currentStep ? 'bg-primary text-on-primary' : 'bg-surface-2'}`} aria-current={timer.status !== 'idle' && i === currentStep ? 'step' : undefined}>
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
          <div key={l} className="rounded-2xl bg-primary-soft p-3">
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
              {done && decided[ex.id] ? <p className="mt-2 text-sm font-semibold text-primary-600">✓ Próxima propuesta: {formatOptionShort(decided[ex.id]!, ex.mode, settings.unit)}</p> : null}
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
