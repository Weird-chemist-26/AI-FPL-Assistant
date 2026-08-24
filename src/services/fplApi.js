// All frontend -> backend calls live here so components stay UI-only.
// The backend (see src/routes/api/fpl/*) is what talks to the official FPL API.

async function request(path) {
  let res;
  try {
    res = await fetch(path);
  } catch {
    throw new Error("Network problem — check your connection and try again.");
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new Error(body?.error || "Something went wrong loading FPL data.");
  }
  return body;
}

export const fplApi = {
  bootstrap: () => request("/api/fpl/bootstrap"),
  players: () => request("/api/fpl/players"),
  fixtures: (gameweek) =>
    request(`/api/fpl/fixtures${gameweek ? `?gameweek=${gameweek}` : ""}`),
  team: (teamId) => request(`/api/fpl/team/${teamId}`),
  picks: (teamId, gameweek) => request(`/api/fpl/team/${teamId}/picks/${gameweek}`),
  history: (teamId) => request(`/api/fpl/team/${teamId}/history`),
  transfers: (teamId) => request(`/api/fpl/team/${teamId}/transfers`),
  leagues: (teamId) => request(`/api/fpl/team/${teamId}/leagues`),
  recommendations: (teamId, gameweek) =>
    request(`/api/fpl/team/${teamId}/recommendations${gameweek ? `?gameweek=${gameweek}` : ""}`),
};
