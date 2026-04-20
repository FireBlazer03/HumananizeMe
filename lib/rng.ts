// Seeded PRNG (Mulberry32) for deterministic humanization.
// When a seed is supplied, every Math.random replacement becomes reproducible,
// enabling regression tests and reproducible bug reports.

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-local active RNG. Defaults to Math.random when no seed is set.
let active: Rng = Math.random;

export function setActiveRng(seed: number | undefined): void {
  active = seed === undefined ? Math.random : makeRng(seed);
}

export function rng(): number {
  return active();
}

export function rngPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(active() * arr.length)];
}
