export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const round = (x: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

export const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Ordinary least squares slope of y over index (units of y per step). */
export function slope(ys: readonly number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (ys[i]! - ym);
    den += (i - xm) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Trapezoidal response: 0 below lo, ramps to 1 at optLo, plateau to optHi, ramps to 0 at hi. */
export function trapezoid(x: number, lo: number, optLo: number, optHi: number, hi: number): number {
  if (x <= lo || x >= hi) return 0;
  if (x < optLo) return (x - lo) / (optLo - lo);
  if (x <= optHi) return 1;
  return (hi - x) / (hi - optHi);
}

/** Deterministic PRNG (mulberry32) so synthetic climate is reproducible per location. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard normal from a uniform source. */
export function gaussian(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
