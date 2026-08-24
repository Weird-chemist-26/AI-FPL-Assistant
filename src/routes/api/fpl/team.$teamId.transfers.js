import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getTeamTransfers } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/team/$teamId/transfers")({
  server: {
    handlers: {
      GET: ({ params }) => handle(async () => ({ transfers: await getTeamTransfers(params.teamId) })),
    },
  },
});
