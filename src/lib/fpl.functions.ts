import { createServerFn } from "@tanstack/react-start";

const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
const BASE = "https://fantasy.premierleague.com/api";

export type Pos = "GKP" | "DEF" | "MID" | "FWD";

export interface FplPlayer {
  id: number;
  name: string;
  team: string;
  teamId: number;
  pos: Pos;
  price: number;
  form: number;
  ppg: number;
  ict: number;
  epNext: number;
  minutes: number;
  starts: number;
  totalPoints: number;
  selectedBy: number;
  xgi90: number;
  status: string;
  news: string;
  chanceNext: number | null;
  penalties: number | null;
  corners: number | null;
  freekicks: number | null;
  setPieceScore: number;
  fdr: number;
  fixtures: { opp: string; home: boolean; diff: number }[];
  score: number;
}

export interface FplData {
  gameweek: number | null;
  deadline: string | null;
  horizon: number;
  players: FplPlayer[];
}

const POS: Record<number, Pos> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const n = (v: unknown) => Number(v ?? 0) || 0;

export const getFplData = createServerFn({ method: "GET" })
  .inputValidator((input: { horizon?: number } | undefined) => ({
    horizon: Math.min(Math.max(input?.horizon ?? 5, 1), 10),
  }))
  .handler(async ({ data }): Promise<FplData> => {
    const [bsRes, fxRes] = await Promise.all([
      fetch(`${BASE}/bootstrap-static/`, { headers: UA }),
      fetch(`${BASE}/fixtures/`, { headers: UA }),
    ]);
    if (!bsRes.ok || !fxRes.ok) throw new Error("Could not reach the official FPL servers");

    const bs = (await bsRes.json()) as any;
    const fixtures = (await fxRes.json()) as any[];

    const teams = new Map<number, { name: string; short: string }>(
      bs.teams.map((t: any) => [t.id, { name: t.name, short: t.short_name }]),
    );

    const current = bs.events.find((e: any) => e.is_next) ?? bs.events.find((e: any) => e.is_current);
    const gw: number | null = current?.id ?? null;
    const upcoming = gw ? Array.from({ length: data.horizon }, (_, i) => gw + i) : [];

    const byTeam = new Map<number, { opp: string; home: boolean; diff: number; event: number }[]>();
    for (const f of fixtures) {
      if (!f.event || !upcoming.includes(f.event)) continue;
      const h = byTeam.get(f.team_h) ?? [];
      h.push({ opp: teams.get(f.team_a)?.short ?? "?", home: true, diff: f.team_h_difficulty, event: f.event });
      byTeam.set(f.team_h, h);
      const a = byTeam.get(f.team_a) ?? [];
      a.push({ opp: teams.get(f.team_h)?.short ?? "?", home: false, diff: f.team_a_difficulty, event: f.event });
      byTeam.set(f.team_a, a);
    }
    for (const list of byTeam.values()) list.sort((x, y) => x.event - y.event);

    const players: FplPlayer[] = bs.elements
      .filter((e: any) => !e.removed)
      .map((e: any): FplPlayer => {
        const fx = (byTeam.get(e.team) ?? []).map((f) => ({ opp: f.opp, home: f.home, diff: f.diff }));
        const fdr = fx.length ? fx.reduce((s, f) => s + f.diff, 0) / fx.length : 3;
        const pen = e.penalties_order as number | null;
        const cor = e.corners_and_indirect_freekicks_order as number | null;
        const fk = e.direct_freekicks_order as number | null;
        const rank = (o: number | null, w: number) => (o === 1 ? w : o === 2 ? w * 0.45 : o === 3 ? w * 0.2 : 0);
        const setPieceScore = rank(pen, 10) + rank(fk, 5) + rank(cor, 4);

        const form = n(e.form);
        const ppg = n(e.points_per_game);
        const ict = n(e.ict_index);
        const epNext = n(e.ep_next);
        const mins = n(e.minutes);
        const xgi90 = n(e.expected_goal_involvements_per_90);

        // Availability multiplier (FPL rules: injured/suspended players score nothing)
        const chance = e.chance_of_playing_next_round as number | null;
        const avail =
          e.status === "u" || e.status === "n"
            ? 0
            : chance !== null
              ? chance / 100
              : e.status === "d"
                ? 0.6
                : 1;

        // Fixture multiplier: FDR 2 -> 1.25, FDR 3 -> 1.0, FDR 5 -> 0.5
        const fixtureMult = 1 + (3 - fdr) * 0.25;
        const minutesConf = Math.min(1, mins / 1800) * 0.6 + Math.min(1, n(e.starts) / 20) * 0.4;

        const raw =
          form * 5 +
          ppg * 3.5 +
          epNext * 3 +
          ict * 0.12 +
          xgi90 * 8 +
          setPieceScore * 0.9 +
          n(e.total_points) * 0.03;

        const score = raw * fixtureMult * (0.35 + 0.65 * minutesConf) * avail;

        return {
          id: e.id,
          name: e.web_name,
          team: teams.get(e.team)?.short ?? "?",
          teamId: e.team,
          pos: POS[e.element_type] ?? "MID",
          price: e.now_cost / 10,
          form,
          ppg,
          ict,
          epNext,
          minutes: mins,
          starts: n(e.starts),
          totalPoints: n(e.total_points),
          selectedBy: n(e.selected_by_percent),
          xgi90,
          status: e.status,
          news: e.news ?? "",
          chanceNext: chance,
          penalties: pen,
          corners: cor,
          freekicks: fk,
          setPieceScore,
          fdr: Math.round(fdr * 10) / 10,
          fixtures: fx,
          score: Math.round(score * 10) / 10,
        };
      })
      .sort((a: FplPlayer, b: FplPlayer) => b.score - a.score);

    return {
      gameweek: gw,
      deadline: current?.deadline_time ?? null,
      horizon: data.horizon,
      players,
    };
  });
