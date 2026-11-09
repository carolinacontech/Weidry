import { useEffect, useState } from 'react';

/** Enrutado por hash (#/ruta): funciona offline y en hosting estático sin configuración. */
export function useRoute(): string {
  const get = () => (typeof window === 'undefined' ? '/' : window.location.hash.replace(/^#/, '') || '/');
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
