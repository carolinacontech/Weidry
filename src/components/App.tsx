import { useEffect, type ReactNode } from 'react';
import { DAY_LABELS } from '../data/plan';
import { useSettings } from '../hooks/useData';
import { useRoute } from '../hooks/useRoute';
import { db, getActiveSession, getSettings, requestPersistentStorage, updateSettings } from '../lib/db';
import { today } from '../lib/dates';
import { showLocalNotification } from '../lib/platform';
import { isStrengthDay, programDayFor } from '../lib/program';
import { CalendarView } from './CalendarView';
import { CoachMode } from './CoachMode';
import { Dashboard } from './Dashboard';
import { GuideView } from './GuideView';
import { HistoryView } from './HistoryView';
import { Onboarding } from './Onboarding';
import { ProgressView } from './ProgressView';
import { SettingsView, applyTheme } from './SettingsView';
import { IconBook, IconCalendar, IconChart, IconDumbbell, IconHistory, IconHome, IconSettings, IconTape, Logo } from './icons';
import { TrainingView } from './TrainingView';
import { Loading, ToastProvider } from './ui';

interface NavItem {
  path: string;
  label: string;
  short?: string;
  Icon: (p: { size?: number }) => ReactNode;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { path: '/', label: 'Inicio', Icon: IconHome, mobile: true },
  { path: '/entrenamiento', label: 'Entrenamiento', short: 'Entreno', Icon: IconDumbbell, mobile: true },
  { path: '/plan', label: 'Programa (13 semanas)', short: 'Programa', Icon: IconCalendar, mobile: true },
  { path: '/progreso', label: 'Progreso', Icon: IconChart, mobile: true },
  { path: '/medidas', label: 'Medidas', Icon: IconTape },
  { path: '/historial', label: 'Historial', Icon: IconHistory },
  { path: '/guia', label: 'Ejercicios', Icon: IconBook },
  { path: '/ajustes', label: 'Ajustes', Icon: IconSettings, mobile: true },
];

function activePath(route: string): string {
  if (route.startsWith('/guia')) return '/guia';
  if (route.startsWith('/coach')) return '/entrenamiento';
  const hit = NAV.find((n) => n.path === route);
  return hit ? hit.path : '/';
}

function Sidebar({ route }: { route: string }) {
  const active = activePath(route);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-gradient-to-b from-[var(--sidebar-from)] to-[var(--sidebar-to)] text-white lg:flex" aria-label="Menú principal">
      <a href="#/" className="flex items-center gap-2 px-6 pb-6 pt-7 font-display text-xl font-bold">
        <span className="text-[#c4b5fd]"><Logo /></span>
        Mi Entrenamiento
      </a>
      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ path, label, Icon }) => {
            const on = active === path;
            return (
              <li key={path}>
                <a
                  href={`#${path}`}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-4 font-medium transition ${on ? 'bg-[#a78bfa] text-white shadow-lg' : 'text-white/85 hover:bg-white/10'}`}
                >
                  <Icon size={20} />
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Ondas decorativas */}
      <svg viewBox="0 0 256 140" className="pointer-events-none mt-auto w-full opacity-60" aria-hidden>
        <path d="M0 60 C60 20 120 100 256 50 V140 H0z" fill="#7c3aed" opacity="0.45" />
        <path d="M0 95 C80 60 150 130 256 85 V140 H0z" fill="#a78bfa" opacity="0.35" />
      </svg>
    </aside>
  );
}

function BottomNav({ route }: { route: string }) {
  const active = activePath(route);
  const items = NAV.filter((n) => n.mobile);
  const mapped = ['/medidas', '/historial'].includes(active) ? '/progreso' : active === '/guia' ? '/entrenamiento' : active;
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Navegación principal">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map(({ path, label, short, Icon }) => {
          const on = mapped === path;
          return (
            <li key={path}>
              <a href={`#${path}`} aria-current={on ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 text-[11px] font-semibold ${on ? 'text-primary' : 'text-muted'}`}>
                <span className={`grid h-7 w-12 place-items-center rounded-full ${on ? 'bg-primary-soft' : ''}`}>
                  <Icon size={21} />
                </span>
                {short ?? label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
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
      'Mi Entrenamiento',
      active ? 'Tienes una sesión sin terminar. ¿La retomamos?' : `Hoy toca ${DAY_LABELS[pd.dayKey]}. Una versión corta también cuenta.`,
    );
    if (ok) await updateSettings({ lastNotifiedDate: today() });
  } else if (pd.dayKey === 'cardio') {
    const done = await db.cardio.where('date').equals(today()).count();
    if (done > 0) return;
    const ok = await showLocalNotification('Mi Entrenamiento', 'Hoy toca cardio a ritmo moderado.');
    if (ok) await updateSettings({ lastNotifiedDate: today() });
  }
}

function Shell() {
  const route = useRoute();
  const settings = useSettings();

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

  if (!settings) return <Loading label="Abriendo Mi Entrenamiento…" />;
  if (!settings.onboarded) return <Onboarding />;

  const coach = route.match(/^\/coach\/(.+)$/);
  const guide = route.match(/^\/guia\/(.+)$/);
  let page: ReactNode;
  if (coach) page = null;
  else if (route === '/entrenamiento') page = <TrainingView />;
  else if (route === '/plan') page = <CalendarView />;
  else if (route === '/progreso') page = <ProgressView />;
  else if (route === '/medidas') page = <ProgressView initialTab="medidas" />;
  else if (route === '/historial') page = <HistoryView />;
  else if (route === '/ajustes') page = <SettingsView />;
  else if (route === '/guia') page = <GuideView />;
  else if (guide) page = <GuideView exerciseId={decodeURIComponent(guide[1])} />;
  else page = <Dashboard />;

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Saltar al contenido
      </a>
      <Sidebar route={route} />
      {coach ? (
        <CoachMode sessionId={decodeURIComponent(coach[1])} />
      ) : (
        <main id="main" className="safe-top mx-auto max-w-xl px-4 pb-32 lg:ml-64 lg:max-w-none lg:px-8 lg:pb-12 lg:pt-8">
          <div key={route} className="animate-in mx-auto max-w-6xl">
            {page}
          </div>
        </main>
      )}
      {coach ? null : <BottomNav route={route} />}
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
