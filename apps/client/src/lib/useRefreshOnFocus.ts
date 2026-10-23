// Tab screens stay mounted (expo-router keeps them alive), so React Query
// never sees a remount when the user switches tabs — a stale list would sit
// there forever. This nudges the screen's queries on every focus, but only
// the stale ones (older than staleTime), so quick back-and-forth stays free.
// The live WebSocket already invalidates on real events; this is the safety
// net for anything the socket missed (offline, backgrounded, mid-reconnect).
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useRefreshOnFocus(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const key = queryKey.join("|");
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey, stale: true });
      // queryKey is rebuilt from `key` so identity stays stable across renders.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryClient, key]),
  );
}
