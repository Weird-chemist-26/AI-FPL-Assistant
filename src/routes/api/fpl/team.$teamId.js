import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getTeamSummary } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/team/$teamId")({
  server: {
    handlers: {
      GET: ({ params }) => handle(() => getTeamSummary(params.teamId)),
    },
  },
});
