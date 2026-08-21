import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getGameweekInfo, getTeams } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/bootstrap")({
  server: {
    handlers: {
      GET: () =>
        handle(async () => {
          const [gameweek, teams] = await Promise.all([getGameweekInfo(), getTeams()]);
          return { gameweek, teams: Array.from(teams.values()) };
        }),
    },
  },
});
