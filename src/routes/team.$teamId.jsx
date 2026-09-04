import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { StatCard } from "@/components/StatCard";
import { Pitch } from "@/components/Pitch";
import { PlayerModal } from "@/components/PlayerModal";
import { LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/StateBlocks";
import {
  useTeam,
  usePicks,
  useTransfers,
  useLeagues,
  useRecommendations,
  useBootstrap,
} from "@/hooks/useFpl";
import { formatMoney, formatNumber, formatDateTime } from "@/utils/format";

export const Route = createFileRoute("/team/$teamId")({
  head: ({ params }) => ({
    meta: [
      { title: `Team ${params.teamId} Dashboard — FPL Insight` },
      {
        name: "description",
        content:
          "Full Fantasy Premier League team dashboard: squad pitch view, gameweek points, rank, transfer history, mini-leagues and transfer recommendations.",
      },
      { property: "og:title", content: `Team ${params.teamId} Dashboard — FPL Insight` },
      {
        property: "og:description",
        content:
          "Squad, points, ranks, transfers, leagues and smart transfer suggestions for your FPL team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamDashboard,
});

const TABS = [
  { key: "squad", label: "Squad" },
  { key: "transfers", label: "Transfers" },
  { key: "leagues", label: "Leagues" },
  { key: "recommendations", label: "Recommendations" },
];

function ConfidenceTag({ level }) {
  const cls =
    level === "HIGH" ? "pill pill-active" : level === "MEDIUM" ? "pill" : "bench-chip";
  return <span className={cls}>{level} confidence</span>;
}

function TeamDashboard() {
  const { teamId } = Route.useParams();
  const [tab, setTab] = useState("squad");
  const [selected, setSelected] = useState(null);
  const [gameweek, setGameweek] = useState(null);

  const { data: boot } = useBootstrap();
  const team = useTeam(teamId);
  const activeGw = gameweek ?? team.data?.currentGameweek ?? boot?.gameweek?.currentGameweek;
  const picks = usePicks(teamId, activeGw);
  const transfers = useTransfers(teamId);
  const leagues = useLeagues(teamId);
  const recs = useRecommendations(teamId, tab === "recommendations" ? activeGw : null);

  useEffect(() => {
    setGameweek(null);
  }, [teamId]);

  if (team.isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-6xl px-5 py-10">
          <LoadingBlock label="Loading your team…" />
        </div>
      </main>
    );
  }

  if (team.isError) {
    return (
      <main className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-6xl px-5 py-10">
          <ErrorBlock
            error={team.error}
            hint="Double-check your Team ID — it's the number in your FPL points URL."
          />
          <Link to="/" className="pill mt-4 inline-block">
            Try another Team ID
          </Link>
        </div>
      </main>
    );
  }

  const t = team.data;
  const gwHistory = picks.data?.entryHistory;
  const gwOptions = Array.from({ length: t.currentGameweek || 1 }, (_, i) => i + 1).reverse();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pitch-glow">
        <SiteNav />
        <header className="mx-auto max-w-6xl px-5 pt-6 pb-10">
          <p className="eyebrow">Team #{t.id}</p>
          <h1 className="display text-4xl sm:text-5xl">{t.teamName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Managed by {t.managerName}
            {t.favouriteTeam ? ` · supports ${t.favouriteTeam}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Next deadline: {formatDateTime(boot?.gameweek?.deadline)}
          </p>
        </header>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Overall points"
            value={formatNumber(t.overallPoints)}
            sub={`Rank ${formatNumber(t.overallRank)}`}
            accent
          />
          <StatCard
            label={`GW ${t.currentGameweek ?? "—"} points`}
            value={formatNumber(t.gameweekPoints)}
            sub={`GW rank ${formatNumber(t.gameweekRank)}`}
          />
          <StatCard
            label="Squad value"
            value={formatMoney(t.teamValue)}
            sub={`${formatMoney(t.bank)} in the bank`}
          />
          <StatCard
            label="Total transfers"
            value={formatNumber(t.totalTransfers)}
            sub={`Playing since GW${t.startedEvent ?? 1}`}
          />
        </section>

        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={x.key === tab ? "pill pill-active" : "pill"}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === "squad" && (
          <section>
            <div className="section-head">
              <h2 className="display text-2xl">Gameweek {activeGw ?? "—"} squad</h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Gameweek
                <select
                  value={activeGw ?? ""}
                  onChange={(e) => setGameweek(Number(e.target.value))}
                  className="field w-auto py-1"
                  aria-label="Choose gameweek"
                >
                  {gwOptions.map((g) => (
                    <option key={g} value={g}>
                      GW {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {picks.isLoading && <LoadingBlock label="Loading squad…" />}
            {picks.isError && <ErrorBlock error={picks.error} />}
            {picks.data && (
              <>
                {gwHistory && (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="GW points" value={formatNumber(gwHistory.points)} accent />
                    <StatCard
                      label="GW rank"
                      value={formatNumber(gwHistory.rank)}
                      sub={`Overall ${formatNumber(gwHistory.overallRank)}`}
                    />
                    <StatCard
                      label="Transfers"
                      value={formatNumber(gwHistory.transfers)}
                      sub={gwHistory.transferCost ? `-${gwHistory.transferCost} pts hit` : "No hit"}
                    />
                    <StatCard
                      label="Points on bench"
                      value={formatNumber(gwHistory.benchPoints)}
                      sub={picks.data.activeChip ? `Chip: ${picks.data.activeChip}` : "No chip"}
                    />
                  </div>
                )}
                <Pitch
                  starting={picks.data.starting}
                  bench={picks.data.bench}
                  onSelect={setSelected}
                />
              </>
            )}
          </section>
        )}

        {tab === "transfers" && (
          <section>
            <div className="section-head">
              <h2 className="display text-2xl">Transfer history</h2>
              <span className="text-xs text-muted-foreground">
                {transfers.data?.transfers?.length ?? 0} transfers made
              </span>
            </div>
            {transfers.isLoading && <LoadingBlock label="Loading transfers…" />}
            {transfers.isError && <ErrorBlock error={transfers.error} />}
            {transfers.data &&
              (transfers.data.transfers.length === 0 ? (
                <EmptyBlock>No transfers made yet this season.</EmptyBlock>
              ) : (
                <div className="panel overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>GW</th>
                        <th>Out</th>
                        <th>In</th>
                        <th>Date</th>
                        <th className="text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.data.transfers.map((x, i) => (
                        <tr key={i}>
                          <td>{x.gameweek}</td>
                          <td>
                            {x.playerOut}{" "}
                            <span className="text-xs text-muted-foreground">
                              {x.playerOutClub} · {formatMoney(x.playerOutPrice)}
                            </span>
                          </td>
                          <td>
                            {x.playerIn}{" "}
                            <span className="text-xs text-muted-foreground">
                              {x.playerInClub} · {formatMoney(x.playerInPrice)}
                            </span>
                          </td>
                          <td className="text-xs text-muted-foreground">
                            {formatDateTime(x.time)}
                          </td>
                          <td className="text-right text-xs">{x.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>
        )}

        {tab === "leagues" && (
          <section>
            <div className="section-head">
              <h2 className="display text-2xl">Mini-leagues</h2>
              <span className="text-xs text-muted-foreground">
                {leagues.data?.leagues?.length ?? 0} leagues
              </span>
            </div>
            {leagues.isLoading && <LoadingBlock label="Loading leagues…" />}
            {leagues.isError && <ErrorBlock error={leagues.error} />}
            {leagues.data &&
              (leagues.data.leagues.length === 0 ? (
                <EmptyBlock>This team hasn't joined any leagues.</EmptyBlock>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {leagues.data.leagues.map((l) => {
                    const movement =
                      l.rank && l.lastRank ? l.lastRank - l.rank : null;
                    return (
                      <div key={`${l.type}-${l.id}`} className="squad-card">
                        <span>
                          <b className="text-sm">{l.name}</b>
                          <span className="block text-xs text-muted-foreground">
                            {l.type}
                            {l.teams ? ` · ${formatNumber(l.teams)} teams` : ""}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="score block">{formatNumber(l.rank)}</span>
                          {movement !== null && movement !== 0 && (
                            <span className="text-xs text-muted-foreground">
                              {movement > 0 ? `▲ ${movement}` : `▼ ${Math.abs(movement)}`}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
          </section>
        )}

        {tab === "recommendations" && (
          <section>
            <div className="section-head">
              <h2 className="display text-2xl">Transfer recommendations</h2>
              <span className="text-xs text-muted-foreground">
                Budget checked · max 3 per club respected
              </span>
            </div>
            {recs.isLoading && <LoadingBlock label="Crunching form, fixtures and xG…" />}
            {recs.isError && <ErrorBlock error={recs.error} />}

            {recs.data?.captain?.pick && (
              <div className="panel mb-4">
                <div className="section-head">
                  <h3 className="display text-xl">Captain for GW {recs.data.gameweek}</h3>
                  <span className="text-xs text-muted-foreground">
                    {recs.data.captain.alreadyCaptain
                      ? "You already have the armband right"
                      : "Suggested armband change"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="armband">C</span>{" "}
                    <button className="underline" onClick={() => setSelected(recs.data.captain.pick)}>
                      <b>{recs.data.captain.pick.name}</b>
                    </button>{" "}
                    <span className="pos-badge">{recs.data.captain.pick.position}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {recs.data.captain.pick.club}
                      {recs.data.captain.pick.gameweekFixtures?.length
                        ? ` · ${recs.data.captain.pick.gameweekFixtures
                            .map((f) => `${f.opponent} (${f.home ? "H" : "A"})`)
                            .join(", ")}`
                        : ""}
                    </span>
                  </p>
                  <span className="score">{recs.data.captain.pick.captainScore}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recs.data.captain.pick.reasons.map((r) => (
                    <span key={r} className="tag-setpiece">
                      {r}
                    </span>
                  ))}
                </div>
                {recs.data.captain.vice && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Vice-captain:{" "}
                    <button
                      className="underline"
                      onClick={() => setSelected(recs.data.captain.vice)}
                    >
                      {recs.data.captain.vice.name}
                    </button>{" "}
                    ({recs.data.captain.vice.club})
                  </p>
                )}
                {recs.data.captain.options.length > 2 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recs.data.captain.options.slice(2).map((o) => (
                      <span key={o.id} className="bench-chip">
                        {o.name} · {o.captainScore}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {recs.data?.chips?.advice?.length > 0 && (
              <div className="panel mb-4">
                <div className="section-head">
                  <h3 className="display text-xl">Chip strategy</h3>
                  <span className="text-xs text-muted-foreground">
                    {recs.data.chips.used.length
                      ? `Used: ${recs.data.chips.used.map((c) => `${c.name} (GW${c.gameweek})`).join(", ")}`
                      : "No chips used yet"}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {recs.data.chips.advice.map((c) => (
                    <div key={c.chip} className="squad-card">
                      <span>
                        <b className="text-sm">{c.label}</b>
                        <span className="block text-xs text-muted-foreground">{c.reason}</span>
                      </span>
                      <span className={c.recommended ? "pill pill-active" : "bench-chip"}>
                        {c.recommended ? "Play it" : "Hold"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recs.data?.transferPlan && (
              <div className="panel mb-4">
                <div className="section-head">
                  <h3 className="display text-xl">
                    Your {recs.data.transferPlan.freeTransfers} free transfer
                    {recs.data.transferPlan.freeTransfers > 1 ? "s" : ""}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {recs.data.transferPlan.estimated ? "Estimated from your history" : "Season start"}
                  </span>
                </div>
                <p className="text-sm">{recs.data.transferPlan.advice}</p>
                {recs.data.transferPlan.transfers.length > 0 && (
                  <>
                    <ol className="mt-3 grid gap-2">
                      {recs.data.transferPlan.transfers.map((s, i) => (
                        <li key={s.id} className="squad-card">
                          <span className="text-sm">
                            <b>{i + 1}.</b> {s.out.name}{" "}
                            <span className="text-muted-foreground">→</span> <b>{s.in.name}</b>{" "}
                            <span className="pos-badge">{s.in.position}</span>{" "}
                            <span className="text-xs text-muted-foreground">
                              {formatMoney(s.out.price)} → {formatMoney(s.in.price)} ·{" "}
                              {formatMoney(s.bankAfter)} left in the bank
                            </span>
                          </span>
                          <span className="score">+{s.gain}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Combined rating gain +{recs.data.transferPlan.totalGain} · no points hit
                    </p>
                  </>
                )}
              </div>
            )}

            {recs.data &&
              (recs.data.suggestions.length === 0 ? (
                <EmptyBlock>
                  No upgrades found within your {formatMoney(recs.data.bank)} budget — your squad is
                  in good shape.
                </EmptyBlock>
              ) : (
                <div className="grid gap-3">
                  {recs.data.suggestions.map((s) => (
                    <div key={s.id} className="panel">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm">
                          <button className="underline" onClick={() => setSelected(s.out)}>
                            {s.out.name}
                          </button>{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          <button
                            className="underline decoration-primary"
                            onClick={() => setSelected(s.in)}
                          >
                            <b>{s.in.name}</b>
                          </button>{" "}
                          <span className="pos-badge">{s.in.position}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {s.out.club} → {s.in.club}
                          </span>
                        </p>
                        <span className="flex items-center gap-2">
                          <ConfidenceTag level={s.confidence} />
                          <span className="score">+{s.gain}</span>
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatMoney(s.out.price)} → {formatMoney(s.in.price)} ·{" "}
                        {s.priceDifference > 0
                          ? `costs ${formatMoney(s.priceDifference)} more`
                          : s.priceDifference < 0
                            ? `frees ${formatMoney(Math.abs(s.priceDifference))}`
                            : "same price"}{" "}
                        · {formatMoney(s.budgetAvailable)} available for this slot
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.reasons.map((r) => (
                          <span key={r} className="tag-setpiece">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </section>
        )}
      </div>

      <PlayerModal player={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
