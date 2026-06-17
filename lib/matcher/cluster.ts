// Pure module — imports nothing from React/Next.
// Stage 3 of the matcher: clustering. Union-find over pair scores above
// threshold. Items never connected by a high-confidence edge remain in their
// own singleton clusters — that's the "indie no-barcode product fractures
// when its alias is missing" outcome the coverage-bias test asserts.
//
// Seam: correlation clustering plugs in here later when we want to handle
// transitivity violations (A↔B, B↔C, but A and C disagree).

export class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  add(id: string): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: string): string {
    this.add(id);
    let parent = this.parent.get(id)!;
    if (parent !== id) {
      parent = this.find(parent);
      this.parent.set(id, parent);
    }
    return parent;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }

  clusters(): string[][] {
    const out = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const arr = out.get(root) ?? [];
      arr.push(id);
      out.set(root, arr);
    }
    return [...out.values()];
  }
}

export interface ScoredPair {
  a: string;
  b: string;
  score: number;
}

/**
 * Cluster `ids` using only the pairs whose score meets `threshold`. Items
 * not touched by any high-confidence edge end up as singleton clusters.
 */
export function clusterByEdges(
  ids: ReadonlyArray<string>,
  pairs: ReadonlyArray<ScoredPair>,
  threshold: number,
): string[][] {
  const uf = new UnionFind();
  for (const id of ids) uf.add(id);
  for (const p of pairs) {
    if (p.score >= threshold) uf.union(p.a, p.b);
  }
  return uf.clusters();
}
