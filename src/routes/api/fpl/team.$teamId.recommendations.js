import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getTransferRecommendations } from "@/lib/fpl/recommendService.server.js";

export const Route = createFileRoute("/api/fpl/team/$teamId/recommendations")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        handle(() => {
          const gw = new URL(request.url).searchParams.get("gameweek");
          return getTransferRecommendations(params.teamId, gw ? Number(gw) : undefined);
        }),
    },
  },
});
