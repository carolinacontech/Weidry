/**
 * Pantalla "Entrenar" (Coach Mode) con el diseño del prototipo Weidry.
 * - Si hay una sesión en curso, la muestra y la retoma donde se dejó.
 * - Si no, prepara un borrador del día elegido: se guarda en cuanto registras la primera serie.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { GUIDE, WARMUP_STEPS, type Alternative } from '../data/guide';
import { DAY_LABELS, PLAN_DAYS, PROGRAM_WEEKS, RIR_TARGET, WARMUP_MINUTES, getExercise, type Exercise, type Mode, type StrengthDay } from '../data/plan';
import { useAdjustments, useInventory, useSessions, useSettings } from '../hooks/useData';
import { useNow } from '../hooks/useNow';
import { navigate } from '../hooks/useRoute';
import { useWakeLock } from '../hooks/useWakeLock';
import { db, saveSession, updateSettings } from '../lib/db';
import { today } from '../lib/dates';
import { beep, doneChime, isAppSpeaking, speak, stopSpeaking, unlockAudio, vibrate } from '../lib/platform';
import { isStrengthDay, programDayFor } from '../lib/program';
import { RIR_OPTIONS, rirLabel, suggestProgression, type Suggestion } from '../lib/progression';
import { createSession, exerciseName, nextPendingIndex, sessionProgress } from '../lib/session';
import { exerciseHistory, topOption } from '../lib/stats';
import { addTime, createTimer, cuesBetween, formatClock, pause, progress, remainingMs, resume, start, tick, type Cue, type TimerState } from '../lib/timer';
import { plannedOptionOf, setOption, type ExerciseLog, type SetLog, type Settings, type Tempo, type WorkoutSession } from '../lib/types';
import { COMMAND_HELP, createListener, speechRecognitionSupported, type ListenerState, type VoiceCommand } from '../lib/voiceCommands';
import { compareOptions, formatOption, formatOptionShort, ladderFor, nearestAtOrBelow, optionIndex, sameOption, type InventoryItem, type LoadOption } from '../lib/weights';
import { ExerciseIllustration } from './ExerciseIllustration';
import { GuideContent } from './GuideView';
import { IconExpand, IconMic, IconMore, IconPlay, IconVolume, IconVolumeOff } from './icons';
import { discardSession, useActiveSession } from './StartWorkout';
import { Button, Loading, Modal, Notice, ProgressRing, inputClass, useToast } from './ui';

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

const MODE_TAG: Record<Mode, string> = {
  held: 'Una mancuerna · peso total',
  each: 'Por mano',
  one: 'Una mancuerna · una mano',
  body: 'Peso corporal',
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

/** Día de fuerza de hoy o el siguiente de la semana tipo (L A, M B, J C, V D). */
function defaultDay(): StrengthDay {
  const map: StrengthDay[] = ['A', 'B', 'C', 'C', 'D', 'A', 'A'];
  return map[programDayFor(today()).dow];
}

export function TrainView() {
  const active = useActiveSession();
  const settings = useSettings();
  const inventory = useInventory();
  const sessions = useSessions();
  const adjustments = useAdjustments();
  const [dayKey, setDayKey] = useState<StrengthDay>(defaultDay);

  if (active === undefined || !settings || !inventory || !sessions || !adjustments) return <Loading label="Preparando tu entrenamiento…" />;

  const pd = programDayFor(today());
  const week = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);

  if (active) return <Coach key={active.id} initial={active} draft={false} settings={settings} inventory={inventory} onPickDay={(k) => setDayKey(k)} />;

  const draft = createSession({ date: today(), week, dayKey, inventory, adjustments, sessions, unit: settings.unit, skipWarmup: true });
  return <Coach key={`draft-${dayKey}-${week}`} initial={draft} draft settings={settings} inventory={inventory} onPickDay={(k) => setDayKey(k)} />;
}

function Coach({
  initial,
  draft: initialDraft,
  settings,
  inventory,
  onPickDay,
}: {
  initial: WorkoutSession;
  draft: boolean;
  settings: Settings;
  inventory: InventoryItem[];
  onPickDay: (k: StrengthDay) => void;
}) {
  const toast = useToast();
  const [s, setS] = useState<WorkoutSession>(initial);
  const [draft, setDraft] = useState(initialDraft);
  const [muted, setMuted] = useState(!settings.sound && !settings.voice);
  const [showGuide, setShowGuide] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [switchTo, setSwitchTo] = useState<StrengthDay | null>(null);
  const active = s.status === 'in_progress';
  const wake = useWakeLock(settings.wakeLock && active && !draft && !s.paused);

  const sRef = useRef(s);
  sRef.current = s;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /** Guarda cada cambio al instante. Un borrador solo se guarda cuando ya tiene series registradas. */
  const commit = (next: WorkoutSession) => {
    sRef.current = next;
    setS(next);
    const hasData = next.exercises.some((e) => e.sets.length > 0);
    if (!draftRef.current || hasData) {
      if (draftRef.current) {
        draftRef.current = false;
        setDraft(false);
      }
      void saveSession(next);
    }
  };

  const log = s.exercises[s.exerciseIndex];
  const ex = getExercise(log.exerciseId)!;
  const guide = GUIDE[ex.id];
  const name = exerciseName(log);
  const mode = modeOfLog(log, ex);
  const prog = sessionProgress(s);
  const day = PLAN_DAYS[s.dayKey];

  const soundOn = settings.sound && !muted;
  const voiceOn = settings.voice && !muted;

  // ---------- Descanso ----------
  const restRunning = s.phase === 'rest' && s.rest?.status === 'running' && !s.paused;
  const now = useNow(restRunning || s.phase === 'work');
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

  // Al reanudar una sesión interrumpida, si el descanso ya terminó, pasar a la serie.
  useEffect(() => {
    if (s.phase === 'rest' && s.rest && s.rest.status === 'running' && remainingMs(s.rest, Date.now()) === 0) finishRest();
    if (s.phase === 'warmup') commit({ ...sRef.current, phase: 'work' });
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

  // Indicación por voz al empezar cada serie (no en el borrador inicial, para no hablar al abrir la pantalla).
  const announceKey = s.phase === 'work' && !draft ? `${s.exerciseIndex}-${log.sets.length}-${log.substitute?.id ?? ''}` : '';
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
    let next: WorkoutSession = { ...cur, exercises, startedAt: draftRef.current ? new Date().toISOString() : cur.startedAt };
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
    commit({ ...cur, exercises, exerciseIndex: idx, phase: cur.phase === 'rest' ? 'rest' : 'work' });
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

  function startRest(sec: number) {
    unlockAudio();
    commit({ ...sRef.current, phase: 'rest', rest: start(createTimer(sec), Date.now()) });
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
      if (c === 'skipRest') return finishRest();
      if (c === 'addTime') return setRest((r) => addTime(r, 15, Date.now()));
    }
    if (c === 'complete') return submitRef.current?.();
    if (c === 'next') return move(1);
    if (c === 'previous') return move(-1);
  };
  useEffect(() => {
    if (!voiceCmdOn) return;
    const l = createListener({ onCommand: (c, h) => handleCommand.current(c, h), onState: setListenState, isAppSpeaking });
    l.start();
    return () => l.stop();
  }, [voiceCmdOn]);

  // ---------- Render ----------
  const videoUrl = !log.substitute ? settings.videoLinks[ex.id] : undefined;
  const directVideo = !!videoUrl && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(videoUrl);
  const fullscreenOk = typeof document !== 'undefined' && document.fullscreenEnabled;
  const completedSets = Math.min(log.sets.length, log.plannedSets);
  const isLast = s.exerciseIndex === s.exercises.length - 1;
  const stateText = draft
    ? 'Listo para empezar'
    : log.status === 'skipped'
      ? 'Omitido'
      : log.status === 'done'
        ? 'Ejercicio completo'
        : s.phase === 'rest'
          ? 'Descansando'
          : 'A tu ritmo';
  const restTimer = s.phase === 'rest' && s.rest ? s.rest : null;
  const restRem = restTimer ? remainingMs(restTimer, now) : restDurationFor(ex) * 1000;
  const restDurSec = restTimer ? Math.round(restTimer.durationMs / 1000) : restDurationFor(ex);

  const pickerChange = (k: StrengthDay) => {
    if (k === s.dayKey) return;
    if (draft) onPickDay(k);
    else setSwitchTo(k);
  };

  return (
    <>
      <div className="workout-page-heading">
        <div>
          <span className="eyebrow">
            Coach mode · Semana {s.week}
          </span>
          <h2>{day.title}</h2>
          <p className="muted">
            {s.exercises.length} ejercicios · {draft ? 'Tu siguiente serie' : `${prog.done}/${prog.total} series registradas`}
          </p>
        </div>
        <div className="heading-tools">
          <select className="proto-select" aria-label="Selecciona entrenamiento" value={s.dayKey} onChange={(e) => pickerChange(e.target.value as StrengthDay)}>
            {(['A', 'B', 'C', 'D'] as const).map((k) => (
              <option key={k} value={k}>
                {PLAN_DAYS[k].weekday} · Fuerza {k}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`icon-btn${muted ? '' : ' on'}`}
            aria-pressed={!muted}
            aria-label={muted ? 'Activar sonido y voz' : 'Silenciar sonido y voz'}
            onClick={() => {
              unlockAudio();
              setMuted((m) => !m);
              stopSpeaking();
            }}
          >
            {muted ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
          </button>
          <button
            type="button"
            className={`icon-btn${settings.voiceCommands ? ' on' : ''}`}
            aria-pressed={settings.voiceCommands}
            aria-label={settings.voiceCommands ? 'Desactivar comandos de voz' : 'Activar comandos de voz'}
            onClick={() => {
              unlockAudio();
              if (!speechRecognitionSupported()) return setShowVoiceHelp(true);
              void updateSettings({ voiceCommands: !settings.voiceCommands });
              if (!settings.voiceCommands) setShowVoiceHelp(true);
            }}
          >
            <IconMic size={18} />
          </button>
          {fullscreenOk ? (
            <button
              type="button"
              className="icon-btn"
              aria-label="Pantalla completa"
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
            >
              <IconExpand size={18} />
            </button>
          ) : null}
          <button type="button" className="icon-btn" aria-label="Más opciones" onClick={() => setShowMenu(true)}>
            <IconMore size={18} />
          </button>
        </div>
      </div>
      {settings.voiceCommands && active && s.phase !== 'summary' ? (
        <p className="muted" style={{ fontSize: 12, margin: '-8px 0 14px' }} aria-live="polite">
          {listenState === 'listening'
            ? '🎙 Escuchando: “listo”, “pausa”, “siguiente”, “saltar”, “más tiempo”…'
            : listenState === 'denied'
              ? 'Micrófono bloqueado: actívalo en los ajustes del navegador.'
              : listenState === 'unsupported'
                ? 'Este navegador no admite comandos de voz.'
                : 'Activando micrófono…'}
        </p>
      ) : null}

      {s.phase === 'summary' ? (
        <article className="panel">
          <Summary session={s} commit={commit} settings={settings} inventory={inventory} />
        </article>
      ) : (
        <div className="coach-grid">
          <article className="panel exercise-panel">
            <div className="exercise-top">
              <span className="tiny-label purple">
                EJERCICIO {s.exerciseIndex + 1} DE {s.exercises.length}
              </span>
              <span className="session-state">{stateText}</span>
            </div>
            <div className="exercise-stage">
              <div className="exercise-visual">
                {directVideo ? (
                  <video src={videoUrl} controls playsInline preload="metadata" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }} aria-label={`Video de ${ex.nameEs}`} />
                ) : !log.substitute ? (
                  <ExerciseIllustration pattern={guide.pattern} label={ex.nameEs} className="!bg-transparent" />
                ) : (
                  <span className="big-glyph" aria-hidden style={{ fontSize: 120, color: '#ffffff60', transform: 'rotate(-20deg)' }}>
                    ✦
                  </span>
                )}
                {!directVideo ? (
                  <button type="button" className="play-btn" onClick={() => (videoUrl ? window.open(videoUrl, '_blank', 'noopener') : setShowGuide(true))} aria-label={videoUrl ? 'Abrir tu video de referencia' : 'Ver técnica y añadir tu video'}>
                    <IconPlay size={20} />
                  </button>
                ) : null}
                <span className="visual-tag">MUÉVETE CON CONFIANZA</span>
              </div>
              <div className="exercise-copy">
                <h3>{name}</h3>
                {log.substitute ? <p className="muted">Sustituye a: {ex.nameEs}</p> : <p className="muted">{ex.cue ?? guide.cues.join(' · ')}</p>}
                <div className="exercise-tags">
                  <span>{ex.timed ? ex.reps : `${ex.reps} repeticiones`}</span>
                  <span>{MODE_TAG[mode]}</span>
                  <span>
                    {completedSets}/{log.plannedSets} series
                  </span>
                </div>
                <div className="weight-control">
                  <span>Peso de referencia</span>
                  <strong>{formatOptionShort(log.substitute ? { kind: 'body', lb: 0 } : plannedOptionOf(log), mode, settings.unit)}</strong>
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Propuesta condicionada a tu técnica y a terminar con {RIR_TARGET.min}–{RIR_TARGET.max} repeticiones en reserva.
                </p>
              </div>
            </div>

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
            <div className="series-wrap">
              <div className="series-head">
                <h4>Mis series</h4>
                <span className="tiny-label">
                  {completedSets} / {log.plannedSets} completadas
                </span>
              </div>
              <div>
                {Array.from({ length: Math.max(log.plannedSets, log.sets.length) }, (_, i) => {
                  const st = log.sets[i];
                  const current = !st && i === log.sets.length && log.status === 'pending';
                  const opt = st ? setOption(st) : log.substitute ? ({ kind: 'body', lb: 0 } as LoadOption) : plannedOptionOf(log);
                  return (
                    <div key={i} className={`set-row${st ? (st.pain ? ' pain' : ' done') : ''}${current ? ' current' : ''}`} aria-current={current ? 'step' : undefined}>
                      <span>
                        <span className="set-check" aria-hidden>
                          {st ? '✓' : ''}
                        </span>
                        Serie {i + 1}
                        {st ? <span className="sr-only">, completada</span> : null}
                      </span>
                      <small>
                        {st ? `${st.reps} ${ex.timed && !log.substitute ? 's' : 'rep'}` : ex.reps} · {formatOptionShort(opt, st?.mode ?? mode, settings.unit)}
                        {st && st.rir !== undefined && st.rir !== null ? ` · RIR ${rirLabel(st.rir)}` : ''}
                        {st?.pain ? ' · dolor' : ''}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="coach-controls">
              <button type="button" className="btn btn-light" onClick={() => move(-1)} disabled={s.exerciseIndex === 0}>
                ← Anterior
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submitRef.current?.()}>
                ✓ Completar serie
              </button>
              {isLast ? (
                <button type="button" className="btn btn-outline" onClick={() => goToSummary(sRef.current)} disabled={draft}>
                  Terminar sesión ✓
                </button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={() => move(1)}>
                  Siguiente →
                </button>
              )}
            </div>
          </article>

          <aside className="coach-side">
            <article className="panel rest-panel" aria-labelledby="rest-eyebrow">
              <span className="eyebrow" id="rest-eyebrow">
                Tu descanso
              </span>
              <div className="timer-display" aria-hidden>
                {formatClock(restRem)}
              </div>
              <div className="timer-bar" role="progressbar" aria-label="Descanso restante" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((restTimer ? 1 - progress(restTimer, now) : 1) * 100)}>
                <div style={{ width: `${(restTimer ? 1 - progress(restTimer, now) : 1) * 100}%` }} />
              </div>
              <p className="muted" aria-live="polite">
                {restTimer ? (restTimer.status === 'running' ? (restRem <= 10_000 ? `Quedan ${Math.ceil(restRem / 1000)} segundos` : 'Respira y recupera') : 'Descanso en pausa') : 'Listo para descansar entre series'}
              </p>
              <div className="timer-actions">
                {!restTimer ? (
                  <button type="button" className="btn btn-primary" onClick={() => startRest(restDurSec)}>
                    Iniciar descanso
                  </button>
                ) : restTimer.status === 'running' ? (
                  <button type="button" className="btn btn-primary" onClick={() => setRest((r) => pause(r, Date.now()))}>
                    Pausar descanso
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      unlockAudio();
                      setRest((r) => resume(r, Date.now()));
                    }}
                  >
                    Reanudar descanso
                  </button>
                )}
                <div className="row">
                  <button type="button" className="btn btn-light" onClick={() => (restTimer ? setRest((r) => addTime(r, -15, Date.now())) : undefined)} disabled={!restTimer} aria-label="Restar 15 segundos">
                    −15 s
                  </button>
                  <button type="button" className="btn btn-light" onClick={() => (restTimer ? setRest((r) => addTime(r, 15, Date.now())) : undefined)} disabled={!restTimer} aria-label="Sumar 15 segundos">
                    +15 s
                  </button>
                </div>
                <button type="button" className="btn btn-light" onClick={() => startRest(restDurSec)}>
                  Reiniciar
                </button>
                {restTimer ? (
                  <button type="button" className="link-btn" onClick={finishRest}>
                    Saltar descanso →
                  </button>
                ) : null}
              </div>
              <label className="timer-select">
                Duración
                <select className="proto-select" value={restDurSec} onChange={(e) => startRest(Number(e.target.value))}>
                  {[45, 60, 90, 120].map((v) => (
                    <option key={v} value={v}>
                      {v} s
                    </option>
                  ))}
                </select>
              </label>
            </article>

            <article className="tip-card">
              <span className="eyebrow">Consejo de tu coach</span>
              <h4>La técnica va primero.</h4>
              <p>
                {guide.caution ??
                  'Si 10 lb es demasiado para un ejercicio, usa una alternativa ligera o trabaja sin peso. Las cargas del plan son sugerencias, no obligaciones.'}
              </p>
              <button type="button" className="link-btn" onClick={() => setShowGuide(true)}>
                Ver guía de técnica →
              </button>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h3>Calentamiento</h3>
                <span className="tiny-label purple">{WARMUP_MINUTES} min</span>
              </div>
              <p className="muted" style={{ fontSize: 12, margin: '10px 0 12px' }}>
                Movilidad suave antes de la primera serie.
              </p>
              <button type="button" className="btn btn-light btn-block" onClick={() => setShowWarmup(true)}>
                Iniciar calentamiento guiado
              </button>
            </article>

            {settings.wakeLock && !draft && active ? (
              <p className="muted" style={{ fontSize: 11, textAlign: 'center', margin: 0 }}>
                {wake.supported
                  ? wake.locked
                    ? 'Pantalla mantenida encendida durante el entreno.'
                    : 'El sistema no permitió mantener la pantalla encendida: revisa el bloqueo automático.'
                  : 'Este navegador no permite mantener la pantalla encendida: ajusta el bloqueo automático.'}
              </p>
            ) : null}
          </aside>
        </div>
      )}

      {s.paused ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg/95 p-6 text-center backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <h2 id="paused-title" className="font-display text-4xl font-bold">
            En pausa
          </h2>
          <p className="max-w-xs text-muted">Tu progreso está guardado. Puedes salir y continuar más tarde desde Inicio.{settings.voiceCommands ? ' Di “seguir” para continuar.' : ''}</p>
          <button type="button" className="btn btn-primary" style={{ minWidth: 240 }} onClick={() => setPaused(false)}>
            ▶ Reanudar
          </button>
          <button type="button" className="btn btn-outline" style={{ minWidth: 240 }} onClick={() => navigate('/')}>
            Guardar y salir
          </button>
        </div>
      ) : null}

      <Modal open={showMenu} onClose={() => setShowMenu(false)} title="Opciones">
        <div className="grid gap-2">
          <button type="button" className="btn btn-light" disabled={draft} onClick={() => { setShowMenu(false); setPaused(true); }}>⏸ Pausar sesión</button>
          <button type="button" className="btn btn-light" onClick={() => { setShowMenu(false); setShowSubstitute(true); }}>⇄ Sustituir ejercicio</button>
          <button type="button" className="btn btn-light" onClick={() => { setShowMenu(false); skipExercise(); }}>⤼ Omitir ejercicio</button>
          <button type="button" className="btn btn-light" onClick={() => { setShowMenu(false); setShowGuide(true); }}>Ver guía de técnica y video</button>
          <button type="button" className="btn btn-light" onClick={() => { setShowMenu(false); setShowVoiceHelp(true); }}>🎙 Comandos de voz</button>
          <button type="button" className="btn btn-danger" disabled={draft} onClick={() => { setShowMenu(false); goToSummary(sRef.current); }}>Terminar sesión</button>
        </div>
      </Modal>

      <Modal open={showWarmup} onClose={() => setShowWarmup(false)} title="Calentamiento guiado">
        <WarmupBox soundOn={soundOn} voiceOn={voiceOn} onDone={() => setShowWarmup(false)} />
      </Modal>

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
          <button type="button" className="btn btn-light btn-block mt-3" onClick={() => substitute(null)}>
            Volver a {ex.nameEs}
          </button>
        ) : null}
      </Modal>

      <Modal
        open={painOpen}
        onClose={() => setPainOpen(false)}
        title="Detén el ejercicio"
        footer={
          <div className="grid gap-2">
            <button type="button" className="btn btn-primary" onClick={() => { setPainOpen(false); skipExercise(); }}>Omitir este ejercicio</button>
            <button type="button" className="btn btn-light" onClick={() => { setPainOpen(false); setShowSubstitute(true); }}>Elegir una alternativa</button>
            <button type="button" className="btn btn-danger" onClick={() => { setPainOpen(false); goToSummary(sRef.current); }}>Terminar la sesión</button>
          </div>
        }
      >
        <Notice tone="danger" title="Registraste dolor o molestia">
          Para aquí. No continúes con este ejercicio ni subas carga. Si el dolor es agudo, punzante, no desaparece al parar o aparece con mareo, falta de aire o dolor en el pecho, busca atención profesional.
        </Notice>
      </Modal>

      <Modal
        open={switchTo !== null}
        onClose={() => setSwitchTo(null)}
        title={`Tienes ${DAY_LABELS[s.dayKey]} en curso`}
        footer={
          <div className="grid gap-2">
            <button type="button" className="btn btn-primary" onClick={() => { setSwitchTo(null); goToSummary(sRef.current); }}>
              Terminar la actual y ver el resumen
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                const k = switchTo!;
                setSwitchTo(null);
                await discardSession(s.id);
                onPickDay(k);
              }}
            >
              Cerrarla y pasar a Fuerza {switchTo}
            </button>
            <button type="button" className="btn btn-light" onClick={() => setSwitchTo(null)}>
              Seguir con la actual
            </button>
          </div>
        }
      >
        <p>Las series ya registradas se conservan en el historial aunque cierres la sesión.</p>
      </Modal>
    </>
  );
}

// ---------- Registro de la serie actual ----------

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
  // Se permite cualquier opción real: peso corporal, alternativas ligeras y mancuernas fijas del inventario.
  const ladder = useMemo(() => ladderFor({ mode, allowBody: true, allowLight: true }, inventory), [mode, inventory]);
  const initialOpt: LoadOption = last ? setOption(last) : log.substitute ? { kind: 'body', lb: 0 } : plannedOptionOf(log);
  const [option, setOptionState] = useState<LoadOption>(() => nearestAtOrBelow(ladder, initialOpt) ?? { kind: 'body', lb: 0 });
  const [reps, setReps] = useState(last?.reps ?? ex.repsMax);
  const [rir, setRir] = useState<number | null>(null);
  const [tempo, setTempo] = useState<Tempo>(last?.tempo ?? 'normal');
  const [pain, setPain] = useState(false);
  const [techniqueOk, setTechniqueOk] = useState(true);
  const timedMain = ex.timed && !log.substitute;

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
  const switchRow = (label: string, hint: string, value: boolean, set: (v: boolean) => void) => (
    <div className="toggle-row">
      <span>
        {label}
        <small>{hint}</small>
      </span>
      <button type="button" role="switch" aria-checked={value} aria-label={label} className="switch" onClick={() => set(!value)} />
    </div>
  );

  return (
    <section className="logger" aria-label="Registrar la serie actual">
      <h4 className="logger-title">Registrar serie {log.sets.length + 1}</h4>
      <div className="logger-grid">
      <div>
      {baseMode !== 'body' ? (
        <>
          <span className="weight-input-label">Cómo sujetas la carga</span>
          <div className="chip-row">
            {(['held', 'each', 'one'] as const).map((m) => (
              <button key={m} type="button" className={`chip${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <span className="weight-input-label" id="load-lbl">
            {mode === 'each' ? 'Peso que estás usando (por mano)' : mode === 'one' ? 'Peso que estás usando (en una mano)' : 'Peso que estás usando (total)'}
          </span>
          <div className="input-row" role="group" aria-labelledby="load-lbl">
            <button type="button" className="mini-control" onClick={() => stepLoad(-1)} aria-label="Reducir peso">
              −
            </button>
            <output aria-live="polite">{option.kind === 'body' ? 'Peso corporal' : option.kind === 'light' ? option.label ?? 'Ligera' : formatOptionShort(option, mode, settings.unit)}</output>
            <button type="button" className="mini-control" onClick={() => stepLoad(1)} aria-label="Aumentar peso">
              +
            </button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            {formatOption(option, mode, settings.unit)}
            {sameOption(option, planned) && !log.substitute ? ' · = propuesta' : ''}
          </p>
          {aboveProposal ? <p className="note-warn">Por encima de la propuesta: úsala solo si mantienes la técnica y {RIR_TARGET.min}–{RIR_TARGET.max} RIR.</p> : null}
        </>
      ) : null}

      {timedMain ? (
        <>
          <span className="weight-input-label">Cronómetro</span>
          <div className="input-row">
            <button
              type="button"
              className="btn btn-light"
              style={{ flex: 1 }}
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
              {hold?.status === 'running' ? '⏸ Parar' : hold?.status === 'paused' ? '▶ Continuar' : `⏱ Iniciar ${ex.repsMax} s`}
            </button>
            <output>{hold ? formatClock(remainingMs(hold, holdNow)) : formatClock(ex.repsMax * 1000)}</output>
          </div>
        </>
      ) : null}

      </div>
      <div>
      <span className="weight-input-label" id="reps-lbl">
        {timedMain ? 'Segundos logrados' : ex.perSide ? 'Repeticiones por lado' : 'Repeticiones'}
      </span>
      <div className="input-row" role="group" aria-labelledby="reps-lbl">
        <button type="button" className="mini-control" onClick={() => setReps((r) => Math.max(0, r - 1))} aria-label="Restar una repetición">
          −
        </button>
        <output aria-live="polite">{reps}</output>
        <button type="button" className="mini-control" onClick={() => setReps((r) => r + 1)} aria-label="Sumar una repetición">
          +
        </button>
      </div>

      {settings.askRir ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="weight-input-label">
            Repeticiones en reserva (RIR) · objetivo {RIR_TARGET.min}–{RIR_TARGET.max}
          </legend>
          <div className="rir-grid">
            {RIR_OPTIONS.map((r) => {
              const target = r >= RIR_TARGET.min && r <= RIR_TARGET.max;
              return (
                <button
                  key={r}
                  type="button"
                  className={`chip${rir === r ? ' on' : ''}${target ? ' target' : ''}`}
                  aria-pressed={rir === r}
                  aria-label={`${rirLabel(r)} repeticiones en reserva${target ? ' (objetivo)' : ''}`}
                  onClick={() => setRir(rir === r ? null : r)}
                >
                  {rirLabel(r)}
                </button>
              );
            })}
          </div>
          {rir !== null && rir <= 1 ? <p className="note-warn">Muy cerca del fallo: en la siguiente serie haz 1–2 repeticiones menos o baja la carga.</p> : null}
        </fieldset>
      ) : null}

      </div>
      </div>
      <div className="toggle-list">
        {switchRow('Tempo lento', '3 s al bajar y 1 s de pausa', tempo === 'lento', (v) => setTempo(v ? 'lento' : 'normal'))}
        {switchRow('Técnica adecuada', 'Movimiento controlado', techniqueOk, setTechniqueOk)}
        {switchRow('Sentí dolor o molestia', 'Te indicaremos parar', pain, setPain)}
      </div>
    </section>
  );
}

// ---------- Calentamiento ----------

function WarmupBox({ soundOn, voiceOn, onDone }: { soundOn: boolean; voiceOn: boolean; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const now = useNow(running, 250);
  return running ? <Warmup soundOn={soundOn} voiceOn={voiceOn} now={now} onDone={onDone} /> : (
    <div className="flex flex-col gap-3">
      <p className="text-muted">{WARMUP_STEPS.length} movimientos suaves durante {WARMUP_MINUTES} minutos, con aviso de cada cambio.</p>
      <button type="button" className="btn btn-primary" onClick={() => { unlockAudio(); setRunning(true); }}>
        Preparar calentamiento
      </button>
    </div>
  );
}

// ---------- Calentamiento (pasos) ----------

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
