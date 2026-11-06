/**
 * BrandShield AI — Seeded Pseudo-Random Number Generator
 * Phase 10A: Training Dataset Builder
 *
 * Implements a 32-bit Mulberry32 PRNG for fully deterministic,
 * reproducible dataset synthesis across platforms and runs.
 */

export class DeterministicPRNG {
  private state: number;

  constructor(seed: number = 20261106) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a pseudo-random floating point number in [0, 1).
   */
  public next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a pseudo-random boolean with probability p of being true.
   */
  public nextBool(p: number = 0.5): boolean {
    return this.next() < p;
  }

  /**
   * Randomly picks one item from an array.
   */
  public pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  /**
   * Shuffles an array in place using Fisher-Yates algorithm.
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Randomly samples k elements without replacement.
   */
  public sample<T>(array: readonly T[], k: number): T[] {
    const copy = [...array];
    this.shuffle(copy);
    return copy.slice(0, Math.min(k, copy.length));
  }
}

