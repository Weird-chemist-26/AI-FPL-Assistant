export interface Kit {
  base: string;
  alt: string;
  sleeve: string;
  pattern: "plain" | "stripes" | "hoops" | "sash" | "halves";
  text: string;
}

const K = (
  base: string,
  sleeve: string,
  pattern: Kit["pattern"] = "plain",
  alt = base,
  text = "#fff",
): Kit => ({ base, alt, sleeve, pattern, text });

// Home kits keyed by FPL short_name
export const KITS: Record<string, Kit> = {
  ARS: K("#EF0107", "#ffffff", "plain", "#EF0107"),
  AVL: K("#95BFE5", "#670E36", "stripes", "#670E36"),
  BOU: K("#DA291C", "#111111", "stripes", "#111111"),
  BRE: K("#E30613", "#ffffff", "stripes", "#ffffff", "#111111"),
  BHA: K("#0057B8", "#ffffff", "stripes", "#ffffff", "#111111"),
  BUR: K("#6C1D45", "#99D6EA", "plain", "#6C1D45"),
  CHE: K("#034694", "#034694", "plain", "#034694"),
  CRY: K("#1B458F", "#C4122E", "stripes", "#C4122E"),
  EVE: K("#003399", "#003399", "plain", "#003399"),
  FUL: K("#ffffff", "#000000", "plain", "#ffffff", "#111111"),
  IPS: K("#3A64A3", "#ffffff", "plain", "#3A64A3"),
  LEE: K("#ffffff", "#1D428A", "plain", "#ffffff", "#111111"),
  LEI: K("#003090", "#FDBE11", "plain", "#003090"),
  LIV: K("#C8102E", "#C8102E", "plain", "#C8102E"),
  LUT: K("#F78F1E", "#002D62", "plain", "#F78F1E"),
  MCI: K("#6CABDD", "#1C2C5B", "plain", "#6CABDD", "#0b2545"),
  MUN: K("#DA291C", "#000000", "plain", "#DA291C"),
  NEW: K("#241F20", "#ffffff", "stripes", "#ffffff"),
  NFO: K("#DD0000", "#DD0000", "plain", "#DD0000"),
  SHU: K("#EE2737", "#000000", "stripes", "#000000"),
  SOU: K("#D71920", "#ffffff", "stripes", "#ffffff"),
  SUN: K("#EB172B", "#ffffff", "stripes", "#ffffff"),
  TOT: K("#ffffff", "#132257", "plain", "#ffffff", "#111111"),
  WHU: K("#7A263A", "#1BB1E7", "plain", "#7A263A"),
  WOL: K("#FDB913", "#231F20", "plain", "#FDB913", "#111111"),
  NOR: K("#FFF200", "#00A650", "plain", "#FFF200", "#111111"),
  MID: K("#E21C38", "#ffffff", "plain", "#E21C38"),
  WBA: K("#122F67", "#ffffff", "stripes", "#ffffff"),
  COV: K("#7DBFEA", "#00398D", "plain", "#7DBFEA", "#0b2545"),
  HUL: K("#F5971D", "#000000", "stripes", "#000000"),
  STO: K("#E03A3E", "#ffffff", "stripes", "#ffffff"),
  BIR: K("#0000FF", "#ffffff", "plain", "#0000FF"),
};

export const FALLBACK_KIT: Kit = K("#2f6f4f", "#e8f5ee");

export const kitFor = (short: string): Kit => KITS[short?.toUpperCase()] ?? FALLBACK_KIT;

export const GK_KIT: Kit = K("#1FE07A", "#0d3b23", "plain", "#1FE07A", "#0b2513");
