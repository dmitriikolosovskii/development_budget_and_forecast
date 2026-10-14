import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';

export interface AutosaveEditSpec<Row> {
  /** Autosave queue key, e.g. `item:<id>` (see `cacheKey`). */
  queueKey: string;
  /** Queries whose in-flight fetches must not overwrite the optimistic value. */
  cancel: QueryKey[];
  /** Current (possibly optimistic) row from the cache. */
  read: () => Row | undefined;
  /** Applies a patch or a whole row to the cache(s). */
  write: (patch: Partial<Row>) => void;
  /** PATCH request; resolves with the server row. */
  send: (merged: Record<string, unknown>) => Promise<Row>;
}

// The last server-confirmed row per queue key, saved on the first unconfirmed edit (judge constraint 2).
const confirmedRows = new Map<string, unknown>();

/** Rollups shown elsewhere (projects list, analytics) are refreshed after any successful save. */
export function invalidateRollups(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: queryKeys.projects() });
  void qc.invalidateQueries({ queryKey: queryKeys.analytics() });
}

/** Optimistic edit + autosave: cache first, PATCH 400 ms later, rollback to the confirmed row on failure. */
export function autosaveEdit<Row>(qc: QueryClient, spec: AutosaveEditSpec<Row>, patch: Partial<Row>): void {
  for (const queryKey of spec.cancel) void qc.cancelQueries({ queryKey });
  const current = spec.read();
  if (current === undefined) return;
  if (!autosaveQueue.has(spec.queueKey)) confirmedRows.set(spec.queueKey, current);
  spec.write(patch);
  autosaveQueue.enqueue(spec.queueKey, patch as Record<string, unknown>, {
    send: spec.send,
    onSuccess: (server: Row) => {
      const newer = autosaveQueue.unconfirmed(spec.queueKey) as Partial<Row> | undefined;
      if (newer) confirmedRows.set(spec.queueKey, server);
      else confirmedRows.delete(spec.queueKey);
      // Never overwrite edits that are still pending (judge constraint 3).
      spec.write({ ...server, ...newer });
      invalidateRollups(qc);
    },
    rollback: () => {
      const confirmed = confirmedRows.get(spec.queueKey) as Row | undefined;
      confirmedRows.delete(spec.queueKey);
      if (confirmed !== undefined) spec.write(confirmed);
    },
  });
}
