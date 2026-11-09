/**
 * Gráficos SVG accesibles: role="img" con resumen textual, patrones además del color
 * (líneas discontinuas para referencias) y una tabla de datos desplegable.
 */
import { useId, type ReactNode } from 'react';

export interface Point {
  label: string;
  value: number | null;
}

interface Ref {
  value: number;
  label: string;
}

function niceRange(values: number[], refs: Ref[] = []): [number, number] {
  const all = [...values, ...refs.map((r) => r.value)];
  if (all.length === 0) return [0, 1];
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function DataTable({ points, unit, caption, extraCol }: { points: Point[]; unit: string; caption: string; extraCol?: { name: string; values: (number | null)[] } }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="min-h-11 cursor-pointer py-2 font-medium text-primary-600">Ver datos en tabla</summary>
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-muted">
            <th scope="col" className="py-1 pr-2 font-medium">Fecha / periodo</th>
            <th scope="col" className="py-1 font-medium">Valor ({unit})</th>
            {extraCol ? <th scope="col" className="py-1 font-medium">{extraCol.name}</th> : null}
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.label + i} className="border-b border-line/60">
              <th scope="row" className="py-1 pr-2 font-normal">{p.label}</th>
              <td className="tabular py-1">{p.value ?? '—'}</td>
              {extraCol ? <td className="tabular py-1">{extraCol.values[i] ?? '—'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function LineChart({ title, points, unit, refs = [], empty, height = 170, area }: { title: string; points: Point[]; unit: string; refs?: Ref[]; empty?: ReactNode; height?: number; area?: boolean }) {
  const id = useId();
  const valid = points.filter((p) => p.value !== null) as { label: string; value: number }[];
  if (valid.length === 0) return <div className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">{empty ?? 'Aún no hay datos.'}</div>;
  const W = 320;
  const H = height;
  const m = { l: 36, r: 12, t: 12, b: 26 };
  const [min, max] = niceRange(valid.map((p) => p.value), refs);
  const x = (i: number) => m.l + (points.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (points.length - 1));
  const y = (v: number) => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
  const path = points
    .map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(' ');
  const first = valid[0];
  const last = valid[valid.length - 1];
  const summary = `${title}. ${valid.length} registros. Primero: ${first.value} ${unit} (${first.label}). Último: ${last.value} ${unit} (${last.label}).${refs.map((r) => ` ${r.label}: ${r.value} ${unit}.`).join('')}`;
  const ticks = [min, (min + max) / 2, max].map((t) => Math.round(t * 10) / 10);
  const step = Math.max(1, Math.ceil(points.length / 6));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={`${id}-d`}>
        <desc id={`${id}-d`}>{summary}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {refs.map((r) => (
          <g key={r.label}>
            <line x1={m.l} x2={W - m.r} y1={y(r.value)} y2={y(r.value)} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W - m.r} y={y(r.value) - 4} textAnchor="end" fontSize="10" fill="var(--accent)">{r.label}</text>
          </g>
        ))}
        {area && valid.length > 1 ? (
          <>
            <defs>
              <linearGradient id={`g${id.replace(/[^a-zA-Z0-9_-]/g, '')}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`${path} ${x(points.map((p, i) => (p.value === null ? -1 : i)).filter((i) => i >= 0).pop()!)},${H - m.b} ${x(points.findIndex((p) => p.value !== null))},${H - m.b}`}
              fill={`url(#g${id.replace(/[^a-zA-Z0-9_-]/g, '')})`}
            />
          </>
        ) : null}
        <polyline points={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          p.value === null ? null : <circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />,
        )}
        {points.map((p, i) =>
          i % step === 0 || i === points.length - 1 ? (
            <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.label}</text>
          ) : null,
        )}
      </svg>
      <DataTable points={points} unit={unit} caption={title} />
    </figure>
  );
}

export function BarChart({ title, points, unit, targets, highlightIndex }: { title: string; points: Point[]; unit: string; targets?: (number | null)[]; highlightIndex?: number }) {
  const id = useId();
  const W = 320;
  const H = 170;
  const m = { l: 36, r: 8, t: 12, b: 26 };
  const maxV = Math.max(1, ...points.map((p) => p.value ?? 0), ...(targets ?? []).map((t) => t ?? 0));
  const max = Math.ceil(maxV * 1.1);
  const bw = (W - m.l - m.r) / points.length;
  const y = (v: number) => m.t + (1 - v / max) * (H - m.t - m.b);
  const total = points.reduce((a, p) => a + (p.value ?? 0), 0);
  const summary = `${title}. Total ${Math.round(total)} ${unit} en ${points.length} periodos.${targets ? ' Las marcas discontinuas indican la meta de cada periodo.' : ''}`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={`${id}-d`}>
        <desc id={`${id}-d`}>{summary}</desc>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(t)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const v = p.value ?? 0;
          const x = m.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const tgt = targets?.[i];
          return (
            <g key={i}>
              <rect x={x} y={y(v)} width={w} height={Math.max(0, y(0) - y(v))} rx="3" fill={i === highlightIndex ? 'var(--primary-600)' : 'var(--primary)'} opacity={i === highlightIndex ? 1 : 0.8} />
              {tgt ? <line x1={x - 2} x2={x + w + 2} y1={y(tgt)} y2={y(tgt)} stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 2" /> : null}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.label}</text>
            </g>
          );
        })}
      </svg>
      <DataTable points={points} unit={unit} caption={title} extraCol={targets ? { name: 'Meta', values: targets } : undefined} />
    </figure>
  );
}
