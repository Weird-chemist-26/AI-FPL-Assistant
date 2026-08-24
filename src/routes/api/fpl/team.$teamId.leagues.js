import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getTeamLeagues } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/team/$teamId/leagues")({
  server: {
    handlers: {
      GET: ({ params }) => handle(async () => ({ leagues: await getTeamLeagues(params.teamId) })),
    },
  },
});
