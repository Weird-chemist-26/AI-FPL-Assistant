import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { LoadingBlock } from "@/components/StateBlocks";
import { useBootstrap, useFixtures } from "@/hooks/useFpl";
import { formatDateTime, difficultyClass } from "@/utils/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FPL Insight — Fantasy Premier League Team Dashboard" },
      {
        name: "description",
        content:
          "Enter your Fantasy Premier League Team ID to see your squad, gameweek points, transfer history, mini-leagues and data-driven transfer recommendations.",
      },
      { property: "og:title", content: "FPL Insight — Fantasy Premier League Team Dashboard" },
      {
        property: "og:description",
        content:
          "Live FPL dashboard: squad pitch view, gameweek stats, mini-leagues and smart transfer suggestions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const RECENT_KEY = "fpl-recent-teams";

function Countdown({ deadline }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) return setLeft("Deadline passed");
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return <strong>{left || "—"}</strong>;
}

function LandingPage() {
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);

  const { data: boot, isLoading } = useBootstrap();
  const { data: fixtureData } = useFixtures();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function submit(e) {
    e.preventDefault();
    const id = teamId.trim();
    if (!/^\d+$/.test(id)) {
      setError("Please enter your numeric FPL Team ID (digits only).");
      return;
    }
    setError("");
    try {
      const next = [id, ...recent.filter((r) => r !== id)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    navigate({ to: "/team/$teamId", params: { teamId: id } });
  }

  const gw = boot?.gameweek;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pitch-glow">
        <SiteNav />
        <header className="mx-auto max-w-6xl px-5 pt-10 pb-12">
          <p className="eyebrow">Live official FPL data</p>
          <h1 className="display mt-2 text-5xl sm:text-6xl">Your Fantasy Premier League HQ</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Drop in your Team ID to see your squad on the pitch, track every gameweek, review your
            transfers and mini-leagues, and get transfer recommendations built from form, fixtures
            and expected output.
          </p>

          <form onSubmit={submit} className="mt-6 flex max-w-md flex-wrap gap-2">
            <input
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 1234567"
              aria-label="FPL Team ID"
              className="field flex-1"
            />
            <button type="submit" className="pill pill-active px-5">
              View dashboard
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            Find your ID on the official FPL site: Points → the number in the URL
            <span className="text-foreground"> /entry/&lt;ID&gt;/event/…</span>
          </p>

          {recent.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="ctl-label mb-0">Recent</span>
              {recent.map((id) => (
                <Link key={id} to="/team/$teamId" params={{ teamId: id }} className="pill">
                  {id}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="stat-chip">
              <span>Gameweek</span>
              <strong>{gw?.deadlineGameweek ?? "—"}</strong>
            </div>
            <div className="stat-chip">
              <span>Deadline</span>
              <strong>{formatDateTime(gw?.deadline)}</strong>
            </div>
            <div className="stat-chip">
              <span>Time remaining</span>
              <Countdown deadline={gw?.deadline} />
            </div>
            <div className="stat-chip">
              <span>Status</span>
              <strong>{gw?.status ?? "—"}</strong>
            </div>
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <section className="mb-10">
          <div className="section-head">
            <h2 className="display text-2xl">Next gameweek fixtures</h2>
            <span className="text-xs text-muted-foreground">
              Difficulty from the official FPL ratings
            </span>
          </div>
          {isLoading && <LoadingBlock />}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(fixtureData?.fixtures ?? []).map((f) => (
              <div key={f.id} className="squad-card">
                <span className="text-sm">
                  <b>{f.homeShort}</b> v <b>{f.awayShort}</b>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(f.kickoff)}
                  </span>
                </span>
                <span className="flex gap-1">
                  <span className={difficultyClass(f.homeDifficulty)}>H {f.homeDifficulty}</span>
                  <span className={difficultyClass(f.awayDifficulty)}>A {f.awayDifficulty}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "Squad on the pitch",
              d: "See your XI and bench in formation with live points, prices and fixture colours.",
            },
            {
              t: "Season & transfer history",
              d: "Every gameweek score, rank movement, chips played and each transfer you made.",
            },
            {
              t: "Transfer recommendations",
              d: "Ranked suggestions with reasons, budget checks and the 3-per-club rule applied.",
            },
          ].map((c) => (
            <div key={c.t} className="panel">
              <h3 className="display text-xl">{c.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
