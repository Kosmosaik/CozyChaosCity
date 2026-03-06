// server/src/core/presence.ts
import type { WorldState } from "../net/protocol";

/**
 * Minimal shape of what the presence module needs.
 * We keep it generic so index.ts can own its connection state type.
 */
export type ConnStateLike = {
  player_id: string | null;
};

export type OnlinePlayer = {
  player_id: string;
  display_name: string;
};

/**
 * Builds a snapshot list of online players from the current connections.
 * - Uses world.players to resolve display_name.
 * - Deduplicates by player_id (in case a player is connected twice).
 */
export function getOnlinePlayers(conns: Map<any, ConnStateLike>, world: WorldState): OnlinePlayer[] {
  const seen = new Set<string>();
  const out: OnlinePlayer[] = [];

  for (const st of conns.values()) {
    if (!st.player_id) continue;
    if (seen.has(st.player_id)) continue;

    seen.add(st.player_id);
    const rec = world.players[st.player_id];
    out.push({
      player_id: st.player_id,
      display_name: rec?.display_name ?? st.player_id,
    });
  }

  // Stable ordering for nicer UI
  out.sort((a, b) => a.display_name.localeCompare(b.display_name));
  return out;
}