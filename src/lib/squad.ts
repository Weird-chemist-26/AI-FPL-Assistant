import type { FplPlayer, Pos } from "./fpl.functions";

export const SQUAD_RULES: Record<Pos, number> = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };
export const MAX_PER_CLUB = 3;
export const BUDGET = 100.0;
export const MIN_XI: Record<Pos, number> = { GKP: 1, DEF: 3, MID: 2, FWD: 1 };
export const POS_ORDER: Pos[] = ["GKP", "DEF", "MID", "FWD"];

export interface Squad {
  squad: FplPlayer[];
  xi: FplPlayer[];
  bench: FplPlayer[];
  captain: FplPlayer | null;
  vice: FplPlayer | null;
  cost: number;
  formation: string;
}

function valid(pool: FplPlayer[], budget: number): FplPlayer[] {
  const need = { ...SQUAD_RULES };
  const clubs = new Map<number, number>();
  const picked: FplPlayer[] = [];
  let spend = 0;

  const cheapest = (pos: Pos) =>
    pool.filter((p) => p.pos === pos).reduce((m, p) => Math.min(m, p.price), 99);

  const byValue = [...pool].sort((a, b) => b.score / b.price - a.score / a.price);

  const remainingMin = () =>
    (Object.keys(need) as Pos[]).reduce((s, k) => s + need[k] * cheapest(k), 0);

  for (const p of byValue) {
    if (need[p.pos] <= 0) continue;
    if ((clubs.get(p.teamId) ?? 0) >= MAX_PER_CLUB) continue;
    need[p.pos] -= 1;
    const rest = remainingMin();
    if (spend + p.price + rest > budget) {
      need[p.pos] += 1;
      continue;
    }
    picked.push(p);
    spend += p.price;
    clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
  }

  for (let round = 0; round < 3; round++) {
    for (const cand of pool) {
      if (picked.some((p) => p.id === cand.id)) continue;
      const worst = picked
        .filter((p) => p.pos === cand.pos && p.score < cand.score)
        .sort((a, b) => a.score - b.score)[0];
      if (!worst) continue;
      const clubCount = (clubs.get(cand.teamId) ?? 0) - (cand.teamId === worst.teamId ? 1 : 0);
      if (clubCount >= MAX_PER_CLUB) continue;
      const newSpend = spend - worst.price + cand.price;
      if (newSpend > budget) continue;
      picked[picked.indexOf(worst)] = cand;
      spend = newSpend;
      clubs.set(worst.teamId, (clubs.get(worst.teamId) ?? 1) - 1);
      clubs.set(cand.teamId, (clubs.get(cand.teamId) ?? 0) + 1);
    }
  }
  return picked;
}

/** Turn any 15 players into an XI / bench / captain view. */
export function organise(squad: FplPlayer[]): Squad {
  const sorted = [...squad].sort((a, b) => b.score - a.score);
  const xi: FplPlayer[] = [];
  const counts: Record<Pos, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const pos of POS_ORDER) {
    for (const p of sorted.filter((s) => s.pos === pos).slice(0, MIN_XI[pos])) {
      xi.push(p);
      counts[pos]++;
    }
  }
  for (const p of sorted) {
    if (xi.length >= 11) break;
    if (xi.some((x) => x.id === p.id)) continue;
    if (p.pos === "GKP") continue;
    if (counts[p.pos] >= SQUAD_RULES[p.pos]) continue;
    xi.push(p);
    counts[p.pos]++;
  }

  const bench = squad
    .filter((p) => !xi.some((x) => x.id === p.id))
    .sort((a, b) => (a.pos === "GKP" ? -1 : b.pos === "GKP" ? 1 : b.score - a.score));

  const outfield = [...xi].filter((p) => p.pos !== "GKP").sort((a, b) => b.score - a.score);

  return {
    squad,
    xi: xi.sort(
      (a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.score - a.score,
    ),
    bench,
    captain: outfield[0] ?? null,
    vice: outfield[1] ?? null,
    cost: Math.round(squad.reduce((s, p) => s + p.price, 0) * 10) / 10,
    formation: `${counts.DEF}-${counts.MID}-${counts.FWD}`,
  };
}

export function buildSquad(all: FplPlayer[], budget = BUDGET): Squad {
  const pool = all.filter((p) => p.score > 0 && p.status !== "u" && p.status !== "n");
  return organise(valid(pool, budget));
}

/* ---------------- Multiple suggestions ---------------- */

export interface Strategy {
  id: string;
  name: string;
  blurb: string;
  weight: (p: FplPlayer) => number;
}

export const STRATEGIES: Strategy[] = [
  { id: "balanced", name: "Balanced", blurb: "The all-round rating — form, xGI, fixtures and minutes.", weight: (p) => p.score },
  { id: "value", name: "Value hunt", blurb: "Points per million — cheap enablers to fund premiums.", weight: (p) => p.score * (7 / Math.max(4, p.price)) },
  { id: "premium", name: "Stars & scrubs", blurb: "Loads the big hitters and saves elsewhere.", weight: (p) => p.score * (1 + p.price / 12) },
  { id: "fixtures", name: "Fixture swing", blurb: "Leans on clubs with the kindest next run.", weight: (p) => p.score * (1 + (3 - p.fdr) * 0.35) },
  { id: "setpiece", name: "Set-piece kings", blurb: "Penalty, free-kick and corner takers first.", weight: (p) => p.score * (1 + p.setPieceScore / 12) },
  { id: "differential", name: "Differentials", blurb: "Low-ownership picks to climb the ranks.", weight: (p) => p.score * (1 + Math.max(0, 15 - p.selectedBy) / 20) },
];

export interface Suggestion extends Strategy {
  built: Squad;
}

export function buildSuggestions(all: FplPlayer[], budget = BUDGET): Suggestion[] {
  const pool = all.filter((p) => p.score > 0 && p.status !== "u" && p.status !== "n");
  return STRATEGIES.map((s) => {
    const weighted = pool.map((p) => ({ ...p, score: Math.round(s.weight(p) * 10) / 10 }));
    const picked = valid(weighted, budget);
    // restore true ratings for display
    const real = picked.map((p) => all.find((a) => a.id === p.id) ?? p);
    return { ...s, built: organise(real) };
  });
}

/* ---------------- Editing helpers ---------------- */

export interface SwapCheck {
  ok: boolean;
  reason?: string;
}

export function canSwap(
  squad: FplPlayer[],
  out: FplPlayer,
  incoming: FplPlayer,
  budget: number,
): SwapCheck {
  if (squad.some((p) => p.id === incoming.id)) return { ok: false, reason: "Already in squad" };
  if (incoming.pos !== out.pos) return { ok: false, reason: `Needs a ${out.pos}` };
  const cost = squad.reduce((s, p) => s + p.price, 0) - out.price + incoming.price;
  if (cost > budget + 1e-9) return { ok: false, reason: "Over budget" };
  const clubCount = squad.filter(
    (p) => p.teamId === incoming.teamId && p.id !== out.id,
  ).length;
  if (clubCount >= MAX_PER_CLUB) return { ok: false, reason: "Max 3 per club" };
  return { ok: true };
}

export function applySwap(squad: FplPlayer[], out: FplPlayer, incoming: FplPlayer): FplPlayer[] {
  return squad.map((p) => (p.id === out.id ? incoming : p));
}
