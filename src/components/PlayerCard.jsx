import { Shirt } from "@/components/Shirt";
import { difficultyClass, formatMoney } from "@/utils/format";

/** Compact player card — used on the pitch and in lists. */
export function PlayerCard({ player, onClick, compact = false }) {
  return (
    <button
      onClick={() => onClick && onClick(player)}
      className="squad-card w-full flex-col items-stretch gap-2 text-left transition hover:border-primary"
    >
      <span className="flex items-center gap-2">
        <Shirt team={player.club} gk={player.position === "GKP"} size={compact ? 26 : 32} />
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <b className="truncate text-sm">{player.webName || player.name}</b>
            {player.isCaptain && <span className="armband">C</span>}
            {player.isViceCaptain && <span className="armband armband-v">V</span>}
          </span>
          <span className="block text-xs text-muted-foreground">
            {player.clubShort || player.club} · <span className="pos-badge">{player.position}</span>
          </span>
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{formatMoney(player.price)}</span>
        <span>
          Pts <b className="text-foreground">{player.totalPoints ?? 0}</b>
        </span>
        <span>
          GW <b className="text-foreground">{player.eventPoints ?? 0}</b>
        </span>
        <span>
          Form <b className="text-foreground">{Number(player.form ?? 0).toFixed(1)}</b>
        </span>
        <span>{Number(player.selectedBy ?? 0).toFixed(1)}% owned</span>
      </span>

      {player.upcomingFixtures?.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {player.upcomingFixtures.slice(0, 5).map((f, i) => (
            <span key={i} className={difficultyClass(f.difficulty)}>
              {f.home ? f.opponent : f.opponent.toLowerCase()}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
