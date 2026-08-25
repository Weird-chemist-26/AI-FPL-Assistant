import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerModal } from "@/components/PlayerModal";
import { LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/StateBlocks";
import { usePlayers, useBootstrap } from "@/hooks/useFpl";
import { POSITION_GROUPS } from "@/utils/format";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Player Search & Stats — FPL Insight" },
      {
        name: "description",
        content:
          "Search every Fantasy Premier League player and filter by position, club, price and form. Compare points, xG, xA, ownership and upcoming fixture difficulty.",
      },
      { property: "og:title", content: "Player Search & Stats — FPL Insight" },
      {
        property: "og:description",
        content:
          "Filter all FPL players by position, club and price, then open any player for full season stats and fixtures.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayersPage,
});

const SORTS = [
  { key: "score", label: "Rating" },
  { key: "totalPoints", label: "Total points" },
  { key: "form", label: "Form" },
  { key: "price", label: "Price" },
  { key: "selectedBy", label: "Ownership" },
];

function PlayersPage() {
  const { data, isLoading, isError, error } = usePlayers();
  const { data: boot } = useBootstrap();

  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [club, setClub] = useState("ALL");
  const [maxPrice, setMaxPrice] = useState(15);
  const [sort, setSort] = useState("score");
  const [selected, setSelected] = useState(null);
  const [limit, setLimit] = useState(36);

  const players = data?.players ?? [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(
        (p) =>
          (position === "ALL" || p.position === position) &&
          (club === "ALL" || p.club === club) &&
          p.price <= maxPrice &&
          (q === "" || `${p.name} ${p.club}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  }, [players, query, position, club, maxPrice, sort]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pitch-glow">
        <SiteNav />
        <header className="mx-auto max-w-6xl px-5 pt-6 pb-10">
          <p className="eyebrow">Every registered player</p>
          <h1 className="display text-4xl sm:text-5xl">Player search</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Filter by position, club and budget, sort by the metric you care about, and tap any
            player for full stats and upcoming fixtures.
          </p>
        </header>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <section className="panel mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="ctl-label" htmlFor="player-search">
              Search
            </label>
            <input
              id="player-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Player or club…"
              className="field"
            />
          </div>
          <div>
            <label className="ctl-label">Position</label>
            <div className="flex flex-wrap gap-1.5">
              {["ALL", ...POSITION_GROUPS.map((g) => g.key)].map((p) => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  className={p === position ? "pill pill-active" : "pill"}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="ctl-label" htmlFor="club-select">
              Club
            </label>
            <select
              id="club-select"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              className="field"
            >
              <option value="ALL">All clubs</option>
              {(boot?.teams ?? []).map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
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
            <label className="ctl-label mt-3">Sort by</label>
            <div className="flex flex-wrap gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={s.key === sort ? "pill pill-active" : "pill"}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isLoading && <LoadingBlock label="Loading every FPL player…" />}
        {isError && <ErrorBlock error={error} hint="Refresh the page to try again." />}

        {!isLoading && !isError && (
          <>
            <div className="section-head">
              <h2 className="display text-2xl">
                {results.length} player{results.length === 1 ? "" : "s"}
              </h2>
              <span className="text-xs text-muted-foreground">Tap a card for full stats</span>
            </div>
            {results.length === 0 ? (
              <EmptyBlock>No players match those filters — try widening your budget.</EmptyBlock>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {results.slice(0, limit).map((p) => (
                    <PlayerCard key={p.id} player={p} onClick={setSelected} />
                  ))}
                </div>
                {results.length > limit && (
                  <div className="mt-4 text-center">
                    <button onClick={() => setLimit((l) => l + 36)} className="pill">
                      Show more
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <PlayerModal player={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
