// All communication with the official (public) Fantasy Premier League API lives here.
// Nothing in this file touches the browser — it only runs on the server.
import { cached } from "./cache.server.js";

const BASE = process.env["FPL_API_BASE"] || "https://fantasy.premierleague.com/api";
const HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

const POSITIONS = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const POSITION_NAMES = { GKP: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

/** Error type that carries an HTTP status + a friendly message for the UI. */
export class FplError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const num = (v) => Number(v ?? 0) || 0;

async function getJson(path, { notFoundMessage } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  } catch {
    throw new FplError("We couldn't reach the official FPL servers. Please try again.", 503);
  }
  if (res.status === 404) {
    throw new FplError(notFoundMessage || "That data could not be found on FPL.", 404);
  }
  if (!res.ok) {
    throw new FplError("The official FPL API is having a moment. Please try again shortly.", 502);
  }
  return res.json();
}

/* ---------------------------------------------------------------- static data */

export function getBootstrap() {
  // Player/team/gameweek master data — cached for 10 minutes.
  return cached("bootstrap", 600, () => getJson("/bootstrap-static/"));
}

export function getRawFixtures() {
  return cached("fixtures", 600, () => getJson("/fixtures/"));
}

/** Map of teamId -> { id, name, short, strength } */
export async function getTeams() {
  const bs = await getBootstrap();
  const map = new Map();
  for (const t of bs.teams) {
    map.set(t.id, {
      id: t.id,
      name: t.name,
      short: t.short_name,
      strength: t.strength,
      strengthAttackHome: t.strength_attack_home,
      strengthAttackAway: t.strength_attack_away,
      strengthDefenceHome: t.strength_defence_home,
      strengthDefenceAway: t.strength_defence_away,
    });
  }
  return map;
}

export async function getGameweekInfo() {
  const bs = await getBootstrap();
  const current = bs.events.find((e) => e.is_current) || null;
  const next = bs.events.find((e) => e.is_next) || null;
  const target = next || current;
  return {
    currentGameweek: current ? current.id : null,
    nextGameweek: next ? next.id : null,
    deadline: target ? target.deadline_time : null,
    deadlineGameweek: target ? target.id : null,
    status: current
      ? current.finished
        ? "Finished"
        : "In progress"
      : next
        ? "Upcoming"
        : "Season not started",
    averageScore: current ? current.average_entry_score : null,
    highestScore: current ? current.highest_score : null,
    mostCaptained: current ? current.most_captained : null,
  };
}

/** Fixtures for a gameweek (defaults to the next/current one), normalized for the UI. */
export async function getFixtures(gameweek) {
  const [teams, fixtures, gwInfo] = await Promise.all([
    getTeams(),
    getRawFixtures(),
    getGameweekInfo(),
  ]);
  const gw = gameweek || gwInfo.deadlineGameweek;
  return fixtures
    .filter((f) => f.event === gw)
    .map((f) => ({
      id: f.id,
      gameweek: f.event,
      kickoff: f.kickoff_time,
      finished: f.finished,
      home: teams.get(f.team_h)?.name || "TBC",
      homeShort: teams.get(f.team_h)?.short || "?",
      away: teams.get(f.team_a)?.name || "TBC",
      awayShort: teams.get(f.team_a)?.short || "?",
      homeScore: f.team_h_score,
      awayScore: f.team_a_score,
      homeDifficulty: f.team_h_difficulty,
      awayDifficulty: f.team_a_difficulty,
    }))
    .sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
}

/** Next N fixtures per team, keyed by team id. */
async function getUpcomingByTeam(horizon = 5) {
  const [teams, fixtures, gwInfo] = await Promise.all([
    getTeams(),
    getRawFixtures(),
    getGameweekInfo(),
  ]);
  const start = gwInfo.deadlineGameweek || 1;
  const byTeam = new Map();
  const push = (teamId, entry) => {
    const list = byTeam.get(teamId) || [];
    list.push(entry);
    byTeam.set(teamId, list);
  };
  for (const f of fixtures) {
    if (!f.event || f.event < start || f.event >= start + horizon) continue;
    push(f.team_h, {
      event: f.event,
      opponent: teams.get(f.team_a)?.short || "?",
      home: true,
      difficulty: f.team_h_difficulty,
    });
    push(f.team_a, {
      event: f.event,
      opponent: teams.get(f.team_h)?.short || "?",
      home: false,
      difficulty: f.team_a_difficulty,
    });
  }
  for (const list of byTeam.values()) list.sort((a, b) => a.event - b.event);
  return byTeam;
}

/** Every player, normalized into a friendly shape (cached — this list is big). */
export async function getPlayers() {
  return cached("players", 600, async () => {
    const [bs, teams, upcoming] = await Promise.all([
      getBootstrap(),
      getTeams(),
      getUpcomingByTeam(5),
    ]);
    return bs.elements.map((e) => {
      const team = teams.get(e.team);
      const fixtures = upcoming.get(e.team) || [];
      const avgDifficulty = fixtures.length
        ? fixtures.reduce((s, f) => s + f.difficulty, 0) / fixtures.length
        : 3;
      const minutes = num(e.minutes);
      return {
        id: e.id,
        name: `${e.first_name} ${e.second_name}`,
        webName: e.web_name,
        club: team ? team.name : "Unknown",
        clubShort: team ? team.short : "?",
        teamId: e.team,
        teamStrength: team ? team.strength : 3,
        position: POSITIONS[e.element_type] || "MID",
        price: num(e.now_cost) / 10,
        totalPoints: num(e.total_points),
        eventPoints: num(e.event_points),
        form: num(e.form),
        pointsPerGame: num(e.points_per_game),
        selectedBy: num(e.selected_by_percent),
        minutes,
        starts: num(e.starts),
        goals: num(e.goals_scored),
        assists: num(e.assists),
        cleanSheets: num(e.clean_sheets),
        bonus: num(e.bonus),
        yellowCards: num(e.yellow_cards),
        redCards: num(e.red_cards),
        expectedGoals: num(e.expected_goals),
        expectedAssists: num(e.expected_assists),
        expectedGoalInvolvements: num(e.expected_goal_involvements),
        xgi90: num(e.expected_goal_involvements_per_90),
        ictIndex: num(e.ict_index),
        status: e.status,
        news: e.news || "",
        chanceOfPlaying: e.chance_of_playing_next_round,
        penaltiesOrder: e.penalties_order,
        cornersOrder: e.corners_and_indirect_freekicks_order,
        freekicksOrder: e.direct_freekicks_order,
        photo: `https://resources.premierleague.com/premierleague/photos/players/110x140/p${String(
          e.photo || "",
        ).replace(".jpg", "")}.png`,
        upcomingFixtures: fixtures,
        averageFixtureDifficulty: Math.round(avgDifficulty * 100) / 100,
      };
    });
  });
}

export async function getPlayerById(id) {
  const players = await getPlayers();
  return players.find((p) => p.id === Number(id)) || null;
}

/* ------------------------------------------------------------- manager data */

function assertTeamId(teamId) {
  const id = Number(teamId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new FplError("That doesn't look like a valid FPL Team ID.", 400);
  }
  return id;
}

/** Manager + team summary for the landing dashboard. */
export async function getTeamSummary(teamId) {
  const id = assertTeamId(teamId);
  const [entry, teams, gwInfo] = await Promise.all([
    getJson(`/entry/${id}/`, { notFoundMessage: "We couldn't find a team with that ID." }),
    getTeams(),
    getGameweekInfo(),
  ]);

  return {
    id: entry.id,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`,
    teamName: entry.name,
    overallPoints: num(entry.summary_overall_points),
    overallRank: entry.summary_overall_rank,
    gameweekPoints: num(entry.summary_event_points),
    gameweekRank: entry.summary_event_rank,
    currentGameweek: entry.current_event || gwInfo.currentGameweek,
    teamValue: num(entry.last_deadline_value) / 10,
    bank: num(entry.last_deadline_bank) / 10,
    totalTransfers: num(entry.last_deadline_total_transfers),
    favouriteTeam: entry.favourite_team ? teams.get(entry.favourite_team)?.name || null : null,
    startedEvent: entry.started_event,
    yearsActive: entry.years_active,
  };
}

/** Squad picks for a gameweek, enriched with full player data. */
export async function getTeamPicks(teamId, gameweek) {
  const id = assertTeamId(teamId);
  const gwInfo = await getGameweekInfo();
  const gw = Number(gameweek) || gwInfo.currentGameweek || 1;
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    throw new FplError("That gameweek doesn't exist.", 400);
  }

  const [picks, players] = await Promise.all([
    getJson(`/entry/${id}/event/${gw}/picks/`, {
      notFoundMessage: "No squad has been published for that gameweek yet.",
    }),
    getPlayers(),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));

  const squad = picks.picks.map((pick) => {
    const player = byId.get(pick.element);
    return {
      ...(player || { id: pick.element, name: "Unknown player", position: "MID", club: "Unknown" }),
      pickPosition: pick.position,
      isCaptain: pick.is_captain,
      isViceCaptain: pick.is_vice_captain,
      multiplier: pick.multiplier,
      isBench: pick.position > 11,
    };
  });

  return {
    gameweek: gw,
    squad,
    starting: squad.filter((p) => !p.isBench),
    bench: squad.filter((p) => p.isBench),
    entryHistory: picks.entry_history
      ? {
          points: picks.entry_history.points,
          rank: picks.entry_history.rank,
          overallRank: picks.entry_history.overall_rank,
          bank: num(picks.entry_history.bank) / 10,
          value: num(picks.entry_history.value) / 10,
          transfers: picks.entry_history.event_transfers,
          transferCost: picks.entry_history.event_transfers_cost,
          benchPoints: picks.entry_history.points_on_bench,
        }
      : null,
    activeChip: picks.active_chip,
  };
}

export async function getTeamHistory(teamId) {
  const id = assertTeamId(teamId);
  const history = await getJson(`/entry/${id}/history/`, {
    notFoundMessage: "We couldn't find history for that team.",
  });
  return {
    season: (history.current || []).map((g) => ({
      gameweek: g.event,
      points: g.points,
      totalPoints: g.total_points,
      rank: g.rank,
      overallRank: g.overall_rank,
      benchPoints: g.points_on_bench,
      transfers: g.event_transfers,
      transferCost: g.event_transfers_cost,
      value: num(g.value) / 10,
      bank: num(g.bank) / 10,
    })),
    pastSeasons: (history.past || []).map((s) => ({
      season: s.season_name,
      points: s.total_points,
      rank: s.rank,
    })),
    chips: (history.chips || []).map((c) => ({ name: c.name, gameweek: c.event })),
  };
}

export async function getTeamTransfers(teamId) {
  const id = assertTeamId(teamId);
  const [transfers, players, history] = await Promise.all([
    getJson(`/entry/${id}/transfers/`, {
      notFoundMessage: "We couldn't find transfers for that team.",
    }),
    getPlayers(),
    getTeamHistory(id).catch(() => ({ season: [] })),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const costByGw = new Map(history.season.map((g) => [g.gameweek, g.transferCost]));

  return transfers.map((t) => ({
    gameweek: t.event,
    playerOut: byId.get(t.element_out)?.webName || "Unknown",
    playerOutClub: byId.get(t.element_out)?.clubShort || "",
    playerOutPrice: num(t.element_out_cost) / 10,
    playerIn: byId.get(t.element_in)?.webName || "Unknown",
    playerInClub: byId.get(t.element_in)?.clubShort || "",
    playerInPrice: num(t.element_in_cost) / 10,
    time: t.time,
    // FPL only reports a total hit per gameweek, so we surface that.
    gameweekTransferCost: costByGw.get(t.event) ?? 0,
    status: (costByGw.get(t.event) ?? 0) > 0 ? "Points hit taken" : "Free transfer",
  }));
}

export async function getTeamLeagues(teamId) {
  const id = assertTeamId(teamId);
  const entry = await getJson(`/entry/${id}/`, {
    notFoundMessage: "We couldn't find a team with that ID.",
  });
  const map = (list, type) =>
    (list || []).map((l) => ({
      id: l.id,
      name: l.name,
      type,
      rank: l.entry_rank ?? l.entry_last_rank ?? null,
      lastRank: l.entry_last_rank ?? null,
      teams: l.rank_count ?? null,
    }));
  return [
    ...map(entry.leagues?.classic, "Classic"),
    ...map(entry.leagues?.h2h, "Head-to-head"),
    ...map(entry.leagues?.cup?.matches ? [] : [], "Cup"),
  ];
}
