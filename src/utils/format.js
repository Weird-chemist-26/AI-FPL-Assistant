// Small formatting helpers shared across the UI.

export const POSITION_GROUPS = [
  { key: "GKP", label: "Goalkeepers" },
  { key: "DEF", label: "Defenders" },
  { key: "MID", label: "Midfielders" },
  { key: "FWD", label: "Forwards" },
];

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString();
}

export function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return `£${Number(value).toFixed(1)}m`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Colour class for a fixture difficulty rating (1 easiest, 5 hardest). */
export function difficultyClass(difficulty) {
  if (difficulty <= 2) return "fdr fdr-2";
  if (difficulty === 3) return "fdr fdr-3";
  if (difficulty === 4) return "fdr fdr-4";
  return "fdr fdr-5";
}
