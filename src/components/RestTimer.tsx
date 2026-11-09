import { REST_OPTIONS } from '../data/plan';
import { formatClock, progress, remainingMs, type TimerState } from '../lib/timer';
import { Button, Chip, ProgressRing } from './ui';

export function RestTimer({
  timer,
  now,
  nextLabel,
  muted,
  onToggleMute,
  onPause,
  onResume,
  onAdd,
  onSetDuration,
  onSkip,
}: {
  timer: TimerState;
  now: number;
  nextLabel: string;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onAdd: (sec: number) => void;
  onSetDuration: (sec: number) => void;
  onSkip: () => void;
}) {
  const rem = remainingMs(timer, now);
  const running = timer.status === 'running';
  const durationSec = Math.round(timer.durationMs / 1000);
  return (
    <div className="flex flex-1 flex-col items-center gap-5 py-2 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">Descanso</p>
      <ProgressRing value={progress(timer, now)} size={230} stroke={14} label={`Descanso: quedan ${Math.ceil(rem / 1000)} segundos`}>
        <div>
          <p className="tabular font-display text-6xl font-semibold" aria-hidden>
            {formatClock(rem)}
          </p>
          <p className="text-sm text-muted">{running ? 'Respira y recupera' : timer.status === 'paused' ? 'En pausa' : 'Listo'}</p>
        </div>
      </ProgressRing>
      {/* Anuncio accesible cada cambio relevante, no cada segundo */}
      <p className="sr-only" aria-live="polite">
        {rem <= 10_000 && rem > 0 ? `Quedan ${Math.ceil(rem / 1000)} segundos` : ''}
      </p>
      <div className="w-full rounded-2xl bg-surface-2 p-3">
        <p className="text-sm text-muted">A continuación</p>
        <p className="font-semibold">{nextLabel}</p>
      </div>
      <div className="flex w-full gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => onAdd(-15)} aria-label="Restar 15 segundos">−15 s</Button>
        {running ? (
          <Button variant="secondary" className="flex-1" onClick={onPause}>Pausar</Button>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={onResume}>Reanudar</Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={() => onAdd(15)} aria-label="Sumar 15 segundos">+15 s</Button>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-2" role="group" aria-label="Duración del descanso">
        {REST_OPTIONS.map((s) => (
          <Chip key={s} selected={durationSec === s} onClick={() => onSetDuration(s)} aria-label={`Descanso de ${s} segundos`}>
            {s} s
          </Chip>
        ))}
      </div>
      <div className="flex w-full gap-2">
        <Button variant="ghost" className="flex-1" onClick={onToggleMute} aria-pressed={muted}>
          {muted ? '🔇 Sonido y voz apagados' : '🔊 Silenciar'}
        </Button>
      </div>
      <Button size="lg" className="w-full" onClick={onSkip}>
        Empezar siguiente serie
      </Button>
    </div>
  );
}
