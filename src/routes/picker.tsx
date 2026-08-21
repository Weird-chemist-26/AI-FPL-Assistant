import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getFplData, type FplPlayer, type Pos } from "@/lib/fpl.functions";
import {
  BUDGET,
  MAX_PER_CLUB,
  POS_ORDER,
  applySwap,
  buildSuggestions,
  canSwap,
  organise,
} from "@/lib/squad";
import { Shirt } from "@/components/Shirt";

export const Route = createFileRoute("/picker")({
  head: () => ({
    meta: [
      { title: "Gaffer — FPL Gameweek Picker & Squad Builder" },
      {
        name: "description",
        content:
          "Rank Fantasy Premier League players by form, set-piece duties and fixture difficulty, then build and edit a legal 100.0m squad on the pitch.",
      },
      { property: "og:title", content: "Gaffer — FPL Gameweek Picker & Squad Builder" },
      {
        property: "og:description",
        content:
          "Live FPL data ranked by form, xGI, set pieces and fixture swing — with multiple squad options, kit-accurate lineups and a draft board.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const POSITIONS: (Pos | "ALL")[] = ["ALL", "GKP", "DEF", "MID", "FWD"];
const DRAFT_KEY = "gaffer-draft";

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

  const [strategyId, setStrategyId] = useState("balanced");
  const [myIds, setMyIds] = useState<number[] | null>(null);
  const [swapTarget, setSwapTarget] = useState<FplPlayer | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [draftIds, setDraftIds] = useState<number[]>([]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fpl", horizon],
    queryFn: () => getFplData({ data: { horizon } }),
    staleTime: 1000 * 60 * 10,
  });

  const players = data?.players ?? [];
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Draft board persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraftIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftIds));
    } catch {
      /* ignore */
    }
  }, [draftIds]);

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

  const suggestions = useMemo(
    () => (players.length ? buildSuggestions(players, budget) : []),
    [players, budget],
  );

  const active = suggestions.find((s) => s.id === strategyId) ?? suggestions[0];

  // Editable squad: user edits override the suggestion until reset.
  const mySquadPlayers = useMemo(() => {
    if (myIds) return myIds.map((id) => byId.get(id)).filter(Boolean) as FplPlayer[];
    return active?.built.squad ?? [];
  }, [myIds, byId, active]);

  const squad = useMemo(
    () => (mySquadPlayers.length === 15 ? organise(mySquadPlayers) : (active?.built ?? null)),
    [mySquadPlayers, active],
  );

  const edited = myIds !== null;

  function pickStrategy(id: string) {
    setStrategyId(id);
    setMyIds(null);
  }

  function doSwap(incoming: FplPlayer) {
    if (!swapTarget || !squad) return;
    const next = applySwap(squad.squad, swapTarget, incoming);
    setMyIds(next.map((p) => p.id));
    setSwapTarget(null);
    setSwapSearch("");
  }

  const swapCandidates = useMemo(() => {
    if (!swapTarget || !squad) return [];
    return players
      .filter((p) => p.pos === swapTarget.pos && p.id !== swapTarget.id)
      .filter(
        (p) =>
          swapSearch.trim() === "" ||
          `${p.name} ${p.team}`.toLowerCase().includes(swapSearch.trim().toLowerCase()),
      )
      .slice(0, 60);
  }, [players, swapTarget, squad, swapSearch]);

  const draftPlayers = draftIds.map((id) => byId.get(id)).filter(Boolean) as FplPlayer[];
  const draftCost = Math.round(draftPlayers.reduce((s, p) => s + p.price, 0) * 10) / 10;
  const toggleDraft = (id: number) =>
    setDraftIds((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

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
              FPL rules enforced: 2 GKP · 5 DEF · 5 MID · 3 FWD, max {MAX_PER_CLUB} per club.
            </p>
          </div>
        </section>

        {/* Squad options */}
        {suggestions.length > 0 && (
          <section className="mb-8">
            <div className="section-head">
              <h2 className="display text-2xl">Squad options</h2>
              <span className="text-xs text-muted-foreground">
                {suggestions.length} different teams built from live data
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickStrategy(s.id)}
                  className={
                    s.id === strategyId ? "strategy-card is-active" : "strategy-card"
                  }
                >
                  <span className="flex items-center justify-between">
                    <b className="text-sm">{s.name}</b>
                    <span className="score text-base">£{s.built.cost.toFixed(1)}m</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{s.blurb}</span>
                  <span className="mt-2 block text-xs">
                    {s.built.formation} · captain {s.built.captain?.name ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Lineup on the pitch */}
        {squad && (
          <section className="mb-10">
            <div className="section-head">
              <h2 className="display text-2xl">Lineup</h2>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {squad.formation} · {edited ? "your edits" : active?.name}
                {edited && (
                  <button onClick={() => setMyIds(null)} className="pill">
                    Reset to suggestion
                  </button>
                )}
              </span>
            </div>
            <div className="panel">
              <p className="mb-3 text-xs text-muted-foreground">
                Tap any shirt to swap that player — budget, position and 3-per-club limits are
                checked for you.
              </p>
              <div className="pitch">
                {POS_ORDER.map((row) => (
                  <div key={row} className="pitch-row">
                    {squad.xi
                      .filter((p) => p.pos === row)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSwapTarget(p)}
                          className="shirt-tile"
                          title={`Swap ${p.name}`}
                        >
                          <Shirt team={p.team} gk={p.pos === "GKP"} size={38} />
                          <span className="shirt-name">
                            {p.name}
                            {squad.captain?.id === p.id && <span className="armband">C</span>}
                            {squad.vice?.id === p.id && <span className="armband armband-v">V</span>}
                          </span>
                          <span className="shirt-meta">{p.team}</span>
                          <span className="shirt-price">£{p.price.toFixed(1)}m</span>
                        </button>
                      ))}
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="ctl-label">Bench</p>
                <div className="flex flex-wrap gap-2">
                  {squad.bench.map((p) => (
                    <button key={p.id} onClick={() => setSwapTarget(p)} className="bench-chip">
                      <b>{p.pos}</b> {p.name} · £{p.price.toFixed(1)}m
                    </button>
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
                  <span>XI cost £{squad.xi.reduce((s, p) => s + p.price, 0).toFixed(1)}m</span>
                  <span>Bench cost £{squad.bench.reduce((s, p) => s + p.price, 0).toFixed(1)}m</span>
                  <span>Remaining £{(budget - squad.cost).toFixed(1)}m</span>
                  <span>{squad.squad.length} players</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Draft board */}
        <section className="mb-10">
          <div className="section-head">
            <h2 className="display text-2xl">Draft board</h2>
            <span className="text-xs text-muted-foreground">
              {draftPlayers.length} rough picks · £{draftCost.toFixed(1)}m
            </span>
          </div>
          <div className="panel">
            <p className="text-xs text-muted-foreground">
              Shortlist players you're considering — saved on this device. Use ★ in the rankings
              below to add or remove.
            </p>
            {draftPlayers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No drafted players yet.</p>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {draftPlayers.map((p) => (
                    <div key={p.id} className="squad-card">
                      <div className="flex items-center gap-2">
                        <Shirt team={p.team} gk={p.pos === "GKP"} size={26} />
                        <div>
                          <span className="pos-badge">{p.pos}</span>
                          <span className="ml-2 font-semibold">{p.name}</span>
                          <div className="text-xs text-muted-foreground">
                            {p.team} · £{p.price.toFixed(1)}m · rating {p.score.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => toggleDraft(p.id)} className="pill">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(POS_ORDER as Pos[]).map((pp) => (
                    <span key={pp} className="bench-chip">
                      <b>{pp}</b> {draftPlayers.filter((p) => p.pos === pp).length}
                    </span>
                  ))}
                  <button onClick={() => setDraftIds([])} className="pill">
                    Clear draft
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

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
                  <th>Draft</th>
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
                    <td colSpan={10} className="py-10 text-center text-muted-foreground">
                      Pulling live FPL data…
                    </td>
                  </tr>
                )}
                {filtered.slice(0, 80).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        onClick={() => toggleDraft(p.id)}
                        className={draftIds.includes(p.id) ? "pill pill-active" : "pill"}
                        aria-label={draftIds.includes(p.id) ? "Remove from draft" : "Add to draft"}
                      >
                        {draftIds.includes(p.id) ? "★" : "☆"}
                      </button>
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <Shirt team={p.team} gk={p.pos === "GKP"} size={22} />
                        <span>
                          <span className="font-semibold">{p.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.team}</span>
                          {p.news && <div className="news">{p.news}</div>}
                        </span>
                      </span>
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

      {/* Swap drawer */}
      {swapTarget && squad && (
        <div className="drawer" onClick={() => setSwapTarget(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ctl-label">Replace</p>
                <p className="display text-xl">{swapTarget.name}</p>
                <p className="text-xs text-muted-foreground">
                  {swapTarget.pos} · {swapTarget.team} · £{swapTarget.price.toFixed(1)}m
                </p>
              </div>
              <button onClick={() => setSwapTarget(null)} className="pill">
                Close
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              £{(budget - squad.cost + swapTarget.price).toFixed(1)}m available for this slot.
            </p>
            <input
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder="Search players…"
              className="field mt-3"
            />
            <div className="mt-3 grid gap-1.5">
              {swapCandidates.map((c) => {
                const check = canSwap(squad.squad, swapTarget, c, budget);
                return (
                  <button
                    key={c.id}
                    disabled={!check.ok}
                    onClick={() => doSwap(c)}
                    className="swap-row"
                    title={check.reason}
                  >
                    <span className="flex items-center gap-2">
                      <Shirt team={c.team} gk={c.pos === "GKP"} size={22} />
                      <span>
                        <b>{c.name}</b>
                        <span className="ml-2 text-xs text-muted-foreground">{c.team}</span>
                      </span>
                    </span>
                    <span className="text-right text-xs">
                      <span className="block">£{c.price.toFixed(1)}m</span>
                      <span className="score text-sm">{c.score.toFixed(1)}</span>
                      {!check.ok && (
                        <span className="block text-muted-foreground">{check.reason}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
