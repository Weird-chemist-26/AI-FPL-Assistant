// Transfer recommendation engine.
// Kept as its own service so the scoring logic can be improved later
// without the frontend needing any changes.
import { getPlayers, getTeamPicks, getGameweekInfo, FplError } from "./fplService.server.js";

/** Turn fixture difficulty (1 easy - 5 hard) into a 0-10 score. */
function fixtureScore(player) {
  const fixtures = player.upcomingFixtures || [];
  if (!fixtures.length) return 2; // blank gameweek = bad
  let total = 0;
  for (const f of fixtures) {
    // Easier fixtures score higher; a home game gets a small bonus.
    total += (6 - f.difficulty) * 2 + (f.home ? 0.6 : 0);
  }
  return total / fixtures.length;
}

/** How likely is the player to actually start? */
function minutesScore(player) {
  const per90 = player.minutes / 90;
  const availability =
    player.status === "a" ? 1 : player.chanceOfPlaying != null ? player.chanceOfPlaying / 100 : 0.35;
  const reliability = Math.min(1, per90 / 12); // ~12 full games = fully trusted
  return reliability * 10 * availability;
}

function attackingScore(player) {
  const per90 = Math.max(player.minutes, 1) / 90;
  const goalsAssists = (player.goals + player.assists) / per90;
  const expected = player.xgi90 || player.expectedGoalInvolvements / Math.max(per90, 1);
  return Math.min(10, goalsAssists * 4 + expected * 5);
}

/** Overall 0-100 score for a single player. */
export function scorePlayer(player) {
  const form = Math.min(10, player.form);
  const ppg = Math.min(10, player.pointsPerGame);
  const recent = Math.min(10, player.eventPoints / 1.5);
  const fixtures = fixtureScore(player);
  const minutes = minutesScore(player);
  const attack = attackingScore(player);
  const ownership = Math.min(10, player.selectedBy / 5); // popular = safer pick
  const strength = Math.min(10, player.teamStrength * 2);

  const score =
    form * 2.4 +
    ppg * 1.8 +
    recent * 0.8 +
    fixtures * 1.9 +
    minutes * 1.5 +
    attack * 1.4 +
    ownership * 0.5 +
    strength * 0.7;

  return Math.round((score / 11) * 10) / 10; // normalised roughly to 0-100
}

/** Human readable reasons why `incoming` beats `outgoing`. */
function buildReasons(outgoing, incoming) {
  const reasons = [];
  if (incoming.form > outgoing.form + 0.5) reasons.push("Better recent form");
  if (fixtureScore(incoming) > fixtureScore(outgoing) + 0.5)
    reasons.push("Better upcoming fixtures");
  if (attackingScore(incoming) > attackingScore(outgoing) + 0.5)
    reasons.push("Higher expected attacking output");
  if (minutesScore(incoming) > minutesScore(outgoing) + 1) reasons.push("More reliable minutes");
  if (incoming.pointsPerGame > outgoing.pointsPerGame + 0.3) reasons.push("Higher points per game");
  if (Math.abs(incoming.price - outgoing.price) <= 0.5) reasons.push("Similar price");
  else if (incoming.price < outgoing.price) reasons.push("Frees up budget");
  if (outgoing.status !== "a") reasons.push("Current player is flagged as a doubt");
  if (!reasons.length) reasons.push("Marginally higher overall rating");
  return reasons;
}

function confidence(delta) {
  if (delta >= 12) return "HIGH";
  if (delta >= 6) return "MEDIUM";
  return "LOW";
}

function summarise(player) {
  return {
    id: player.id,
    name: player.webName,
    fullName: player.name,
    club: player.clubShort,
    position: player.position,
    price: player.price,
    form: player.form,
    totalPoints: player.totalPoints,
    pointsPerGame: player.pointsPerGame,
    eventPoints: player.eventPoints,
    goals: player.goals,
    assists: player.assists,
    minutes: player.minutes,
    expectedGoals: player.expectedGoals,
    expectedAssists: player.expectedAssists,
    selectedBy: player.selectedBy,
    status: player.status,
    news: player.news,
    fixtures: player.upcomingFixtures,
    score: scorePlayer(player),
  };
}

/**
 * Build transfer suggestions for a team.
 * Budget = money in the bank + the price of the player being sold.
 */
export async function getTransferRecommendations(teamId, gameweek) {
  const gwInfo = await getGameweekInfo();
  const gw = Number(gameweek) || gwInfo.currentGameweek || 1;
  const [picks, allPlayers] = await Promise.all([getTeamPicks(teamId, gw), getPlayers()]);
  if (!picks.squad.length) throw new FplError("That squad is empty.", 404);

  const bank = picks.entryHistory ? picks.entryHistory.bank : 0;
  const ownedIds = new Set(picks.squad.map((p) => p.id));
  const clubCounts = new Map();
  for (const p of picks.squad) clubCounts.set(p.teamId, (clubCounts.get(p.teamId) || 0) + 1);

  const suggestions = [];

  for (const outgoing of picks.squad) {
    const outScore = scorePlayer(outgoing);
    const budget = bank + outgoing.price;

    const candidates = allPlayers
      .filter(
        (p) =>
          p.position === outgoing.position &&
          !ownedIds.has(p.id) &&
          p.price <= budget + 0.001 &&
          p.status === "a" &&
          p.minutes > 0 &&
          // FPL rule: max 3 players from one club
          (clubCounts.get(p.teamId) || 0) - (p.teamId === outgoing.teamId ? 1 : 0) < 3,
      )
      .map((p) => ({ player: p, score: scorePlayer(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const c of candidates) {
      const delta = Math.round((c.score - outScore) * 10) / 10;
      if (delta <= 0) continue;
      suggestions.push({
        id: `${outgoing.id}-${c.player.id}`,
        out: summarise(outgoing),
        in: summarise(c.player),
        priceDifference: Math.round((c.player.price - outgoing.price) * 10) / 10,
        budgetAvailable: Math.round(budget * 10) / 10,
        gain: delta,
        recommendationScore: c.score,
        confidence: confidence(delta),
        reasons: buildReasons(outgoing, c.player),
      });
    }
  }

  suggestions.sort((a, b) => b.gain - a.gain);
  const top = suggestions.slice(0, 12);

  return {
    gameweek: gw,
    bank: Math.round(bank * 10) / 10,
    best: top[0] || null,
    suggestions: top,
  };
}
