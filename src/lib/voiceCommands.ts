/**
 * Comandos de voz en español (Web Speech API: SpeechRecognition).
 * Disponible en Chrome/Edge y en Safari 14.5+ (con prefijo webkit). En iPhone requiere
 * permiso de micrófono, puede detenerse tras unos segundos de silencio (se reinicia
 * automáticamente mientras la pantalla está activa) y no funciona en segundo plano.
 */

export type VoiceCommand = 'complete' | 'pause' | 'resume' | 'next' | 'previous' | 'skipRest' | 'addTime' | 'repeat';

const PATTERNS: [VoiceCommand, RegExp][] = [
  ['addTime', /\b(m[aá]s tiempo|quince m[aá]s|15 m[aá]s)\b/],
  ['repeat', /\b(repite|repetir|qu[eé] toca)\b/],
  ['pause', /\b(pausa|pausar|det[eé]n|detener)\b/],
  ['resume', /\b(seguir|sigue|contin[uú]a|continuar|reanudar|reanuda)\b/],
  ['complete', /\b(listo|lista|hecho|hecha|serie hecha|complet[ao]r?)\b/],
  ['next', /\b(siguiente|pr[oó]ximo)\b/],
  ['previous', /\b(anterior|atr[aá]s)\b/],
  ['skipRest', /\b(saltar|salta|vamos)\b/],
];

export const COMMAND_HELP: { say: string; does: string }[] = [
  { say: '“Listo”', does: 'completa la serie (o termina el descanso)' },
  { say: '“Pausa” / “Seguir”', does: 'pausa o reanuda' },
  { say: '“Siguiente” / “Anterior”', does: 'cambia de ejercicio' },
  { say: '“Saltar”', does: 'termina el descanso' },
  { say: '“Más tiempo”', does: 'suma 15 s al descanso' },
  { say: '“Repite”', does: 'repite la indicación actual' },
];

export function parseCommand(text: string): VoiceCommand | null {
  const t = text.toLowerCase().normalize('NFC').trim();
  for (const [cmd, re] of PATTERNS) if (re.test(t)) return cmd;
  return null;
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function ctor(): (new () => Recognition) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speechRecognitionSupported(): boolean {
  return !!ctor();
}

export type ListenerState = 'off' | 'listening' | 'denied' | 'unsupported' | 'error';

export function createListener(opts: {
  onCommand: (c: VoiceCommand, heard: string) => void;
  onState: (s: ListenerState) => void;
  /** Devuelve true mientras la app está hablando (para no reaccionar a su propia voz). */
  isAppSpeaking: () => boolean;
}) {
  const C = ctor();
  if (!C) {
    opts.onState('unsupported');
    return { start() {}, stop() {} };
  }
  let rec: Recognition | null = null;
  let active = false;
  let lastCmdAt = 0;

  const begin = () => {
    rec = new C();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      if (opts.isAppSpeaking()) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal) continue;
        const heard = r[0]?.transcript ?? '';
        const cmd = parseCommand(heard);
        const now = Date.now();
        if (cmd && now - lastCmdAt > 1200) {
          lastCmdAt = now;
          opts.onCommand(cmd, heard);
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false;
        opts.onState('denied');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') opts.onState('error');
    };
    rec.onend = () => {
      // Safari y Chrome cortan la escucha tras silencios: reiniciar mientras siga activa.
      if (active) setTimeout(() => active && safeStart(), 250);
    };
    safeStart();
  };
  const safeStart = () => {
    try {
      rec?.start();
      opts.onState('listening');
    } catch {
      /* ya estaba escuchando */
    }
  };

  return {
    start() {
      if (active) return;
      active = true;
      begin();
    },
    stop() {
      active = false;
      try {
        rec?.abort();
      } catch {
        /* nada */
      }
      rec = null;
      opts.onState('off');
    },
  };
}
