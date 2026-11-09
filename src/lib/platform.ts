/**
 * Capacidades del dispositivo con degradación elegante.
 * Limitaciones reales de iPhone/Safari:
 * - El audio (Web Audio y voz) solo funciona después de un toque de la persona;
 *   por eso "desbloqueamos" audio y voz al pulsar "Empezar".
 * - Con la pantalla bloqueada o la app en segundo plano, iOS suspende JavaScript:
 *   NO se garantizan sonidos ni voz en ese estado. El temporizador sigue siendo
 *   correcto al volver porque se basa en la hora real.
 * - navigator.vibrate no existe en Safari para iOS: la vibración solo funciona en Android.
 * - Wake Lock funciona en Safari 16.4+ y en apps instaladas desde iOS 18.4.
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Llamar dentro de un gesto (toque) para habilitar audio y voz en iOS. */
export function unlockAudio(): void {
  const c = audioCtx();
  if (c && c.state === 'suspended') void c.resume();
  if (c) {
    // Un buffer silencioso termina de desbloquear el audio en Safari.
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
}

export function beep(freq = 880, durationMs = 160, volume = 0.25): void {
  const c = audioCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = c.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + durationMs / 1000 + 0.05);
}

export function doneChime(): void {
  beep(660, 180);
  setTimeout(() => beep(880, 180), 200);
  setTimeout(() => beep(1175, 320), 400);
}

let spanishVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (spanishVoice !== undefined && spanishVoice !== null) return spanishVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  spanishVoice =
    voices.find((v) => v.lang === 'es-MX') ??
    voices.find((v) => v.lang === 'es-US') ??
    voices.find((v) => v.lang === 'es-ES') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('es')) ??
    null;
  return spanishVoice;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let speakingUntil = 0;

/** true mientras la app habla y durante 1,2 s después (para que los comandos de voz no se activen con su propia voz). */
export function isAppSpeaking(): boolean {
  return (speechSupported() && window.speechSynthesis.speaking) || Date.now() < speakingUntil;
}

export function speak(text: string): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  speakingUntil = Date.now() + 1200 + text.length * 80;
  u.onend = () => {
    speakingUntil = Date.now() + 1200;
  };
  u.lang = 'es-ES';
  const v = pickVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  u.rate = 1;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern: number | number[]): void {
  if (vibrationSupported()) navigator.vibrate(pattern);
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Muestra una notificación local a través del service worker (sin servidor push). */
export async function showLocalNotification(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'recordatorio' });
    return true;
  } catch {
    return false;
  }
}
