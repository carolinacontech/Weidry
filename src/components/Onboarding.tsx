import { useState } from 'react';
import { PROGRAM_START } from '../data/plan';
import { updateSettings } from '../lib/db';
import { formatLong } from '../lib/dates';
import { isIOS, isStandalone } from '../lib/platform';
import { Button, Notice } from './ui';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const steps = [
    <div key="0" className="flex flex-col gap-4">
      <h1 className="font-display text-4xl font-semibold leading-tight">Hola, bienvenida a Mi Entrenamiento</h1>
      <p className="text-lg text-muted">Un programa de fuerza de 13 semanas, guiado serie a serie, que empieza el {formatLong(PROGRAM_START).toLowerCase()}.</p>
      <ul className="flex flex-col gap-2">
        {['4 días de fuerza (A, B, C, D) con énfasis en glúteos + 2 de cardio + 1 de descanso', 'Pensado para tus mancuernas de 10, 15 y 20 lb, peso corporal y botellas de agua', 'Registras peso real, repeticiones y repeticiones en reserva (RIR)', 'Modo coach con temporizador, indicaciones y comandos de voz', 'Nada cambia sin tu aprobación · funciona sin conexión y sin cuenta'].map((t) => (
          <li key={t} className="flex gap-3 rounded-2xl bg-surface p-3">
            <span className="text-sage" aria-hidden>●</span>
            {t}
          </li>
        ))}
      </ul>
    </div>,
    <div key="1" className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Antes de empezar</h1>
      <Notice tone="warn" title="Consulta con un profesional">
        Tu perfil indica hígado graso. Esta app no es un servicio médico ni sustituye a tu profesional de la salud: consúltale antes de empezar si tienes cualquier condición clínica, lesión o medicación, y detente ante dolor, mareo, falta de aire o dolor en el pecho.
      </Notice>
      <Notice title="Sobre los objetivos">
        La prioridad es ganar fuerza, desarrollar glúteos y definición muscular, no un número de báscula o de cintura. Las cargas semanales son propuestas condicionadas a tu técnica y esfuerzo, nunca obligaciones. No es posible eliminar grasa de una zona concreta con ejercicios localizados, y no hay garantías de resultados.
      </Notice>
      <label className="flex min-h-12 items-start gap-3 rounded-2xl bg-surface p-3">
        <input type="checkbox" className="mt-1 h-6 w-6 accent-[var(--sage)]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>Entiendo que esta app ofrece orientación general y que consultaré con un profesional si tengo limitaciones clínicas.</span>
      </label>
    </div>,
    <div key="2" className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Dos cosas útiles</h1>
      <div className="rounded-2xl bg-surface p-4">
        <p className="font-semibold">1. Tu equipamiento ya está cargado</p>
        <p className="text-muted">Pares de mancuernas fijas de 10, 15 y 20 lb, más botellas de agua como alternativa ligera. Puedes editarlo en Ajustes → Mi equipamiento. La app nunca propone una mancuerna que no tengas.</p>
      </div>
      {isIOS() && !isStandalone() ? (
        <div className="rounded-2xl bg-surface p-4">
          <p className="font-semibold">2. Instálala en tu iPhone</p>
          <p className="text-muted">En Safari toca el botón Compartir y luego “Añadir a pantalla de inicio”. Así funciona a pantalla completa, sin conexión y con notificaciones (iOS 16.4+).</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface p-4">
          <p className="font-semibold">2. Instálala</p>
          <p className="text-muted">Desde el menú del navegador elige “Instalar app” o “Añadir a pantalla de inicio” para usarla sin conexión.</p>
        </div>
      )}
    </div>,
  ];
  const last = step === steps.length - 1;
  return (
    <div className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg px-5" role="dialog" aria-modal="true" aria-label="Bienvenida">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between gap-6 py-6">
        <div className="animate-in" key={step}>{steps[step]}</div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-center gap-2" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-sage' : 'w-2 bg-line'}`} />
            ))}
          </div>
          <Button
            size="xl"
            disabled={step === 1 && !accepted}
            onClick={async () => {
              if (last) await updateSettings({ onboarded: true });
              else setStep(step + 1);
            }}
          >
            {last ? 'Empezar' : 'Continuar'}
          </Button>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
