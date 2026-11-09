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
import { Loading, ToastProvider } from './ui';

const TABS: { path: string; label: string; icon: ReactNode }[] = [
  { path: '/', label: 'Hoy', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { path: '/plan', label: 'Plan', icon: <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" /> },
  { path: '/progreso', label: 'Progreso', icon: <path d="M4 19V5M4 19h16M8 15l4-5 3 3 4-6" /> },
  { path: '/guia', label: 'Guía', icon: <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 8h6M9 12h6" /> },
  { path: '/ajustes', label: 'Ajustes', icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /> },
];

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
  if (coach) return <CoachMode sessionId={decodeURIComponent(coach[1])} />;

  const guide = route.match(/^\/guia\/(.+)$/);
  let page: ReactNode;
  if (route === '/' || route === '') page = <Dashboard />;
  else if (route === '/plan') page = <CalendarView />;
  else if (route === '/progreso') page = <ProgressView />;
  else if (route === '/historial') page = <HistoryView />;
  else if (route === '/ajustes') page = <SettingsView />;
  else if (route === '/guia') page = <GuideView />;
  else if (guide) page = <GuideView exerciseId={decodeURIComponent(guide[1])} />;
  else page = <Dashboard />;

  const activeTab = route.startsWith('/guia') ? '/guia' : route === '/historial' ? '/progreso' : TABS.some((t) => t.path === route) ? route : '/';

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Saltar al contenido
      </a>
      <main id="main" className="safe-top mx-auto max-w-xl px-4 pb-32">
        <div key={route} className="animate-in">{page}</div>
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur" aria-label="Navegación principal">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((t) => {
            const active = activeTab === t.path;
            return (
              <li key={t.path}>
                <a
                  href={`#${t.path}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 text-xs font-semibold ${active ? 'text-sage-strong' : 'text-muted'}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {t.icon}
                  </svg>
                  {t.label}
                </a>
              </li>
            );
          })}
        </ul>
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
