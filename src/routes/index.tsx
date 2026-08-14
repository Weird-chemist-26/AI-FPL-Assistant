import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getFplData, type FplPlayer, type Pos } from "@/lib/fpl.functions";
import { buildSquad, BUDGET } from "@/lib/squad";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gaffer — FPL Gameweek Picker & Squad Builder" },
      {
        name: "description",
        content:
          "Rank Fantasy Premier League players by form, set-piece duties and fixture difficulty, then build a legal 100.0m squad for the next gameweek.",
      },
      { property: "og:title", content: "Gaffer — FPL Gameweek Picker & Squad Builder" },
      {
        property: "og:description",
        content:
          "Live FPL data ranked by form, xGI, set pieces and fixture swing — with a rules-compliant squad and captain suggestion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const POSITIONS: (Pos | "ALL")[] = ["ALL", "GKP", "DEF", "MID", "FWD"];

function diffClass(d: number) {
  if (d <= 2) return "fdr fdr-2";
  if (d === 3) return "fdr fdr-3";
  if (d === 4) return "fdr fdr-4";
  return "fdr fdr-5";
}

function SetPieceTags({ p }: { p: FplPlayer }) {
  const tags: string[] = [];
  if (p.penalties && p.penalties <= 2) tags.push(`PEN ${p.penalties}`);
  if (p.freekicks && p.freekicks <= 2) tags.push(`FK ${p.freekicks}`);
  if (p.corners && p.corners <= 2) tags.push(`COR ${p.corners}`);
  if (!tags.length) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="tag-setpiece">
          {t}
        </span>
      ))}
    </span>
  );
}

function Fixtures({ p }: { p: FplPlayer }) {
  if (!p.fixtures.length) return <span className="text-muted-foreground text-xs">BLANK</span>;
  return (
    <span className="flex gap-1">
      {p.fixtures.map((f, i) => (
        <span key={i} className={diffClass(f.diff)} title={`FDR ${f.diff}`}>
          {f.home ? f.opp : f.opp.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

function Index() {
  const [horizon, setHorizon] = useState(5);
  const [pos, setPos] = useState<Pos | "ALL">("ALL");
  const [maxPrice, setMaxPrice] = useState(15);
  const [search, setSearch] = useState("");
  const [setPieceOnly, setSetPieceOnly] = useState(false);
  const [budget, setBudget] = useState(BUDGET);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fpl", horizon],
    queryFn: () => getFplData({ data: { horizon } }),
    staleTime: 1000 * 60 * 10,
  });

  const players = data?.players ?? [];

  const filtered = useMemo(
    () =>
      players.filter(
        (p) =>
          (pos === "ALL" || p.pos === pos) &&
          p.price <= maxPrice &&
          (!setPieceOnly || p.setPieceScore > 0) &&
          (search.trim() === "" ||
            `${p.name} ${p.team}`.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [players, pos, maxPrice, setPieceOnly, search],
  );

  const squad = useMemo(() => (players.length ? buildSquad(players, budget) : null), [players, budget]);

  const deadline = data?.deadline
    ? new Date(data.deadline).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pitch-glow">
        <header className="mx-auto max-w-6xl px-5 pt-12 pb-8">
          <p className="eyebrow">Official FPL data · live</p>
          <h1 className="display text-5xl sm:text-6xl">The Gaffer</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Player picks ranked on form, expected involvement, set-piece duty and fixture swing —
            then assembled into a squad that obeys every Fantasy Premier League rule.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="stat-chip">
              <span>Gameweek</span>
              <strong>{data?.gameweek ?? "—"}</strong>
            </div>
            <div className="stat-chip">
              <span>Deadline</span>
              <strong>{deadline ?? "—"}</strong>
            </div>
            <div className="stat-chip">
              <span>Fixture horizon</span>
              <strong>next {horizon}</strong>
            </div>
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-20">
        {isError && (
          <p className="panel border-destructive/50 text-sm">
            Couldn't load FPL data: {(error as Error)?.message}
          </p>
        )}

        {/* Controls */}
        <section className="panel mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="ctl-label">Position</label>
            <div className="flex flex-wrap gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  className={p === pos ? "pill pill-active" : "pill"}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="ctl-label">Max price · £{maxPrice.toFixed(1)}m</label>
            <input
              type="range"
              min={3.8}
              max={15}
              step={0.1}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="range"
            />
            <label className="ctl-label mt-3">Fixtures ahead · {horizon}</label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="range"
            />
          </div>
          <div>
            <label className="ctl-label">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Player or club…"
              className="field"
            />
            <button
              onClick={() => setSetPieceOnly((v) => !v)}
              className={setPieceOnly ? "pill pill-active mt-3" : "pill mt-3"}
            >
              Set-piece takers only
            </button>
          </div>
          <div>
            <label className="ctl-label">Squad budget · £{budget.toFixed(1)}m</label>
            <input
              type="range"
              min={80}
              max={110}
              step={0.5}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="range"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              FPL rules enforced: 2 GKP · 5 DEF · 5 MID · 3 FWD, max 3 per club.
            </p>
          </div>
        </section>

        {/* Lineup on the pitch */}
        {squad && (
          <section className="mb-10">
            <div className="section-head">
              <h2 className="display text-2xl">Lineup</h2>
              <span className="text-xs text-muted-foreground">
                {squad.formation} · captain {squad.captain?.name ?? "—"}
              </span>
            </div>
            <div className="panel">
              <div className="pitch">
                {(["GKP", "DEF", "MID", "FWD"] as Pos[]).map((row) => (
                  <div key={row} className="pitch-row">
                    {squad.xi
                      .filter((p) => p.pos === row)
                      .map((p) => (
                        <div key={p.id} className="shirt">
                          <span className="pos-badge">{p.pos}</span>
                          <span className="shirt-name">
                            {p.name}
                            {squad.captain?.id === p.id && <span className="armband">C</span>}
                            {squad.vice?.id === p.id && <span className="armband armband-v">V</span>}
                          </span>
                          <span className="shirt-meta">{p.team}</span>
                          <span className="shirt-price">£{p.price.toFixed(1)}m</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="ctl-label">Bench</p>
                <div className="flex flex-wrap gap-2">
                  {squad.bench.map((p) => (
                    <span key={p.id} className="bench-chip">
                      <b>{p.pos}</b> {p.name} · £{p.price.toFixed(1)}m
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
                  <span className="ctl-label">Total budget</span>
                  <span>
                    <b className="score">£{squad.cost.toFixed(1)}m</b>
                    <span className="text-muted-foreground"> of £{budget.toFixed(1)}m used</span>
                  </span>
                </div>
                <div className="budget-bar mt-2">
                  <span style={{ width: `${Math.min(100, (squad.cost / budget) * 100)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    XI cost £{squad.xi.reduce((s, p) => s + p.price, 0).toFixed(1)}m
                  </span>
                  <span>
                    Bench cost £{squad.bench.reduce((s, p) => s + p.price, 0).toFixed(1)}m
                  </span>
                  <span>Remaining £{(budget - squad.cost).toFixed(1)}m</span>
                  <span>{squad.squad.length} players</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Suggested squad */}
        {squad && (
          <section className="mb-10">
            <div className="section-head">
              <h2 className="display text-2xl">Suggested squad</h2>
              <span className="text-xs text-muted-foreground">
                {squad.formation} · £{squad.cost.toFixed(1)}m spent · £
                {(budget - squad.cost).toFixed(1)}m left
              </span>
            </div>
            <div className="panel">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {squad.xi.map((p) => (
                  <div key={p.id} className="squad-card">
                    <div>
                      <span className="pos-badge">{p.pos}</span>
                      <span className="ml-2 font-semibold">{p.name}</span>
                      {squad.captain?.id === p.id && <span className="armband">C</span>}
                      {squad.vice?.id === p.id && <span className="armband armband-v">V</span>}
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {p.team} · £{p.price.toFixed(1)}m
                        <Fixtures p={p} />
                      </div>
                    </div>
                    <span className="score">{p.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              {squad.captain && (
                <p className="mt-4 text-sm">
                  <span className="text-accent font-semibold">Captain:</span> {squad.captain.name} (
                  {squad.captain.team}) — best combination of form and fixture this week.
                </p>
              )}
            </div>
          </section>
        )}


        {/* Rankings */}
        <section>
          <div className="section-head">
            <h2 className="display text-2xl">Player rankings</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} players</span>
          </div>
          <div className="panel overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>£</th>
                  <th>Form</th>
                  <th>PPG</th>
                  <th>xGI/90</th>
                  <th>Set pieces</th>
                  <th>Fixtures (FDR {data?.horizon ?? horizon})</th>
                  <th className="text-right">Rating</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      Pulling live FPL data…
                    </td>
                  </tr>
                )}
                {filtered.slice(0, 80).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-semibold">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.team}</span>
                      {p.news && <div className="news">{p.news}</div>}
                    </td>
                    <td>
                      <span className="pos-badge">{p.pos}</span>
                    </td>
                    <td>{p.price.toFixed(1)}</td>
                    <td>{p.form.toFixed(1)}</td>
                    <td>{p.ppg.toFixed(1)}</td>
                    <td>{p.xgi90.toFixed(2)}</td>
                    <td>
                      <SetPieceTags p={p} />
                    </td>
                    <td>
                      <Fixtures p={p} />
                    </td>
                    <td className="text-right">
                      <span className="score">{p.score.toFixed(1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Rating blends form, points per game, expected points, ICT, xGI/90 and set-piece order,
            multiplied by fixture difficulty and minutes reliability, then adjusted for injury news.
            Uppercase fixture = home, lowercase = away.
          </p>
        </section>
      </div>
    </main>
  );
}
