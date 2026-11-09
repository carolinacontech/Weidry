import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sage text-on-sage hover:bg-sage-strong active:scale-[0.98] shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 active:scale-[0.98]',
  soft: 'bg-sage-soft text-ink hover:brightness-95 active:scale-[0.98]',
  ghost: 'bg-transparent text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger border border-danger/30 hover:brightness-95 active:scale-[0.98]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl'; loading?: boolean }) {
  const sizes = { sm: 'min-h-10 px-3 text-sm', md: 'min-h-12 px-4 text-base', lg: 'min-h-14 px-5 text-lg', xl: 'min-h-16 px-6 text-xl' };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      aria-busy={loading || undefined}
      {...rest}
      disabled={rest.disabled || loading}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      <span className="sr-only">{label ?? 'Cargando'}</span>
    </span>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-sage border-t-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function Card({ children, className = '', as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string; 'aria-label'?: string }) {
  return (
    <As className={`rounded-3xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Chip({ selected, children, onClick, className = '', ...rest }: { selected?: boolean; children: ReactNode; onClick?: () => void; className?: string; 'aria-label'?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${selected ? 'border-sage bg-sage text-on-sage' : 'border-line bg-surface text-ink hover:bg-surface-2'} disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-sage' : 'bg-line'}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );
}

export function Stepper({
  label,
  value,
  onDec,
  onInc,
  display,
  unitLabel,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  display?: string;
  unitLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted" id={`${label}-lbl`}>
        {label}
      </span>
      <div className="flex items-center gap-2" role="group" aria-labelledby={`${label}-lbl`}>
        <button type="button" onClick={onDec} className="h-14 w-14 shrink-0 rounded-2xl border border-line bg-surface text-2xl font-bold hover:bg-surface-2 active:scale-95" aria-label={`Restar ${label.toLowerCase()}`}>
          −
        </button>
        <output className="tabular min-w-0 flex-1 text-center text-2xl font-bold" aria-live="polite">
          {display ?? value}
          {unitLabel ? <span className="ml-1 text-base font-medium text-muted">{unitLabel}</span> : null}
        </output>
        <button type="button" onClick={onInc} className="h-14 w-14 shrink-0 rounded-2xl border border-line bg-surface text-2xl font-bold hover:bg-surface-2 active:scale-95" aria-label={`Sumar ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
      aria-labelledby="modal-title"
    >
      {open ? (
        <div className="safe-bottom flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
            <h2 id="modal-title" className="font-display text-xl font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="h-11 w-11 rounded-full text-2xl hover:bg-surface-2" aria-label="Cerrar">
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sage)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .4s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'danger' | 'success'; children: ReactNode; title?: string }) {
  const tones = {
    info: 'bg-surface-2 border-line',
    warn: 'bg-warn-soft border-warn/30',
    danger: 'bg-danger-soft border-danger/30',
    success: 'bg-sage-soft border-sage/30',
  };
  return (
    <div className={`rounded-2xl border p-3 text-sm ${tones[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

// ---------- Toasts (feedback) ----------

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 safe-top" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-in pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'info' ? 'bg-ink text-bg' : 'bg-sage text-on-sage'}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass = 'min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink placeholder:text-muted/70 focus:border-sage';
