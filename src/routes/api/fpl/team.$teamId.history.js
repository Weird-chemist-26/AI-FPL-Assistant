import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getTeamHistory } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/team/$teamId/history")({
  server: {
    handlers: {
      GET: ({ params }) => handle(() => getTeamHistory(params.teamId)),
    },
  },
});
