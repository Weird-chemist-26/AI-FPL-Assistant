// Small React Query wrappers around the API service.
import { useQuery } from "@tanstack/react-query";
import { fplApi } from "@/services/fplApi";

const TEN_MINUTES = 1000 * 60 * 10;

export function useBootstrap() {
  return useQuery({ queryKey: ["bootstrap"], queryFn: fplApi.bootstrap, staleTime: TEN_MINUTES });
}

export function usePlayers() {
  return useQuery({ queryKey: ["players"], queryFn: fplApi.players, staleTime: TEN_MINUTES });
}

export function useFixtures(gameweek) {
  return useQuery({
    queryKey: ["fixtures", gameweek ?? "next"],
    queryFn: () => fplApi.fixtures(gameweek),
    staleTime: TEN_MINUTES,
  });
}

export function useTeam(teamId) {
  return useQuery({
    queryKey: ["team", teamId],
    queryFn: () => fplApi.team(teamId),
    enabled: Boolean(teamId),
    retry: false,
  });
}

export function usePicks(teamId, gameweek) {
  return useQuery({
    queryKey: ["picks", teamId, gameweek],
    queryFn: () => fplApi.picks(teamId, gameweek),
    enabled: Boolean(teamId && gameweek),
    retry: false,
  });
}

export function useTransfers(teamId) {
  return useQuery({
    queryKey: ["transfers", teamId],
    queryFn: () => fplApi.transfers(teamId),
    enabled: Boolean(teamId),
    retry: false,
  });
}

export function useLeagues(teamId) {
  return useQuery({
    queryKey: ["leagues", teamId],
    queryFn: () => fplApi.leagues(teamId),
    enabled: Boolean(teamId),
    retry: false,
  });
}

export function useRecommendations(teamId, gameweek) {
  return useQuery({
    queryKey: ["recommendations", teamId, gameweek],
    queryFn: () => fplApi.recommendations(teamId, gameweek),
    enabled: Boolean(teamId && gameweek),
    retry: false,
  });
}
