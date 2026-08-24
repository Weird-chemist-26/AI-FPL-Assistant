import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getTeamPicks } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/team/$teamId/picks/$gameweek")({
  server: {
    handlers: {
      GET: ({ params }) => handle(() => getTeamPicks(params.teamId, params.gameweek)),
    },
  },
});
