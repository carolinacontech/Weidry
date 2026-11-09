import { useEffect, type ReactNode } from 'react';
import { DAY_LABELS, PROGRAM_WEEKS } from '../data/plan';
import { useProfile, useSettings } from '../hooks/useData';
import { useRoute } from '../hooks/useRoute';
import { db, getActiveSession, getSettings, requestPersistentStorage, updateSettings } from '../lib/db';
import { today } from '../lib/dates';
import { showLocalNotification } from '../lib/platform';
import { isStrengthDay, programDayFor } from '../lib/program';
import { GuideView } from './GuideView';
import { HistoryView } from './HistoryView';
import { Dashboard } from './Dashboard';
import { Onboarding } from './Onboarding';
import { ProgramView } from './ProgramView';
import { ProgressView } from './ProgressView';
import { SettingsView, applyTheme } from './SettingsView';
import { TrainView } from './TrainView';
import { Loading, ToastProvider } from './ui';

interface NavItem {
  path: string;
  label: string;
  mobileLabel: string;
  glyph: string;
}

/** Navegación principal del prototipo. */
const MAIN_NAV: NavItem[] = [
  { path: '/', label: 'Inicio', mobileLabel: 'Inicio', glyph: '⌂' },
  { path: '/entrenamiento', label: 'Entrenar', mobileLabel: 'Entrenar', glyph: '◈' },
  { path: '/plan', label: 'Mi programa', mobileLabel: 'Programa', glyph: '▦' },
  { path: '/progreso', label: 'Progreso', mobileLabel: 'Progreso', glyph: '↗' },
];

/** Secciones adicionales de la app completa (mismo estilo, menú secundario). */
const MORE_NAV: NavItem[] = [
  { path: '/historial', label: 'Historial', mobileLabel: 'Historial', glyph: '◷' },
  { path: '/guia', label: 'Técnica', mobileLabel: 'Técnica', glyph: '✎' },
  { path: '/ajustes', label: 'Ajustes', mobileLabel: 'Ajustes', glyph: '⚙' },
];

function sectionOf(route: string): string {
  if (route.startsWith('/coach') || route === '/entrenamiento') return '/entrenamiento';
  if (route.startsWith('/guia')) return '/guia';
  if (route === '/medidas') return '/progreso';
  return [...MAIN_NAV, ...MORE_NAV].some((n) => n.path === route) ? route : '/';
}

const HEADINGS: Record<string, string> = {
  '/entrenamiento': 'Tu entrenamiento',
  '/plan': 'Un plan para ti',
  '/progreso': 'Cada avance cuenta',
  '/historial': 'Tu historial',
  '/guia': 'Técnica sin prisa',
  '/ajustes': 'Tu espacio',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'W';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Muestra una notificación local si el entreno de hoy está pendiente después de la hora elegida. */
async function maybeNotify() {
  const s = await getSettings();
  if (!s.reminderEnabled || !s.notificationsEnabled || s.lastNotifiedDate === today()) return;
  const [h, m] = s.reminderTime.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  const pd = programDayFor(today());
  if (pd.status !== 'active') return;
  if (isStrengthDay(pd.dayKey)) {
    const done = await db.sessions.where('date').equals(today()).filter((x) => x.status === 'completed').count();
    if (done > 0) return;
    const active = await getActiveSession();
    const ok = await showLocalNotification(
      'Weidry',
      active ? 'Tienes una sesión sin terminar. ¿La retomamos?' : `Hoy toca ${DAY_LABELS[pd.dayKey]}. Una versión corta también cuenta.`,
    );
    if (ok) await updateSettings({ lastNotifiedDate: today() });
  } else if (pd.dayKey === 'cardio') {
    const done = await db.cardio.where('date').equals(today()).count();
    if (done > 0) return;
    const ok = await showLocalNotification('Weidry', 'Hoy toca cardio a ritmo moderado.');
    if (ok) await updateSettings({ lastNotifiedDate: today() });
  }
}

function Shell() {
  const route = useRoute();
  const settings = useSettings();
  const profile = useProfile();

  useEffect(() => {
    void requestPersistentStorage();
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') void maybeNotify();
    };
    void maybeNotify();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [settings?.theme]);

  if (!settings || !profile) return <Loading label="Abriendo Weidry…" />;
  if (!settings.onboarded) return <Onboarding />;

  const section = sectionOf(route);
  const guide = route.match(/^\/guia\/(.+)$/);
  let page: ReactNode;
  if (section === '/entrenamiento') page = <TrainView />;
  else if (route === '/plan') page = <ProgramView />;
  else if (route === '/progreso') page = <ProgressView />;
  else if (route === '/medidas') page = <ProgressView initialTab="medidas" />;
  else if (route === '/historial') page = <HistoryView embedded />;
  else if (route === '/ajustes') page = <SettingsView />;
  else if (route === '/guia') page = <GuideView />;
  else if (guide) page = <GuideView exerciseId={decodeURIComponent(guide[1])} />;
  else page = <Dashboard />;

  const name = profile.name?.trim() ?? '';
  const pd = programDayFor(today());
  const week = pd.week ?? (pd.status === 'before' ? 1 : PROGRAM_WEEKS);
  const heading = section === '/' ? `Hola, ${name || 'campeona'}` : HEADINGS[section] ?? 'Weidry';
  const navLink = (n: NavItem, small?: boolean) => (
    <a key={n.path} href={`#${n.path}`} className={`nav-link${small ? ' small' : ''}${section === n.path ? ' active' : ''}`} aria-current={section === n.path ? 'page' : undefined}>
      <span className="ico" aria-hidden>
        {n.glyph}
      </span>
      <span>{n.label}</span>
    </a>
  );

  return (
    <div className="app-shell">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Saltar al contenido
      </a>
      <aside className="sidebar" aria-label="Navegación principal">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          <span>
            Wei<span className="brand-accent">dry</span>
          </span>
        </a>
        <p className="sidebar-kicker">MI ESTUDIO</p>
        <nav className="side-menu">{MAIN_NAV.map((n) => navLink(n))}</nav>
        <p className="sidebar-kicker second">MÁS</p>
        <nav className="side-menu" aria-label="Más secciones">
          {MORE_NAV.map((n) => navLink(n, true))}
        </nav>
        <a className="side-bottom" href="#/ajustes">
          <span className="avatar" aria-hidden>
            {initials(name)}
          </span>
          <span>
            <strong>{name || 'Tu espacio'}</strong>
            <small>Plan de 13 semanas</small>
          </span>
        </a>
      </aside>

      <main id="main" className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Tu espacio de fuerza</span>
            <h1>
              {heading} <span aria-hidden>✳</span>
            </h1>
          </div>
          <div className="header-actions">
            <span className="day-pill">
              {pd.status === 'before' ? 'Empieza el 9 nov' : pd.status === 'after' ? 'Programa completado' : `Semana ${week} de ${PROGRAM_WEEKS}`}
            </span>
            <a href="#/ajustes" className="avatar small" aria-label="Tu perfil y ajustes">
              {initials(name)}
            </a>
          </div>
        </header>
        <div key={route} className="animate-in">
          {page}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        {MAIN_NAV.map((n) => (
          <a key={n.path} href={`#${n.path}`} className={`bottom-link${section === n.path ? ' active' : ''}`} aria-current={section === n.path ? 'page' : undefined}>
            <span aria-hidden>{n.glyph}</span>
            {n.mobileLabel}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
