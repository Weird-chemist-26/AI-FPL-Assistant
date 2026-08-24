import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getFixtures, getGameweekInfo } from "@/lib/fpl/fplService.server.js";

export const Route = createFileRoute("/api/fpl/fixtures")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          const url = new URL(request.url);
          const gw = url.searchParams.get("gameweek");
          const [gameweek, fixtures] = await Promise.all([
            getGameweekInfo(),
            getFixtures(gw ? Number(gw) : undefined),
          ]);
          return { gameweek, fixtures };
        }),
    },
  },
});
