import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/fpl/http.server.js";
import { getPlayers } from "@/lib/fpl/fplService.server.js";
import { scorePlayer } from "@/lib/fpl/recommendService.server.js";

export const Route = createFileRoute("/api/fpl/players")({
  server: {
    handlers: {
      GET: () =>
        handle(async () => {
          const players = await getPlayers();
          return { players: players.map((p) => ({ ...p, score: scorePlayer(p) })) };
        }),
    },
  },
});
