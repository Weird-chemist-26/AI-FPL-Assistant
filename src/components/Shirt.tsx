import { kitFor, GK_KIT, type Kit } from "@/lib/kits";

interface Props {
  team: string;
  gk?: boolean;
  size?: number;
  className?: string;
}

function Pattern({ kit, id }: { kit: Kit; id: string }) {
  if (kit.pattern === "stripes") {
    return (
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={kit.base} />
        <rect width="4" height="8" fill={kit.alt} />
      </pattern>
    );
  }
  if (kit.pattern === "hoops") {
    return (
      <pattern id={id} width="8" height="10" patternUnits="userSpaceOnUse">
        <rect width="8" height="10" fill={kit.base} />
        <rect width="8" height="5" fill={kit.alt} />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="1" height="1" patternUnits="userSpaceOnUse">
      <rect width="1" height="1" fill={kit.base} />
    </pattern>
  );
}

export function Shirt({ team, gk = false, size = 40, className }: Props) {
  const kit = gk ? GK_KIT : kitFor(team);
  const id = `kit-${gk ? "gk" : team}-${kit.pattern}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={`${team} ${gk ? "goalkeeper" : "home"} kit`}
    >
      <defs>
        <Pattern kit={kit} id={id} />
      </defs>
      <path
        d="M22 8 L14 12 L6 20 L13 28 L18 24 L18 56 L46 56 L46 24 L51 28 L58 20 L50 12 L42 8 L38 13 Q32 17 26 13 Z"
        fill={`url(#${id})`}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M22 8 L14 12 L6 20 L13 28 L18 24 L18 30 L18 24"
        fill={kit.sleeve}
        opacity="0.95"
      />
      <path d="M6 20 L14 12 L22 8 L26 13 L18 24 Z" fill={kit.sleeve} />
      <path d="M58 20 L50 12 L42 8 L38 13 L46 24 Z" fill={kit.sleeve} />
      <path
        d="M26 13 Q32 17 38 13 L42 8 L38 6 Q32 12 26 6 L22 8 Z"
        fill={kit.sleeve}
        opacity="0.9"
      />
    </svg>
  );
}
