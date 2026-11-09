/**
 * Ilustraciones esquemáticas ORIGINALES (dibujadas con código para esta app).
 * Cada patrón se define con dos posturas y se anima entre ellas (SVG/SMIL).
 * Con "reducir movimiento" se muestran ambas posturas estáticas.
 */
import { useEffect, useState } from 'react';
import type { Pattern } from '../data/guide';

type P = [number, number];
interface Pose {
  head: P;
  sh: P;
  hip: P;
  eF: P;
  wF: P;
  eB: P;
  wB: P;
  kF: P;
  aF: P;
  kB: P;
  aB: P;
  toeF?: P;
  toeB?: P;
}

interface Def {
  a: Pose;
  b: Pose;
  db?: 'front' | 'both' | 'none';
  prop?: 'bench' | 'step';
  view: 'side' | 'front';
}

const STAND_SIDE: Pose = {
  head: [100, 30], sh: [100, 46], hip: [100, 86], eF: [100, 66], wF: [101, 88], eB: [100, 66], wB: [101, 88],
  kF: [101, 115], aF: [100, 144], kB: [99, 115], aB: [98, 144],
};
const STAND_FRONT: Pose = {
  head: [100, 30], sh: [100, 46], hip: [100, 86], eF: [88, 66], wF: [86, 88], eB: [112, 66], wB: [114, 88],
  kF: [92, 115], aF: [90, 144], kB: [108, 115], aB: [110, 144], toeF: [86, 145], toeB: [114, 145],
};
const SUPINE = { head: [38, 126] as P, sh: [54, 130] as P, hip: [104, 133] as P, kF: [130, 106] as P, aF: [142, 141] as P, kB: [128, 106] as P, aB: [140, 141] as P };

const DEFS: Record<Pattern, Def> = {
  squat: {
    view: 'side', db: 'front',
    a: { ...STAND_SIDE, eF: [108, 62], wF: [110, 52], eB: [108, 62], wB: [110, 52] },
    b: { ...STAND_SIDE, head: [104, 58], sh: [100, 73], hip: [80, 110], eF: [110, 88], wF: [112, 78], eB: [110, 88], wB: [112, 78], kF: [114, 112], aF: [100, 144], kB: [112, 112], aB: [98, 144] },
  },
  sumo: {
    view: 'front', db: 'front',
    a: { ...STAND_FRONT, kF: [88, 115], aF: [80, 144], kB: [112, 115], aB: [120, 144], toeF: [72, 146], toeB: [128, 146], eF: [94, 68], wF: [100, 92], eB: [106, 68], wB: [100, 92] },
    b: { ...STAND_FRONT, head: [100, 54], sh: [100, 70], hip: [100, 108], kF: [76, 116], aF: [80, 144], kB: [124, 116], aB: [120, 144], toeF: [72, 146], toeB: [128, 146], eF: [93, 92], wF: [100, 116], eB: [107, 92], wB: [100, 116] },
  },
  hinge: {
    view: 'side', db: 'both',
    a: { ...STAND_SIDE, wF: [103, 90], wB: [103, 90] },
    b: { ...STAND_SIDE, head: [142, 58], sh: [128, 64], hip: [86, 84], eF: [128, 84], wF: [126, 104], eB: [128, 84], wB: [126, 104], kF: [98, 114], aF: [98, 144], kB: [96, 114], aB: [96, 144] },
  },
  bridge: {
    view: 'side', db: 'front',
    a: { ...SUPINE, eF: [76, 134], wF: [100, 128], eB: [76, 134], wB: [100, 128] },
    b: { ...SUPINE, hip: [104, 106], kF: [134, 100], kB: [132, 100], eF: [78, 118], wF: [100, 101], eB: [78, 118], wB: [100, 101] },
  },
  lunge: {
    view: 'side', db: 'both',
    a: STAND_SIDE,
    b: { ...STAND_SIDE, head: [100, 52], sh: [100, 67], hip: [98, 106], eF: [100, 87], wF: [101, 108], eB: [100, 87], wB: [101, 108], kF: [122, 110], aF: [120, 144], kB: [86, 136], aB: [62, 140], toeB: [56, 145] },
  },
  plank: {
    view: 'side', db: 'none',
    a: { head: [160, 92], sh: [145, 101], hip: [96, 106], eF: [145, 131], wF: [166, 132], eB: [143, 131], wB: [164, 132], kF: [66, 112], aF: [36, 119], kB: [66, 112], aB: [36, 119], toeF: [34, 128], toeB: [34, 128] },
    b: { head: [160, 91], sh: [145, 100], hip: [96, 103], eF: [145, 131], wF: [166, 132], eB: [143, 131], wB: [164, 132], kF: [66, 111], aF: [36, 119], kB: [66, 111], aB: [36, 119], toeF: [34, 128], toeB: [34, 128] },
  },
  sidePlank: {
    view: 'side', db: 'none',
    a: { head: [160, 86], sh: [146, 97], hip: [96, 124], eF: [146, 131], wF: [166, 132], eB: [126, 104], wB: [106, 112], kF: [64, 128], aF: [34, 136], kB: [64, 126], aB: [34, 134], toeF: [30, 140], toeB: [30, 138] },
    b: { head: [160, 84], sh: [146, 96], hip: [96, 106], eF: [146, 131], wF: [166, 132], eB: [124, 92], wB: [104, 98], kF: [64, 118], aF: [34, 130], kB: [64, 116], aB: [34, 128], toeF: [30, 136], toeB: [30, 134] },
  },
  deadBug: {
    view: 'side', db: 'none',
    a: { head: [52, 124], sh: [68, 128], hip: [116, 130], eF: [70, 106], wF: [72, 84], eB: [66, 106], wB: [64, 84], kF: [118, 100], aF: [142, 100], kB: [120, 100], aB: [144, 100], toeF: [150, 96], toeB: [152, 96] },
    b: { head: [52, 124], sh: [68, 128], hip: [116, 130], eF: [70, 106], wF: [72, 84], eB: [50, 116], wB: [30, 118], kF: [118, 100], aF: [142, 100], kB: [142, 124], aB: [170, 128], toeF: [150, 96], toeB: [176, 124] },
  },
  row: {
    view: 'side', db: 'both',
    a: { ...STAND_SIDE, head: [143, 62], sh: [130, 70], hip: [88, 86], eF: [130, 90], wF: [130, 110], eB: [130, 90], wB: [130, 110], kF: [98, 114], aF: [98, 144], kB: [96, 114], aB: [96, 144] },
    b: { ...STAND_SIDE, head: [143, 62], sh: [130, 70], hip: [88, 86], eF: [110, 74], wF: [118, 94], eB: [110, 74], wB: [118, 94], kF: [98, 114], aF: [98, 144], kB: [96, 114], aB: [96, 144] },
  },
  floorPress: {
    view: 'side', db: 'both',
    a: { ...SUPINE, eF: [62, 140], wF: [64, 114], eB: [60, 140], wB: [62, 114] },
    b: { ...SUPINE, eF: [60, 106], wF: [62, 82], eB: [58, 106], wB: [60, 82] },
  },
  shoulderPress: {
    view: 'front', db: 'both',
    a: { ...STAND_FRONT, eF: [76, 52], wF: [77, 32], eB: [124, 52], wB: [123, 32] },
    b: { ...STAND_FRONT, eF: [84, 24], wF: [88, 6], eB: [116, 24], wB: [112, 6] },
  },
  curl: {
    view: 'side', db: 'both',
    a: STAND_SIDE,
    b: { ...STAND_SIDE, wF: [116, 54], wB: [116, 54] },
  },
  stepUp: {
    view: 'side', db: 'both', prop: 'step',
    a: { head: [100, 33], sh: [100, 49], hip: [100, 89], eF: [100, 69], wF: [101, 91], eB: [100, 69], wB: [101, 91], kF: [122, 100], aF: [124, 124], kB: [96, 117], aB: [94, 144], toeF: [134, 125] },
    b: { head: [124, 10], sh: [124, 25], hip: [124, 64], eF: [124, 44], wF: [125, 66], eB: [124, 44], wB: [125, 66], kF: [126, 95], aF: [124, 124], kB: [118, 96], aB: [106, 114], toeF: [134, 125], toeB: [100, 118] },
  },
  calfRaise: {
    view: 'side', db: 'both',
    a: STAND_SIDE,
    b: { ...STAND_SIDE, head: [100, 22], sh: [100, 38], hip: [100, 78], eF: [100, 58], wF: [101, 80], eB: [100, 58], wB: [101, 80], kF: [101, 107], aF: [100, 136], kB: [99, 107], aB: [98, 136], toeF: [110, 145], toeB: [108, 145] },
  },
  lateralRaise: {
    view: 'front', db: 'both',
    a: STAND_FRONT,
    b: { ...STAND_FRONT, eF: [78, 48], wF: [58, 47], eB: [122, 48], wB: [142, 47] },
  },
  kickback: {
    view: 'side', db: 'both',
    a: { ...STAND_SIDE, head: [143, 62], sh: [130, 70], hip: [88, 86], eF: [110, 76], wF: [114, 98], eB: [110, 76], wB: [114, 98], kF: [98, 114], aF: [98, 144], kB: [96, 114], aB: [96, 144] },
    b: { ...STAND_SIDE, head: [143, 62], sh: [130, 70], hip: [88, 86], eF: [110, 76], wF: [88, 80], eB: [110, 76], wB: [88, 80], kF: [98, 114], aF: [98, 144], kB: [96, 114], aB: [96, 144] },
  },
  abduction: {
    view: 'side', db: 'none',
    a: { head: [34, 120], sh: [50, 128], hip: [100, 132], eF: [40, 112], wF: [30, 104], eB: [74, 128], wB: [92, 130], kF: [128, 140], aF: [100, 142], kB: [134, 133], aB: [168, 134], toeF: [96, 144], toeB: [176, 132] },
    b: { head: [34, 120], sh: [50, 128], hip: [100, 132], eF: [40, 112], wF: [30, 104], eB: [74, 128], wB: [92, 130], kF: [128, 140], aF: [100, 142], kB: [132, 116], aB: [162, 98], toeF: [96, 144], toeB: [170, 94] },
  },
  pushUp: {
    view: 'side', db: 'none', prop: 'bench',
    a: { head: [164, 70], sh: [150, 80], hip: [96, 112], eF: [156, 94], wF: [160, 108], eB: [154, 94], wB: [158, 108], kF: [66, 128], aF: [40, 143], kB: [66, 128], aB: [40, 143], toeF: [36, 146], toeB: [36, 146] },
    b: { head: [160, 88], sh: [146, 96], hip: [94, 120], eF: [138, 106], wF: [160, 108], eB: [136, 106], wB: [158, 108], kF: [66, 132], aF: [40, 143], kB: [66, 132], aB: [40, 143], toeF: [36, 146], toeB: [36, 146] },
  },
};

const pts = (...p: P[]) => p.map((q) => q.join(',')).join(' ');
const toe = (pose: Pose, side: 'F' | 'B'): P => (side === 'F' ? pose.toeF : pose.toeB) ?? [pose[`a${side}`][0] + 10, pose[`a${side}`][1] + 1];

function chains(p: Pose) {
  return {
    torso: pts(p.sh, p.hip),
    armF: pts(p.sh, p.eF, p.wF),
    armB: pts(p.sh, p.eB, p.wB),
    legF: pts(p.hip, p.kF, p.aF, toe(p, 'F')),
    legB: pts(p.hip, p.kB, p.aB, toe(p, 'B')),
    neck: pts(p.sh, p.head),
  };
}

function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

function Figure({ a, b, animate, db, ghost }: { a: Pose; b: Pose; animate: boolean; db: Def['db']; ghost?: boolean }) {
  const ca = chains(a);
  const cb = chains(b);
  const dur = '3.2s';
  const anim = (attr: string, va: string | number, vb: string | number) =>
    animate ? <animate attributeName={attr} values={`${va};${vb};${vb};${va};${va}`} keyTimes="0;0.4;0.5;0.9;1" dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1;0 0 1 1" /> : null;
  const line = (key: keyof ReturnType<typeof chains>, color: string, width: number) => (
    <polyline points={ca[key]} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {anim('points', ca[key], cb[key])}
    </polyline>
  );
  const dumbbell = (wa: P, wb: P, color: string) => (
    <g>
      <circle cx={wa[0]} cy={wa[1]} r={6} fill={color}>
        {anim('cx', wa[0], wb[0])}
        {anim('cy', wa[1], wb[1])}
      </circle>
    </g>
  );
  const op = ghost ? 0.28 : 1;
  return (
    <g opacity={op}>
      {line('armB', 'var(--sand)', 7)}
      {line('legB', 'var(--sand)', 8)}
      {db === 'both' ? dumbbell(a.wB, b.wB, 'var(--clay)') : null}
      {line('torso', 'var(--sage)', 10)}
      {line('neck', 'var(--sage)', 6)}
      {line('legF', 'var(--sage)', 8)}
      {line('armF', 'var(--sage)', 7)}
      <circle cx={a.head[0]} cy={a.head[1]} r={10} fill="var(--surface)" stroke="var(--sage)" strokeWidth={5}>
        {anim('cx', a.head[0], b.head[0])}
        {anim('cy', a.head[1], b.head[1])}
      </circle>
      {db === 'front' || db === 'both' ? dumbbell(a.wF, b.wF, 'var(--clay)') : null}
    </g>
  );
}

export function ExerciseIllustration({ pattern, label, className = '' }: { pattern: Pattern; label: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const def = DEFS[pattern];
  return (
    <figure className={`overflow-hidden rounded-3xl bg-surface-2 ${className}`}>
      <svg viewBox="0 0 200 160" className="h-full w-full" role="img" aria-label={`Ilustración esquemática original de ${label}: muestra la posición inicial y la final.`}>
        <line x1="10" y1="146" x2="190" y2="146" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
        {def.prop === 'step' ? <rect x="108" y="125" width="44" height="21" rx="4" fill="var(--line)" /> : null}
        {def.prop === 'bench' ? <rect x="150" y="108" width="36" height="38" rx="4" fill="var(--line)" /> : null}
        {reduced ? (
          <>
            <Figure a={def.a} b={def.a} animate={false} db={def.db} ghost />
            <Figure a={def.b} b={def.b} animate={false} db={def.db} />
          </>
        ) : (
          <Figure a={def.a} b={def.b} animate db={def.db} />
        )}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
