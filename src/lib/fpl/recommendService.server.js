// Transfer recommendation engine.
// Kept as its own service so the scoring logic can be improved later
// without the frontend needing any changes.
import {
  getPlayers,
  getTeamPicks,
  getGameweekInfo,
  getTeamHistory,
  getRawFixtures,
  getTeams,
  FplError,
} from "./fplService.server.js";

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

/* ------------------------------------------------------------ gameweek info */

/** Fixtures each club plays in a given gameweek (handles doubles and blanks). */
async function getGameweekFixturesByTeam(gw) {
  const [fixtures, teams] = await Promise.all([getRawFixtures(), getTeams()]);
  const byTeam = new Map();
  const push = (teamId, entry) => {
    const list = byTeam.get(teamId) || [];
    list.push(entry);
    byTeam.set(teamId, list);
  };
  for (const f of fixtures) {
    if (f.event !== gw) continue;
    push(f.team_h, {
      opponent: teams.get(f.team_a)?.short || "?",
      home: true,
      difficulty: f.team_h_difficulty,
    });
    push(f.team_a, {
      opponent: teams.get(f.team_h)?.short || "?",
      home: false,
      difficulty: f.team_a_difficulty,
    });
  }
  return byTeam;
}

/**
 * Estimate how many free transfers the manager has for the upcoming gameweek.
 * FPL rules: 1 free transfer per gameweek, rolling up to a maximum of 5.
 * Wildcard / free hit gameweeks reset the count to 1 for the following week.
 */
function estimateFreeTransfers(history, targetGw) {
  const chipGws = new Set(
    (history.chips || [])
      .filter((c) => c.name === "wildcard" || c.name === "freehit")
      .map((c) => c.gameweek),
  );
  const played = (history.season || [])
    .filter((g) => g.gameweek < targetGw)
    .sort((a, b) => a.gameweek - b.gameweek);
  if (!played.length) return { freeTransfers: 1, estimated: false };

  let ft = 1;
  for (const g of played) {
    if (chipGws.has(g.gameweek)) ft = 1;
    else ft = Math.max(0, ft - (g.transfers || 0));
    ft = Math.min(5, ft + 1);
  }
  return { freeTransfers: Math.max(1, Math.min(5, ft)), estimated: true };
}

/** Score how good a captaincy pick is for this gameweek. */
function captainScore(player, gwFixtures) {
  const fixtures = gwFixtures || [];
  if (!fixtures.length) return null; // blank gameweek — cannot captain
  let fixtureQuality = 0;
  for (const f of fixtures) fixtureQuality += (6 - f.difficulty) * 2 + (f.home ? 1 : 0);
  const attacking = attackingScore(player);
  const availability =
    player.status === "a" ? 1 : player.chanceOfPlaying != null ? player.chanceOfPlaying / 100 : 0.3;
  const setPiece = player.penaltiesOrder === 1 ? 2 : player.penaltiesOrder ? 1 : 0;
  const raw =
    Math.min(10, player.form) * 3 +
    Math.min(10, player.pointsPerGame) * 2 +
    attacking * 2.2 +
    fixtureQuality * 1.2 +
    setPiece * 1.5 +
    minutesScore(player) * 0.8;
  return Math.round(raw * availability * 10) / 10;
}

function captainReasons(player, fixtures) {
  const reasons = [];
  if (fixtures.length > 1) reasons.push(`Double gameweek (${fixtures.length} fixtures)`);
  const easiest = Math.min(...fixtures.map((f) => f.difficulty));
  if (easiest <= 2) reasons.push("Very favourable fixture");
  else if (easiest === 3) reasons.push("Manageable fixture");
  if (fixtures.some((f) => f.home)) reasons.push("Home advantage");
  if (player.form >= 5) reasons.push(`In form (${player.form})`);
  if (player.penaltiesOrder === 1) reasons.push("First-choice penalty taker");
  if (player.xgi90 >= 0.6) reasons.push("High expected goal involvement");
  if (player.status !== "a") reasons.push("Fitness doubt — check the news");
  if (!reasons.length) reasons.push("Best available option in your squad");
  return reasons;
}

/** Chip advice — only ever suggests a chip the manager still owns. */
function buildChipAdvice({ history, squad, starting, bench, fixturesByTeam, gw, captainPick }) {
  const used = new Set((history.chips || []).map((c) => c.name));
  const advice = [];
  const fixturesFor = (p) => fixturesByTeam.get(p.teamId) || [];
  const doubles = squad.filter((p) => fixturesFor(p).length > 1);
  const blanks = squad.filter((p) => fixturesFor(p).length === 0);
  const benchPlaying = bench.filter(
    (p) => fixturesFor(p).length > 0 && p.status === "a" && p.minutes > 0,
  );
  const startersBlank = starting.filter((p) => fixturesFor(p).length === 0);

  const add = (name, label, use, reason) => {
    if (used.has(name)) return;
    advice.push({ chip: name, label, recommended: use, reason });
  };

  // Triple captain
  const tcFixtures = captainPick ? fixturesFor(captainPick.playerRaw) : [];
  const tcWorth =
    captainPick && (tcFixtures.length > 1 || (tcFixtures[0] && tcFixtures[0].difficulty <= 2));
  add(
    "3xc",
    "Triple Captain",
    Boolean(tcWorth),
    captainPick
      ? tcWorth
        ? `${captainPick.name} has ${tcFixtures.length > 1 ? "two fixtures" : "a very kind fixture"} in GW${gw} — a strong triple captain window.`
        : `No standout triple captain fixture in GW${gw}. Save it for a double gameweek or a premium with an easy home tie.`
      : "No captain option available this gameweek.",
  );

  // Bench boost
  const bbWorth = benchPlaying.length === 4 && bench.every((p) => p.status === "a");
  add(
    "bboost",
    "Bench Boost",
    Boolean(bbWorth),
    bbWorth
      ? `All four bench players have a GW${gw} fixture and are fit — your bench should return points.`
      : `Only ${benchPlaying.length}/4 bench players are fit with a GW${gw} fixture. Hold the bench boost.`,
  );

  // Free hit
  const fhWorth = startersBlank.length >= 4;
  add(
    "freehit",
    "Free Hit",
    fhWorth,
    fhWorth
      ? `${startersBlank.length} of your starters blank in GW${gw} — a free hit rebuilds a full XI for one week.`
      : `You have enough playing starters in GW${gw}, so keep the free hit for a big blank or double.`,
  );

  // Wildcard
  const brokenSquad = squad.filter((p) => p.status !== "a").length;
  const wcWorth = brokenSquad >= 4 || blanks.length >= 5;
  add(
    "wildcard",
    "Wildcard",
    wcWorth,
    wcWorth
      ? `${brokenSquad} players in your squad are flagged or blanking — a wildcard resets the whole team without hits.`
      : "Your squad is largely intact — a couple of transfers is cheaper than burning the wildcard.",
  );

  return advice;
}

/**
 * Build transfer suggestions for a team.
 * Budget = money in the bank + the price of the player being sold.
 */
export async function getTransferRecommendations(teamId, gameweek) {
  const gwInfo = await getGameweekInfo();
  const gw = Number(gameweek) || gwInfo.currentGameweek || 1;
  const [picks, allPlayers, history, fixturesByTeam] = await Promise.all([
    getTeamPicks(teamId, gw),
    getPlayers(),
    getTeamHistory(teamId).catch(() => ({ season: [], chips: [] })),
    getGameweekFixturesByTeam(gw),
  ]);
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

  /* ------------------------------------------------ free transfers + plan */
  const { freeTransfers, estimated } = estimateFreeTransfers(history, gw);

  // Build a plan that uses every free transfer, never re-using a player and
  // always respecting the running bank balance and the 3-per-club rule.
  const plan = [];
  let runningBank = bank;
  const usedOut = new Set();
  const usedIn = new Set();
  const planClubCounts = new Map(clubCounts);
  for (const s of suggestions) {
    if (plan.length >= freeTransfers) break;
    if (usedOut.has(s.out.id) || usedIn.has(s.in.id)) continue;
    const outPlayer = picks.squad.find((p) => p.id === s.out.id);
    const inPlayer = allPlayers.find((p) => p.id === s.in.id);
    if (!outPlayer || !inPlayer) continue;
    const cost = inPlayer.price - outPlayer.price;
    if (cost > runningBank + 0.001) continue;
    const clubAfter =
      (planClubCounts.get(inPlayer.teamId) || 0) -
      (inPlayer.teamId === outPlayer.teamId ? 1 : 0);
    if (clubAfter >= 3) continue;
    runningBank = Math.round((runningBank - cost) * 10) / 10;
    planClubCounts.set(outPlayer.teamId, (planClubCounts.get(outPlayer.teamId) || 1) - 1);
    planClubCounts.set(inPlayer.teamId, (planClubCounts.get(inPlayer.teamId) || 0) + 1);
    usedOut.add(s.out.id);
    usedIn.add(s.in.id);
    plan.push({ ...s, bankAfter: runningBank });
  }

  const planGain = Math.round(plan.reduce((sum, s) => sum + s.gain, 0) * 10) / 10;
  const transferPlan = {
    freeTransfers,
    estimated,
    transfers: plan,
    totalGain: planGain,
    bankAfter: runningBank,
    advice: !plan.length
      ? `No upgrade is worth making this week — roll your ${freeTransfers === 1 ? "transfer" : `${freeTransfers} transfers`} and keep the flexibility.`
      : plan.length < freeTransfers
        ? `Only ${plan.length} move${plan.length > 1 ? "s are" : " is"} genuinely worth it — roll the remaining ${freeTransfers - plan.length}.`
        : `Use all ${freeTransfers} free transfer${freeTransfers > 1 ? "s" : ""} on the moves below — no points hit needed.`,
  };

  /* --------------------------------------------------------- captain pick */
  const captainOptions = picks.starting
    .map((p) => {
      const fixtures = fixturesByTeam.get(p.teamId) || [];
      const score = captainScore(p, fixtures);
      if (score == null) return null;
      return {
        ...summarise(p),
        captainScore: score,
        gameweekFixtures: fixtures,
        isCurrentCaptain: Boolean(p.isCaptain),
        reasons: captainReasons(p, fixtures),
        playerRaw: p,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.captainScore - a.captainScore)
    .slice(0, 5);

  const captainPick = captainOptions[0] || null;
  const viceCaptain = captainOptions[1] || null;

  const chips = buildChipAdvice({
    history,
    squad: picks.squad,
    starting: picks.starting,
    bench: picks.bench,
    fixturesByTeam,
    gw,
    captainPick,
  });

  const strip = ({ playerRaw, ...rest }) => rest; // eslint-disable-line no-unused-vars

  return {
    gameweek: gw,
    bank: Math.round(bank * 10) / 10,
    best: top[0] || null,
    suggestions: top,
    transferPlan,
    captain: {
      pick: captainPick ? strip(captainPick) : null,
      vice: viceCaptain ? strip(viceCaptain) : null,
      options: captainOptions.map(strip),
      alreadyCaptain: Boolean(captainPick && captainPick.isCurrentCaptain),
    },
    chips: {
      used: (history.chips || []).map((c) => ({ name: c.name, gameweek: c.gameweek })),
      advice: chips,
      recommended: chips.filter((c) => c.recommended),
    },
  };
}
