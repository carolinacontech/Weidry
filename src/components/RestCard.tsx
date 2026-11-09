import { REST_OPTIONS } from '../data/plan';
import { formatClock, progress, remainingMs, type TimerState } from '../lib/timer';
import { IconPause, IconPlay, IconReset } from './icons';
import { ProgressRing } from './ui';

/**
 * Tarjeta de descanso (siempre visible en el modo coach).
 * Con descanso activo muestra la cuenta atrás; si no, la duración prevista y un botón para iniciarla.
 */
export function RestCard({
  timer,
  defaultSec,
  now,
  onStart,
  onPause,
  onResume,
  onRestart,
  onAdd,
  onSetDuration,
  onSkip,
}: {
  timer: TimerState | null;
  defaultSec: number;
  now: number;
  onStart: (sec: number) => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onAdd: (sec: number) => void;
  onSetDuration: (sec: number) => void;
  onSkip: () => void;
}) {
  const running = timer?.status === 'running';
  const rem = timer ? remainingMs(timer, now) : defaultSec * 1000;
  const durationSec = timer ? Math.round(timer.durationMs / 1000) : defaultSec;
  const iconBtn = 'grid h-11 w-12 place-items-center rounded-xl border border-line bg-surface text-ink hover:bg-primary-soft';
  return (
    <section aria-labelledby="rest-title" className="flex flex-col items-center gap-3 rounded-2xl border border-line/70 bg-surface p-4 text-center shadow-card">
      <h2 id="rest-title" className="font-display text-lg font-semibold">Descanso</h2>
      <ProgressRing value={timer ? progress(timer, now) : 0} size={150} stroke={11} label={timer ? `Descanso: quedan ${Math.ceil(rem / 1000)} segundos` : `Descanso previsto de ${defaultSec} segundos`}>
        <span className="tabular font-display text-4xl font-bold" aria-hidden>
          {formatClock(rem)}
        </span>
      </ProgressRing>
      <p className="sr-only" aria-live="polite">
        {timer && rem <= 10_000 && rem > 0 ? `Quedan ${Math.ceil(rem / 1000)} segundos` : ''}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={iconBtn} onClick={() => onAdd(-15)} aria-label="Restar 15 segundos">
          <span className="text-sm font-semibold">−15</span>
        </button>
        {!timer ? (
          <button type="button" className={iconBtn} onClick={() => onStart(defaultSec)} aria-label="Iniciar descanso">
            <IconPlay size={18} />
          </button>
        ) : running ? (
          <button type="button" className={iconBtn} onClick={onPause} aria-label="Pausar descanso">
            <IconPause size={18} />
          </button>
        ) : (
          <button type="button" className={iconBtn} onClick={onResume} aria-label="Reanudar descanso">
            <IconPlay size={18} />
          </button>
        )}
        <button type="button" className={iconBtn} onClick={timer ? onRestart : () => onStart(defaultSec)} aria-label="Reiniciar descanso">
          <IconReset size={18} />
        </button>
        <button type="button" className={iconBtn} onClick={() => onAdd(15)} aria-label="Sumar 15 segundos">
          <span className="text-sm font-semibold">+15</span>
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Duración del descanso">
        {REST_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={durationSec === s}
            onClick={() => onSetDuration(s)}
            className={`min-h-9 rounded-full px-3 text-xs font-semibold ${durationSec === s ? 'bg-primary text-on-primary' : 'bg-primary-soft text-primary'}`}
          >
            {s} s
          </button>
        ))}
      </div>
      {timer ? (
        <button type="button" onClick={onSkip} className="min-h-10 text-sm font-semibold text-primary">
          Saltar descanso →
        </button>
      ) : null}
    </section>
  );
}
