import { useState } from 'react';
import { GUIDE, type ExerciseGuide } from '../data/guide';
import { PLAN_DAYS, allPlanExercises, findPlanExercise } from '../data/plan';
import { useSettings } from '../hooks/useData';
import { navigate } from '../hooks/useRoute';
import { updateSettings } from '../lib/db';
import { ExerciseIllustration } from './ExerciseIllustration';
import { Button, Field, Notice, PageHeader, inputClass, useToast } from './ui';

function isDirectVideo(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);
}

function isSafeUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function VideoSlot({ exerciseId }: { exerciseId: string }) {
  const settings = useSettings();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!settings) return null;
  const url = settings.videoLinks[exerciseId];

  const save = async () => {
    const v = draft.trim();
    if (v && !isSafeUrl(v)) {
      toast('Introduce un enlace que empiece por https://', 'error');
      return;
    }
    const links = { ...settings.videoLinks };
    if (v) links[exerciseId] = v;
    else delete links[exerciseId];
    await updateSettings({ videoLinks: links });
    setEditing(false);
    toast(v ? 'Video guardado' : 'Video eliminado');
  };

  return (
    <div className="flex flex-col gap-2">
      {url && !editing ? (
        isDirectVideo(url) ? (
          <video src={url} controls playsInline preload="metadata" className="w-full rounded-2xl bg-black" aria-label="Tu video de demostración" />
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-4 font-semibold text-sage-strong">
            Abrir mi video de referencia ↗
          </a>
        )
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-2">
          <Field label="Enlace a tu video (propio o con permiso/licencia)" hint="Se guarda solo en este dispositivo. Archivos .mp4/.webm se reproducen aquí; otros enlaces se abren aparte.">
            {(id) => <input id={id} className={inputClass} type="url" inputMode="url" placeholder="https://…" value={draft} onChange={(e) => setDraft(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">Guardar</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft(url ?? '');
            setEditing(true);
          }}
        >
          {url ? 'Cambiar o quitar mi video' : '+ Añadir mi video autorizado'}
        </Button>
      )}
    </div>
  );
}

export function GuideContent({ exerciseId, compact }: { exerciseId: string; compact?: boolean }) {
  const ex = findPlanExercise(exerciseId);
  const g: ExerciseGuide | undefined = GUIDE[exerciseId];
  if (!ex || !g) return <p>Ejercicio no encontrado.</p>;
  return (
    <div className="flex flex-col gap-4">
      {!compact ? <ExerciseIllustration pattern={g.pattern} label={ex.nameEs} className="aspect-[5/4]" /> : null}
      <p className="text-sm text-muted">
        <span className="font-semibold text-ink">Músculos:</span> {g.muscles}
      </p>
      <div>
        <h3 className="mb-1 font-semibold">Preparación</h3>
        <ul className="list-disc space-y-1 pl-5">{g.setup.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <div>
        <h3 className="mb-1 font-semibold">Ejecución</h3>
        <ol className="list-decimal space-y-1 pl-5">{g.steps.map((t) => <li key={t}>{t}</li>)}</ol>
      </div>
      <div>
        <h3 className="mb-1 font-semibold">Claves</h3>
        <div className="flex flex-wrap gap-2">
          {g.cues.map((c) => (
            <span key={c} className="rounded-full bg-sage-soft px-3 py-1 text-sm">{c}</span>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-1 font-semibold">Errores comunes</h3>
        <ul className="list-disc space-y-1 pl-5">{g.mistakes.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      {g.caution ? <Notice tone="warn">{g.caution}</Notice> : null}
      <div>
        <h3 className="mb-1 font-semibold">Alternativas</h3>
        <ul className="space-y-2">
          {g.alternatives.map((a) => (
            <li key={a.id} className="rounded-2xl bg-surface-2 p-3">
              <p className="font-medium">{a.name}</p>
              <p className="text-sm text-muted">{a.why}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 font-semibold">Video de referencia</h3>
        <VideoSlot exerciseId={exerciseId} />
      </div>
    </div>
  );
}

export function GuideView({ exerciseId }: { exerciseId?: string }) {
  if (exerciseId) {
    const ex = findPlanExercise(exerciseId);
    return (
      <div>
        <button type="button" onClick={() => navigate('/guia')} className="mb-2 min-h-11 font-semibold text-sage-strong">← Guía</button>
        <PageHeader title={ex?.nameEs ?? 'Ejercicio'} subtitle={ex ? `${ex.name} · ${ex.reps}` : undefined} />
        <GuideContent exerciseId={exerciseId} />
      </div>
    );
  }
  const exercises = allPlanExercises();
  return (
    <div>
      <PageHeader title="Guía de técnica" subtitle="Ilustraciones originales, claves y alternativas" />
      <div className="mb-4">
        <Notice>
          La técnica es más importante que la carga. Si un ejercicio provoca dolor, detente y elige una alternativa. Ningún ejercicio quema grasa de una zona concreta.
        </Notice>
      </div>
      {(['A', 'B', 'C', 'D'] as const).map((k) => (
        <section key={k} className="mb-5" aria-labelledby={`g-${k}`}>
          <h2 id={`g-${k}`} className="mb-2 font-display text-xl font-semibold">
            {PLAN_DAYS[k].title} <span className="text-base font-normal text-muted">· {PLAN_DAYS[k].weekday}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {PLAN_DAYS[k].exercises.map((ex) => (
              <li key={k + ex.id}>
                <a href={`#/guia/${ex.id}`} className="block h-full rounded-3xl border border-line bg-surface p-2 transition hover:bg-surface-2">
                  <ExerciseIllustration pattern={GUIDE[ex.id].pattern} label={ex.nameEs} className="aspect-[5/4]" />
                  <p className="mt-2 px-1 font-semibold leading-tight">{ex.nameEs}</p>
                  <p className="px-1 pb-1 text-xs text-muted">{ex.name}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="sr-only">{exercises.length} ejercicios en total.</p>
    </div>
  );
}

