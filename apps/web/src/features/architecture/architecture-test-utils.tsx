import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeSnapshot } from '@default-project/budget-engine';
import type { ProjectSnapshot } from '@default-project/types';
import { queryKeys } from '../../lib/query-keys';
import { normalise, type ProjectCache } from '../project/project-cache';
import {
  makeComponent,
  makeLand,
  makePlan,
  makeRooms,
} from './architecture-fixtures';

export const PID = 'project-1';

export function planSnapshot(
  overrides: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  return makeSnapshot({
    land: { ...makeLand(), utilities: [] },
    plan: { ...makePlan(), rooms: makeRooms(), components: [makeComponent()] },
    ...overrides,
  });
}

// Test-only helper. It mirrors testing/render.tsx without importing it: this file is compiled by the app
// tsconfig, where the vitest globals that render.tsx relies on are not declared.

/** Renders `ui` under `/projects/:projectId/architecture` with the snapshot already cached. */
export function renderWithPlan(
  ui: ReactElement,
  snapshot: ProjectSnapshot = planSnapshot(),
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  client.setQueryData<ProjectCache>(
    queryKeys.project(PID),
    normalise(snapshot),
  );
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/projects/${PID}/architecture`]}>
        <Routes>
          <Route path="/projects/:projectId/architecture" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
