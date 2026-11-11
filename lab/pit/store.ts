/**
 * Point-in-time (bitemporal) store.
 *   validAt : when the fact is true in the world (a price date, a fiscal period end)
 *   knownAt : when it became public / available to a trader (a close time, a filing acceptance time)
 * Restatements are new revisions with the same validAt and a later knownAt: the old value stays visible
 * to any query made `asOf` a date before the correction, exactly as it was visible to a trader back then.
 */
export interface PitRecord<T> {
  key: string;
  validAt: number;
  knownAt: number;
  value: T;
}

export class LookaheadError extends Error {
  constructor(public asOf: number, public requested: number, what: string) {
    super(`Look-ahead blocked: ${what} requested at ${new Date(requested).toISOString()} but decision time is ${new Date(asOf).toISOString()}`);
  }
}

export class PitStore<T> {
  private rows = new Map<string, PitRecord<T>[]>();

  put(rec: PitRecord<T>) {
    if (rec.knownAt < rec.validAt && !(rec as { allowEarly?: boolean }).allowEarly) {
      // forward-looking facts (e.g. guidance for a future period) are allowed but must be explicitly constructed; default is a data error
      throw new Error(`knownAt (${rec.knownAt}) precedes validAt (${rec.validAt}) for ${rec.key}`);
    }
    const arr = this.rows.get(rec.key) ?? [];
    arr.push(rec);
    arr.sort((a, b) => a.validAt - b.validAt || a.knownAt - b.knownAt);
    this.rows.set(rec.key, arr);
  }
  putMany(recs: PitRecord<T>[]) {
    recs.forEach((r) => this.put(r));
  }
  keys(): string[] {
    return [...this.rows.keys()];
  }

  /** Series as it was visible at `asOf`: one value per validAt, using the latest revision known by then. */
  series(key: string, asOf: number): PitRecord<T>[] {
    const out = new Map<number, PitRecord<T>>();
    for (const r of this.rows.get(key) ?? []) {
      if (r.knownAt > asOf) continue;
      const cur = out.get(r.validAt);
      if (!cur || r.knownAt >= cur.knownAt) out.set(r.validAt, r);
    }
    return [...out.values()].sort((a, b) => a.validAt - b.validAt);
  }
  /** The latest fact visible at `asOf`. */
  latest(key: string, asOf: number): PitRecord<T> | null {
    const s = this.series(key, asOf);
    return s.length ? s[s.length - 1] : null;
  }
  /** Every revision of one fact, for auditing restatements. */
  revisions(key: string, validAt: number): PitRecord<T>[] {
    return (this.rows.get(key) ?? []).filter((r) => r.validAt === validAt).sort((a, b) => a.knownAt - b.knownAt);
  }
  /** Raw access for diagnostics only. Never hand this to an agent. */
  rawAll(key: string): PitRecord<T>[] {
    return [...(this.rows.get(key) ?? [])];
  }
}

/**
 * The only handle agents and strategies are given. It is bound to a decision time and it refuses
 * (throws LookaheadError) any request for information that was not yet known at that time.
 */
export class PitView<T> {
  constructor(private store: PitStore<T>, readonly asOf: number) {}
  series(key: string, upTo: number = this.asOf): PitRecord<T>[] {
    if (upTo > this.asOf) throw new LookaheadError(this.asOf, upTo, `series(${key})`);
    return this.store.series(key, this.asOf).filter((r) => r.validAt <= upTo);
  }
  latest(key: string): PitRecord<T> | null {
    return this.store.latest(key, this.asOf);
  }
  keys() {
    return this.store.keys();
  }
  withAsOf(t: number) {
    if (t > this.asOf) throw new LookaheadError(this.asOf, t, 'withAsOf');
    return new PitView(this.store, t);
  }
}
