import { Shirt } from "@/components/Shirt";
import { difficultyClass, formatMoney, formatNumber } from "@/utils/format";

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-secondary px-3 py-2">
      <p className="ctl-label mb-0.5">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

/** Detailed stats for one player, shown in a drawer/modal. */
export function PlayerModal({ player, onClose }) {
  if (!player) return null;
  const name = player.fullName || player.name;
  const fixtures = player.upcomingFixtures || player.fixtures || [];

  return (
    <div className="drawer" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shirt team={player.club} gk={player.position === "GKP"} size={40} />
            <div>
              <p className="display text-2xl">{player.webName || name}</p>
              <p className="text-xs text-muted-foreground">
                {name} · {player.clubShort || player.club} ·{" "}
                <span className="pos-badge">{player.position}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="pill">
            Close
          </button>
        </div>

        {player.news && <p className="news mt-3">{player.news}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Price" value={formatMoney(player.price)} />
          <Stat label="Total points" value={formatNumber(player.totalPoints)} />
          <Stat label="This GW" value={formatNumber(player.eventPoints)} />
          <Stat label="Form" value={Number(player.form ?? 0).toFixed(1)} />
          <Stat label="Points / game" value={Number(player.pointsPerGame ?? 0).toFixed(1)} />
          <Stat label="Minutes" value={formatNumber(player.minutes)} />
          <Stat label="Goals" value={formatNumber(player.goals)} />
          <Stat label="Assists" value={formatNumber(player.assists)} />
          <Stat label="Clean sheets" value={formatNumber(player.cleanSheets)} />
          <Stat label="Bonus" value={formatNumber(player.bonus)} />
          <Stat label="xG" value={Number(player.expectedGoals ?? 0).toFixed(2)} />
          <Stat label="xA" value={Number(player.expectedAssists ?? 0).toFixed(2)} />
          <Stat label="Owned by" value={`${Number(player.selectedBy ?? 0).toFixed(1)}%`} />
          <Stat label="ICT index" value={Number(player.ictIndex ?? 0).toFixed(1)} />
          <Stat
            label="Availability"
            value={player.status === "a" ? "Fit" : (player.chanceOfPlaying ?? 0) + "% chance"}
          />
        </div>

        <div className="mt-4">
          <p className="ctl-label">Next fixtures</p>
          {fixtures.length ? (
            <div className="flex flex-wrap gap-1">
              {fixtures.map((f, i) => (
                <span key={i} className={difficultyClass(f.difficulty)}>
                  {f.home ? f.opponent : f.opponent.toLowerCase()}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scheduled fixtures (blank gameweek).</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Uppercase = home, lowercase = away. Green is an easy fixture, red is a tough one.
          </p>
        </div>
      </div>
    </div>
  );
}
