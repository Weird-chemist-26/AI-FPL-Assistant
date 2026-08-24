import { Shirt } from "@/components/Shirt";
import { formatMoney } from "@/utils/format";

const ROWS = ["GKP", "DEF", "MID", "FWD"];

function Slot({ player, onSelect }) {
  return (
    <button onClick={() => onSelect(player)} className="shirt-tile" title={player.name}>
      <Shirt team={player.club} gk={player.position === "GKP"} size={38} />
      <span className="shirt-name">
        {player.webName}
        {player.isCaptain && <span className="armband">C</span>}
        {player.isViceCaptain && <span className="armband armband-v">V</span>}
      </span>
      <span className="shirt-meta">{player.clubShort}</span>
      <span className="shirt-price">
        {player.eventPoints ?? 0} pts · {formatMoney(player.price)}
      </span>
    </button>
  );
}

/** Renders the starting XI on a pitch, with the bench underneath. */
export function Pitch({ starting = [], bench = [], onSelect = () => {} }) {
  return (
    <div className="panel">
      <div className="pitch">
        {ROWS.map((row) => {
          const line = starting.filter((p) => p.position === row);
          if (!line.length) return null;
          return (
            <div key={row} className="pitch-row">
              {line.map((p) => (
                <Slot key={p.id} player={p} onSelect={onSelect} />
              ))}
            </div>
          );
        })}
      </div>

      {bench.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="ctl-label">Bench</p>
          <div className="flex flex-wrap gap-2">
            {bench.map((p) => (
              <button key={p.id} onClick={() => onSelect(p)} className="bench-chip">
                <b>{p.position}</b> {p.webName} · {p.eventPoints ?? 0} pts
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
